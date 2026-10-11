import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function. ANTHROPIC_API_KEY is the one secret that has to be set
// manually (Project Settings -> Edge Functions -> Secrets) — same key
// already used by analyze-grocery-list, analyze-food-item, and
// analyze-food-photo.
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
  return `Respond in ${name}: write "mealName", "portionEstimate", every ingredient "name"/"note", "insight", "nextTimeSuggestion", and the clarifying question's "question"/"options" (if present) in ${name}. Keep the JSON field names exactly as specified in English.\n\n`
}
function languageReminder(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nWrite those text values in ${name}, and output only that one JSON object.`
}

// Take the first complete JSON object, ignoring any explanation the model
// adds before or after it.
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

    const prompt = `${languageInstruction(body?.language)}You are a nutrition assistant for a diabetes-prevention app, looking at a photo someone took of a meal they're about to eat or are currently eating. Treat this as ONE meal/plate to analyze as a whole — even if it has several components on it — not a set of separate grocery products.

1. Name the dish as specifically as you can from what's actually visible (e.g. "Grilled chicken, white rice, and fried plantains" not just "dinner plate"). If any legible text is in frame (a takeout label, a menu card), use it to inform the name.
2. Estimate the portion size concretely from visual cues — plate/bowl size, how full it is, comparative size of components (e.g. "~1.5 cups rice, a 4oz chicken breast, a dinner-plate-sized serving overall").
3. List every distinct ingredient or component you can identify on the plate. For each, say whether it's a caution component (refined carbs, fried, sugary sauce, processed meat, etc.) and give a short concrete reason when it is — leave the reason empty for non-caution ingredients.
4. Estimate TOTAL nutrition for the whole plate as pictured, scaled to the portion size you estimated (not a generic per-100g figure) — calories, protein, total carbs, fat, fiber. These are reasonable estimates from visual portion judgment, not verified lab values.
5. Give one overall verdict (good/caution/neutral) and a 2-3 sentence insight naming the specific ingredients or traits (sugar, refined carbs, fiber, protein, frying, portion size) that drove it.
6. Suggest ONE specific, concrete swap or change for next time that would meaningfully improve the blood-sugar impact — name an actual alternative (e.g. "swap the white rice for a half portion of quinoa or cauliflower rice to add fiber and blunt the glucose spike"), never a vague "eat healthier" or "watch your portions."
7. If — and only if — a core ingredient is genuinely ambiguous from the photo alone AND the ambiguity would meaningfully change the nutrition estimate or dietary category, set "clarifyingQuestion" to a short, concrete question plus 2-3 real candidate answers.
   - This matters MOST for protein identity. A cubed/battered/fried protein in a glossy sauce can visually be almost anything — chicken, paneer, tofu, soy chunks, cauliflower (gobi) — especially in Indo-Chinese preparations like chilli-/Manchurian-style dishes, where color, shape, char, and sauce look nearly identical regardless of what's actually underneath. Getting this wrong doesn't just shift the macros, it can mean telling a vegetarian person they ate meat or vice versa. Unless something in the photo clearly settles it (visible bone, clearly fibrous meat texture/shred, a takeout label that names it, bright white paneer/tofu edges poking through the sauce), ASK rather than guess — don't let a confident-looking photo substitute for an actual visual tell.
   - Same principle for other swaps that change the macro profile meaningfully: a steamed/fried dumpling that could plausibly be a lentil preparation like nuchinunde or a potato-based one (lentils and potatoes have very different protein/fiber/carb profiles); a grain that could be rice or couscous.
   - Do NOT ask about garnish, minor seasoning, or anything that wouldn't meaningfully change the macros or dietary classification — leave it null for the large majority of photos where the dish is clear enough. Your "estimatedMacros" should still be your single best guess either way (used as a fallback if the person doesn't answer).

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"mealName":"<the dish, as specifically as you can tell>","portionEstimate":"<concrete portion description>","ingredients":[{"name":"<ingredient>","caution":true|false,"note":"<short reason if caution, empty string otherwise>"}],"estimatedMacros":{"caloriesKcal":<number>,"proteinG":<number>,"carbG":<number>,"fatG":<number>,"fiberG":<number>},"verdict":"good"|"caution"|"neutral","insight":"<2-3 sentences>","nextTimeSuggestion":"<one specific, concrete swap for next time>","clarifyingQuestion":{"question":"<short question>","options":["<candidate answer 1>","<candidate answer 2>"]}|null}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet, not Haiku — same reasoning as analyze-food-photo: reliable
        // portion-size and ingredient reading from a real photo needs
        // stronger vision than Haiku gives (see that function's comment for
        // the concrete failure that justified this originally).
        model: "claude-sonnet-5",
        max_tokens: 3000,
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
    // Concatenate every "text" block rather than trusting content[0] — a
    // model can return a leading "thinking" block (no .text field) before
    // the actual answer, which left content[0].text empty for this prompt's
    // more deliberative ambiguity-checking instructions even though the
    // same content[0].text shortcut was fine for the simpler food-photo
    // prompt.
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
