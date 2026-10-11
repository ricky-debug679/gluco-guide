import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets) — same key
// already used by every other AI function.
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

// The client sends its active i18next language code; map to a name the
// model can act on directly rather than passing a bare ISO code.
const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish", zh: "Chinese", hi: "Hindi" }
// Stated first: appended at the end, the model sometimes answered in
// English and then wrote a second, translated answer.
function languageInstruction(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `Respond in ${name}: write "description", "usage", and "timing" in ${name}. Keep the JSON field names exactly as specified in English.\n\n`
}
function languageReminder(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nWrite those text values in ${name}, and output only that one JSON object.`
}

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
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) return json({ error: "No product name given." }, 400)
    const fiberGrams = typeof body?.fiberGrams === "number" && body.fiberGrams > 0 ? body.fiberGrams : null

    const prompt = `${languageInstruction(body?.language)}You are a nutrition assistant for a diabetes-prevention app. The person tracks a fiber supplement and just told you what they take: "${name}"${fiberGrams ? ` (they say it has ${fiberGrams}g of fiber per dose)` : ""}.

If this is a real, recognizable fiber supplement product or a well-known fiber type (e.g. a specific brand, or something generic like "psyllium husk capsules" or "chia seeds"), use what you actually know about it. If the name is too vague, made up, or not something you can identify with real confidence, say so honestly in the description rather than inventing specifics — fall back to general soluble-fiber guidance instead.

Write three short things, each exactly ONE plain sentence (never two) — a busy person should read all three in a few seconds, not study them:
1. "description" — what it is and its main benefit for blood sugar/digestion, in one sentence.
2. "usage" — how it's typically taken, in one sentence (e.g. mixed into water, capsule form, typical serving).
3. "timing" — when to take it relative to meals, in one sentence (before, with, or between — and why, only if there's a real reason like needing water to avoid it gelling too fast).

${fiberGrams ? "" : `4. "estimatedFiberPerDoseG" — your best-effort estimate of grams of fiber per typical dose, as a plain number, since the person didn't give one. This is a fallback estimate only, not a verified label value.`}

Keep every sentence short, plain, warm, and direct — no jargon, no filler, no emoji, no hyphens or dashes of any kind (no -, no –, no —). Think label text, not a paragraph.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"description":"<one sentence>","usage":"<one sentence>","timing":"<one sentence>","estimatedFiberPerDoseG":${fiberGrams ? "null" : "<number>"}}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 350,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      return json({ error: `AI service error (${aiRes.status}).` }, 502)
    }

    const aiData = await aiRes.json()
    const contentBlocks: { type?: string; text?: string }[] = Array.isArray(aiData.content) ? aiData.content : []
    const text: string = contentBlocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
    if (!text) {
      const blockTypes = contentBlocks.map((b) => b.type).join(",") || "none"
      return json(
        { error: `AI returned no text (stop_reason: ${aiData.stop_reason ?? "unknown"}, blocks: ${blockTypes}).` },
        502,
      )
    }
    const parsed = firstJsonObject(text)
    if (!parsed) return json({ error: `Couldn't parse the AI's response. Raw: ${text.slice(0, 300)}` }, 502)

    return json(parsed)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
