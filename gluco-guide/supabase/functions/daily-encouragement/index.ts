import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically for every
// Edge Function; ANTHROPIC_API_KEY is the same secret the other AI functions use.
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
function languageName(code: unknown): string {
  return (typeof code === "string" && LANGUAGE_NAMES[code]) || "English"
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : 0)

// The reply should be one JSON object, but a model can append a correction
// after it; take the first object that parses.
function firstJsonObject(text: string): { message?: unknown } | null {
  const start = text.indexOf("{")
  if (start === -1) return null
  for (let end = text.indexOf("}", start); end !== -1; end = text.indexOf("}", end + 1)) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // not a complete object yet; try the next closing brace
    }
  }
  return null
}

// Backstop for the no-dash rule: dashes between phrases become commas,
// hyphens inside words become spaces.
function removeDashes(message: string): string {
  return message
    .replace(/\s+[-–—]+\s+|[–—]+/g, ", ")
    .replace(/(\p{L})-(\p{L})/gu, "$1 $2")
    .replace(/\s+,/g, ",")
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

    const b = (await req.json().catch(() => null)) ?? {}
    const hour = Math.min(23, Math.max(0, Math.floor(num(b.localHour))))
    const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"

    const language = languageName(b.language)
    const overCalories = num(b.calorieTarget) > 0 && num(b.caloriesKcal) > num(b.calorieTarget)

    const prompt = `Write your message in ${language}.

You are a warm, upbeat coach in a diabetes-prevention app. Write ONE short message (1 or 2 sentences, at most 30 words) reacting to what this person has logged so far today. It is ${partOfDay} where they are (hour ${hour} of 24), so judge progress against how much of the day is left: low totals in the morning are normal, not a problem.

Today so far (actual / their personal daily target):
Calories ${num(b.caloriesKcal)} / ${num(b.calorieTarget)} (a LIMIT: staying under is good; going over deserves a gentle, kind note, never praise)
Carbs ${num(b.carbG)}g / ${num(b.carbTarget)}g (a LIMIT, same as calories)
Fiber ${num(b.fiberG)}g / ${num(b.fiberTarget)}g (a GOAL: more is better, up to the target)
Protein ${num(b.proteinG)}g / ${num(b.proteinTarget)}g (a GOAL)
Fat ${num(b.fatG)}g / ${num(b.fatTarget)}g (a LIMIT)
Meals logged: ${num(b.mealsLogged)}
Water ${num(b.waterCups)} / ${num(b.waterTarget)} cups (a GOAL)
Exercise ${num(b.exerciseMinutes)} / ${num(b.exerciseTarget)} minutes (a GOAL; it paces a 150 minute weekly goal, so a short day is fine)
Mind and sleep: ${num(b.mindActivities)} stress relief activities, sleep ${b.sleepLogged ? "logged" : "not logged yet"}
Supplements: ${num(b.supplementsTaken)} of ${num(b.supplementsActive)} taken

Rules:
Pick the single most meaningful thing to react to. Praise only what is genuinely earned (a goal reached or close to it, a limit respected late in the day, or simply showing up and logging). If nothing stands out yet, cheer them for logging and name one easy next step. If something needs attention, say it gently as an encouraging next step, never as criticism.${
      overCalories
        ? `\nThey are already over today's calorie limit. Acknowledge that kindly and without guilt, and NEVER suggest eating or drinking anything with calories today. Suggest only a calorie free step (water, a short walk) or a fresh start tomorrow.`
        : ""
    }
Mention one real number from above that shows progress they made (never a zero or something they have not logged yet). Sound enthusiastic and human, like a friend who believes in them. End by encouraging them to keep logging. No emoji, no lists, no medical advice, and never use a hyphen or dash of any kind (no -, no –, no —).

Respond with ONLY one valid JSON object, written in ${language}, with no markdown fences and nothing after it: {"message":"<the message>"}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!aiRes.ok) return json({ error: `AI service error (${aiRes.status}).` }, 502)

    const aiData = await aiRes.json()
    const blocks: { type?: string; text?: string }[] = Array.isArray(aiData.content) ? aiData.content : []
    const text = blocks
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("")
      .trim()
    const parsed = firstJsonObject(text)
    if (!parsed) return json({ error: `Couldn't parse the AI's response. Raw: ${text.slice(0, 200)}` }, 502)
    if (typeof parsed.message !== "string" || !parsed.message.trim()) {
      return json({ error: "AI returned an empty message." }, 502)
    }
    return json({ message: removeDashes(parsed.message.trim()) })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
