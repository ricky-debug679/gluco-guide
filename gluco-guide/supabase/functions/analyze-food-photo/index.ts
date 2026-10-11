import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets) — same key
// already used by analyze-grocery-list and analyze-food-item.
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
  return `Respond in ${name}: write "name" and "insight" in ${name} (where the instructions below say to translate non-English packaging text into English, translate it into ${name} instead). Keep the JSON field names exactly as specified in English.\n\n`
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
    const dataUrl = typeof body?.image === "string" ? body.image : ""
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) return json({ error: "No photo given." }, 400)
    const [, mediaType, base64] = match

    const prompt = `${languageInstruction(body?.language)}You are a nutrition assistant for a diabetes-prevention app, looking at a photo someone took while grocery shopping. The photo may show a single food/product, or several at once (e.g. items on a shelf, in a cart, or spread on a counter) — don't assume there's only one.

For EACH distinct food or product you can clearly identify in the photo:
1. Identify it with the fullest, most specific name you can actually read or determine. If there is ANY legible text on the packaging, your name must be based on what that text literally says — never guess the product from its color, shape, or general packaging style when there's text available that tells you directly, and never let a package's visual style (e.g. "this looks like a typical Asian candy wrapper") steer the identification instead of the words actually printed on it. This applies in every language, not just English: if the visible text isn't in English, read it character by character and translate it accurately — do not substitute a vaguely-similar-sounding or stylistically-plausible guess for an actual translation. When you do translate non-English text, give the name as "<original text> (<English translation>)" so the translation can be double-checked against the photo. If a brand, variety, flavor, or size is also visible, include all of it (e.g. "Cheerios Honey Nut, Family Size" not just "cereal"; "Honeycrisp apple" not just "apple"). Only fall back to a generic visual description (e.g. "red apple, variety unclear") when there is genuinely no legible text at all to read.
2. If a nutrition facts panel or ingredient list is readable for that item, read the real numbers/ingredients directly from it rather than guessing. If none is visible (e.g. a piece of fruit, a prepared dish, or an unreadable label), estimate a plausible nutrition profile from general knowledge of that type of food instead — these are reasonable estimates, not verified lab values, so keep them plausible.
3. Give a short, concrete explanation of its likely impact on blood sugar and diabetes risk, naming specific ingredients or nutritional traits (sugar, refined carbs, fiber, protein, etc.) that drove your verdict.

List every distinct item you can clearly identify — if 3 separate products are visible, return 3, not 1. If genuinely only one food/product is in frame, return a single item.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"items":[{"name":"<the food or product, as specifically as you can tell>","verdict":"good"|"caution"|"neutral","insight":"<2-3 sentences explaining the blood-sugar impact, grounded in what you could see or a clearly-reasonable estimate>","estimatedMacros":{"caloriesKcal":<number>,"proteinG":<number>,"carbG":<number>,"fatG":<number>,"fiberG":<number>}}]}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet, not Haiku, specifically for this function — real-world
        // photo label reading (especially non-English text) needs stronger
        // vision/OCR than Haiku reliably gives; Haiku was confidently
        // fabricating plausible-looking Chinese characters that didn't
        // match the actual package rather than truly reading them. Text-
        // only calls (analyze-food-item, analyze-grocery-list) stay on
        // Haiku since there's no vision fidelity need there.
        model: "claude-sonnet-5",
        max_tokens: 1400,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
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
