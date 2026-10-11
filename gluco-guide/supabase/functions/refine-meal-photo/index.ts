import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets) — same key
// already used by the other four functions.
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
  return `Respond in ${name}: write "mealName", every ingredient "name"/"note", "insight", and "nextTimeSuggestion" in ${name}. Keep the JSON field names exactly as specified in English.\n\n`
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
    const mealName = typeof body?.mealName === "string" ? body.mealName : ""
    const portionEstimate = typeof body?.portionEstimate === "string" ? body.portionEstimate : ""
    const ingredients = Array.isArray(body?.ingredients) ? body.ingredients : []
    const question = typeof body?.question === "string" ? body.question : ""
    const answer = typeof body?.answer === "string" ? body.answer : ""
    if (!mealName || !question || !answer) return json({ error: "Missing meal context." }, 400)

    // No image here on purpose — analyze-meal-photo already did the one
    // expensive vision read and captured everything about the dish in text
    // (name, portion, ingredient list). This call only needs to swap in the
    // user's clarified ingredient and recompute from there, which a cheap
    // text-only Haiku call handles fine — no need to re-send the photo or
    // pay for a second vision call.
    const prompt = `${languageInstruction(body?.language)}You previously analyzed a photo of a meal for a diabetes-prevention app but were unsure about one ingredient, so you asked the person eating it. Here's what you'd already determined:

Dish: ${mealName}
Portion: ${portionEstimate}
Ingredients you identified: ${JSON.stringify(ingredients)}

You asked: "${question}"
They answered: "${answer}"

Using that answer, recompute your analysis — correct the dish name and ingredient list if the answer changes what's actually in it, and re-estimate nutrition scaled to the SAME portion size already noted above (don't change the portion size itself). If they said something like "not sure" or declined to pick a specific answer, just keep your original best-guess ingredient as-is.

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"mealName":"<corrected dish name>","portionEstimate":"<same portion as given above>","ingredients":[{"name":"<ingredient>","caution":true|false,"note":"<short reason if caution, empty string otherwise>"}],"estimatedMacros":{"caloriesKcal":<number>,"proteinG":<number>,"carbG":<number>,"fatG":<number>,"fiberG":<number>},"verdict":"good"|"caution"|"neutral","insight":"<2-3 sentences>","nextTimeSuggestion":"<one specific, concrete swap for next time>"}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
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
