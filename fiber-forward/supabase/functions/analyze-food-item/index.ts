import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets) — same key
// already used by analyze-grocery-list.
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
function languageInstruction(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nRespond in ${name}: write "insight" in ${name}, but keep the JSON field names exactly as specified in English.`
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
    if (!name) return json({ error: "No food item given." }, 400)

    // When the item wasn't found in our nutrition database, the caller sends
    // just the name with unknown:true instead of real macros — the AI then
    // has to estimate composition from general knowledge rather than ground
    // its reasoning in verified numbers.
    const isUnknown = body?.unknown === true

    const prompt = isUnknown
      ? `You are a nutrition assistant for a diabetes-prevention app. The food below was not found in our nutrition database, so there are no verified macro numbers for it — use your general knowledge of this food or dish instead.

Food: ${name}

Do two things:
1. Name the specific ingredients this food or dish is typically made of, and flag anything likely to raise blood sugar (refined carbs, added sugar, frying oil, etc.) or anything beneficial (fiber, protein, whole-food ingredients).
2. Give a rough estimated nutrition profile per 100g (or a typical serving if that reads more naturally for this food). These are reasonable estimates for this type of food, not verified lab values — keep them plausible, don't guess wildly.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"verdict":"good"|"caution"|"neutral","insight":"<2-4 sentences naming likely specific ingredients and their impact on blood sugar, clearly framed as a general estimate since this food wasn't found in the nutrition database>","estimatedMacros":{"caloriesKcal":<number>,"proteinG":<number>,"carbG":<number>,"fatG":<number>,"fiberG":<number>}}${languageInstruction(body?.language)}`
      : `You are a nutrition assistant for a diabetes-prevention app. Analyze ONE food item's likely impact on blood sugar and overall health.

Food: ${name}
Nutrition facts (per 100g unless the name states a serving): ${Number(body?.caloriesKcal) || 0} kcal, ${Number(body?.proteinG) || 0}g protein, ${Number(body?.carbG) || 0}g carbs, ${Number(body?.fatG) || 0}g fat, ${Number(body?.fiberG) || 0}g fiber.

Ground your analysis in the numbers above — do not invent additional specific numeric facts (like an exact sugar or sodium gram amount) that weren't given, since you don't actually have them and could get them wrong. You may still reason qualitatively from the food's name about what it likely contains (e.g. a name suggesting it's fried, sweetened, refined, or a whole unprocessed food) to explain *why* the numbers look the way they do and name the kind of ingredient concern or benefit involved (e.g. "likely contains added sugar" rather than a fabricated sugar gram count) — make clear this is a reasonable inference from the food type, not a verified ingredient list. This applies equally to whole, unpackaged foods like fruits and vegetables — analyze their real nutritional benefits or impact, don't just skip them for lacking a label.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"verdict":"good"|"caution"|"neutral","insight":"<2-3 sentence explanation of this food's likely impact on blood sugar and diabetes risk, grounded in the numbers above>"}${languageInstruction(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!aiRes.ok) {
      return json({ error: `AI service error (${aiRes.status}).` }, 502)
    }

    const aiData = await aiRes.json()
    const text: string = aiData.content?.[0]?.text ?? ""
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return json({ error: "Couldn't parse the AI's response." }, 502)
    }

    return json(parsed)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
