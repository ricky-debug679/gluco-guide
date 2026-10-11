import { createClient } from "npm:@supabase/supabase-js@2"

// Translates short pieces of saved AI text (a custom fiber's researched
// description, grocery item notes, combination tips) into the user's current
// language, so switching languages doesn't leave old AI text behind.
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish", zh: "Chinese", hi: "Hindi" }
const MAX_TEXTS = 60

// Take the first complete JSON object, ignoring anything the model adds after it.
function firstJsonObject(text: string): unknown {
  const start = text.indexOf("{")
  if (start === -1) return null
  for (let end = text.indexOf("}", start); end !== -1; end = text.indexOf("}", end + 1)) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // not complete yet; try the next closing brace
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    if (!ANTHROPIC_API_KEY) {
      return json({ error: "AI analysis isn't configured yet — missing ANTHROPIC_API_KEY." }, 500)
    }

    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Not authenticated." }, 401)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return json({ error: "Not authenticated." }, 401)

    const body = await req.json().catch(() => null)
    const language = typeof body?.language === "string" ? LANGUAGE_NAMES[body.language] : undefined
    if (!language) return json({ error: "Unsupported language." }, 400)
    const texts = Array.isArray(body?.texts) ? (body.texts as unknown[]).map((t) => (typeof t === "string" ? t : "")) : []
    if (texts.length === 0) return json({ texts: [] })
    if (texts.length > MAX_TEXTS) return json({ error: `At most ${MAX_TEXTS} texts per request.` }, 400)

    const prompt = `Every string in the JSON array below must end up written entirely in ${language}. The strings may be in English, Spanish, Chinese, Hindi, or another language; translate each one that is not already fully in ${language}.

Rules:
Keep the meaning, tone, and length of each string; translate, do not rewrite or add advice.
Write natural, fully translated ${language}: do not leave English or other foreign words in place (no mixing languages), except brand names and product names, which stay exactly as written.
Keep numbers as they are, but translate unit words (for example "ounces", "cups", "teaspoon") into ${language}.
A string that is already entirely in ${language} is returned unchanged. Empty strings stay empty.
Return exactly ${texts.length} strings, in the same order.

Strings:
${JSON.stringify(texts)}

Respond with ONLY one JSON object in this shape, written in ${language}, and nothing after it: {"texts":["...", "..."]}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!aiRes.ok) return json({ error: `AI service error (${aiRes.status}).` }, 502)

    const aiData = await aiRes.json()
    const blocks: { type?: string; text?: string }[] = Array.isArray(aiData.content) ? aiData.content : []
    const text = blocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
    const parsed = firstJsonObject(text) as { texts?: unknown } | null
    const out = parsed?.texts
    if (!Array.isArray(out) || out.length !== texts.length || out.some((t) => typeof t !== "string")) {
      return json({ error: `Couldn't parse the translation. Raw: ${text.slice(0, 200)}` }, 502)
    }
    return json({ texts: out })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
