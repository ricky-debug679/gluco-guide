import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets).
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
// model can act on directly rather than passing a bare ISO code. Only JSON
// *values* should translate — field names stay fixed English so the client
// can keep parsing the same shape regardless of language.
const LANGUAGE_NAMES: Record<string, string> = { en: "English", es: "Spanish", zh: "Chinese", hi: "Hindi" }
function languageInstruction(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  // itemFlags[].name and combinationTips[].items get matched back against the
  // user's original list client-side by substring comparison — translating
  // them would silently break that matching, so only the narrative text
  // (note/message) should change language, never the item names themselves.
  // Stated first: appended at the end, the model sometimes answered in
  // English and then wrote a second, translated answer.
  return `Respond in ${name}: translate "note" and "message" text into ${name}. Do NOT translate "name" or "items" values — echo those back exactly as given in the original grocery list, since the app matches your analysis back to the list by that exact text.\n\n`
}
function languageReminder(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nWrite "note" and "message" in ${name}, keep item names exactly as listed, and output only that one JSON object.`
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

    // Require a real signed-in user rather than allowing anonymous calls —
    // this hits a paid API, so it shouldn't be publicly callable.
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Not authenticated." }, 401)

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return json({ error: "Not authenticated." }, 401)

    const body = await req.json().catch(() => null)
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: "No items to analyze." }, 400)
    }

    // Bounded input keeps the prompt small and caps worst-case cost per call.
    const cleanItems = (items as unknown[])
      .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
      .slice(0, 40)
      .map((i) => i.trim())

    const prompt = `${languageInstruction(body?.language)}You are a nutrition assistant for a diabetes-prevention app. A user's grocery list is below. Do two things:

1. For each item that is notably unhealthy (high in added sugar, refined carbs, or sodium) or notably healthy (high fiber/protein, whole food), give a short note (one sentence, two if needed). Skip neutral items with no strong signal. For a caution item that's a sweet, baked good, dessert, or snack — where a homemade version is a realistic swap (not for something like soda or chips, where it isn't) — name one specific, genuinely appealing high-protein, naturally-sweetened homemade alternative as part of the note (e.g. for "cake": "Store-bought cake is usually loaded with refined sugar and flour — a Greek yogurt and almond flour mug cake sweetened with mashed banana or dates gives you real protein and fiber instead."). Be concrete about the actual swap, not just "try making it at home instead."

2. Look at the list AS A WHOLE for every distinct group of items that, together, suggest a specific (possibly less healthy) way they might be prepared or eaten — e.g. oil + potatoes suggests frying. Be systematic and exhaustive, not just first-match: a single list can describe more than one dish or component (for example fish + batter + oil is a fried-fish group, and potatoes + oil is a separate fried-potatoes group — both deserve their own tip even though they share "oil"; don't stop after finding the first one). Give a separate tip for each component that could be made healthier, covering sauces/condiments too if they're part of the same meal. Only include groups you're reasonably confident about, but do not under-report: if 3 distinct groups are plausible, return 3, not 1.

Write each tip as one natural, conversational sentence (or two) that both signals what you think they're about to cook and gives the practical tip — the way a knowledgeable friend glancing at the list would mention it, not a data label. If you're writing more than one tip in the same response, genuinely vary how each one opens — don't start every single one with the same phrase like "Looks like you're making...".

Grocery list:
${cleanItems.map((i) => `- ${i}`).join("\n")}

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"itemFlags":[{"name":"<item as listed>","verdict":"caution"|"good","note":"<one short sentence>"}],"combinationTips":[{"items":["<item1>","<item2>"],"message":"<one natural, conversational sentence that names what they're likely cooking and gives the tip>"}]}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      return json({ error: `AI service error (${aiRes.status}).` }, 502)
    }

    const aiData = await aiRes.json()
    const contentBlocks: { type?: string; text?: string }[] = Array.isArray(aiData.content) ? aiData.content : []
    const text = contentBlocks
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("")
    const parsed = firstJsonObject(text)
    if (!parsed) return json({ error: `Couldn't parse the AI's response. Raw: ${text.slice(0, 300)}` }, 502)

    return json(parsed)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
