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
  return `Respond in ${name}: write "doingWell" and every item in "tips" entirely in ${name}, with no English words mixed in (units like g are fine). Keep the JSON field names exactly as specified in English.\n\n`
}
function languageReminder(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nWrite those text values in ${name}, and output only that one JSON object.`
}

// Shown instead of AI praise when no area has enough days logged to judge.
const NOT_ENOUGH_DATA: Record<string, string> = {
  en: "Log any area on at least 3 days to see what's going well.",
  es: "Registra cualquier área al menos 3 días para ver qué va bien.",
  zh: "任意一项记录满 3 天后，就能看到哪些方面做得好。",
  hi: "किसी भी चीज़ को कम से कम 3 दिन लॉग करें, फिर देखें क्या अच्छा चल रहा है।",
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
    const food = body?.food ?? {}
    const water = body?.water ?? {}
    const exercise = body?.exercise ?? {}
    const sleep = body?.sleep ?? {}
    const supplements = body?.supplements ?? {}
    // Decided here rather than left to the model, which praised a single
    // logged day (and an implausible 34 cups of water) when writing in
    // Spanish, Chinese, or Hindi even when told not to.
    const MIN_DAYS_FOR_PRAISE = 3
    const waterLooksLikeAMistake = (water.avgCupsOnLoggedDays ?? 0) > 2 * (water.target ?? 8)
    const praiseableAreas = [
      (food.daysLogged ?? 0) >= MIN_DAYS_FOR_PRAISE && "food",
      (water.daysLogged ?? 0) >= MIN_DAYS_FOR_PRAISE && !waterLooksLikeAMistake && "water",
      (exercise.daysActive ?? 0) >= MIN_DAYS_FOR_PRAISE && "exercise",
      (sleep.daysLogged ?? 0) >= MIN_DAYS_FOR_PRAISE && "sleep",
      (supplements.dosesTaken ?? 0) >= MIN_DAYS_FOR_PRAISE && "supplements",
    ].filter((area): area is string => !!area)
    const canPraise = praiseableAreas.length > 0

    const prompt = `${languageInstruction(body?.language)}You are a supportive coach for a diabetes-prevention app, looking at someone's last 14 days of logged activity across five areas: food, water, exercise, sleep, and supplements. Based ONLY on the real numbers below (never invent facts not given here), write a very short progress summary that a busy person can read in five seconds. Pick only what matters most; you do not need to mention every area.

Food: logged ${food.daysLogged ?? 0}/14 days. Averages on logged days — fiber ${food.avgFiberG ?? 0}g (target ${food.fiberTarget ?? 0}g/day), protein ${food.avgProteinG ?? 0}g (target ${food.proteinTarget ?? 0}g/day), carbs ${food.avgCarbG ?? 0}g (target ${food.carbTarget ?? 0}g/day), calories ${food.avgCaloriesKcal ?? 0} (target ${food.calorieTarget ?? 0}/day).
Water: logged ${water.daysLogged ?? 0}/14 days. On logged days, averaged ${water.avgCupsOnLoggedDays ?? 0} cups (target ${water.target ?? 8} cups/day).
Exercise: active ${exercise.daysActive ?? 0} of the last ${exercise.windowDays ?? 14} days, totaling ${exercise.totalMinutes ?? 0} minutes. The REAL goal is about ${exercise.weeklyTarget ?? 150} minutes per week (so roughly ${Math.round(((exercise.weeklyTarget ?? 150) * (exercise.windowDays ?? 14)) / 7)} minutes expected over this whole window) — the "${exercise.dailyTarget ?? 30} min/day" figure is just a pacing guide derived from that weekly goal, NOT itself the real target, so never compare a single day's minutes to it as if that day alone proves success. Judge exercise by how the total (${exercise.totalMinutes ?? 0} min) compares to that real expected total, not by cherry-picking the best day.
Sleep: logged ${sleep.daysLogged ?? 0}/14 days. Averaged ${sleep.avgHours ?? 0} hours/night. Quality breakdown over logged nights: ${sleep.qualityCounts?.great ?? 0} great, ${sleep.qualityCounts?.good ?? 0} good, ${sleep.qualityCounts?.okay ?? 0} okay, ${sleep.qualityCounts?.poor ?? 0} poor.
Supplements: ${supplements.activeCount ?? 0} active supplement(s) tracked, ${supplements.dosesTaken ?? 0} of ${supplements.dosesPossible ?? 0} possible doses taken over the window${supplements.dosesPossible ? ` (${Math.round(((supplements.dosesTaken ?? 0) / supplements.dosesPossible) * 100)}%)` : ""}.

${
  canPraise
    ? `Only these areas have enough days logged to count as a win: ${praiseableAreas.join(", ")}. Never praise any other area. A number far beyond its target (for example more than double the water target) is not a win: it is most likely a logging mistake, so never praise it.

Use real judgment about what each area's numbers actually mean against its real underlying goal — never let one good day or a flattering-looking number in isolation make something sound like a bigger win than it really is.

Write two things:
1. "doingWell": ONE sentence of at most 15 words naming the single biggest real win among those areas, with its number.
2. "tips": 1 to 3 tips, the most important first.`
    : `Most areas are barely logged, so this summary has no praise. Write only:
"tips": 1 to 3 tips, the most important first.`
} Each tip is ONE short sentence of at most 12 words with a concrete action (what, how much, or when), such as "Walk 20 minutes after dinner, 4 days this week." Only cover the areas that need attention most and skip the rest. If several areas are barely logged, combine that into one tip about logging daily. Never vague ("be more consistent"), never a criticism. If everything is going well, give one tip to keep it up.

Plain, warm words. No jargon, no filler, no emoji. Never use a hyphen or dash of any kind (no -, no –, no —).

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
${canPraise ? `{"doingWell":"<one short sentence>","tips":["<short tip>","<short tip>"]}` : `{"tips":["<short tip>","<short tip>"]}`}${languageReminder(body?.language)}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
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
    const parsed = firstJsonObject(text) as { doingWell?: unknown; tips?: unknown } | null
    if (!parsed || (canPraise && typeof parsed.doingWell !== "string") || !Array.isArray(parsed.tips)) {
      return json({ error: `Couldn't parse the AI's response. Raw: ${text.slice(0, 300)}` }, 502)
    }
    const tips = parsed.tips.filter((tip): tip is string => typeof tip === "string" && tip.trim() !== "").slice(0, 3)
    const language = typeof body?.language === "string" && body.language in NOT_ENOUGH_DATA ? body.language : "en"
    const doingWell = canPraise ? (parsed.doingWell as string) : NOT_ENOUGH_DATA[language]

    // "improve" keeps app versions that still show one paragraph working.
    return json({ doingWell, tips, improve: tips.join(" ") })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
