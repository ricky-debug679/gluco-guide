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
function languageInstruction(code: unknown): string {
  const name = typeof code === "string" ? LANGUAGE_NAMES[code] : undefined
  if (!name || name === "English") return ""
  return `\n\nRespond in ${name}: write "doingWell" and "improve" in ${name}. Keep the JSON field names exactly as specified in English.`
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

    const prompt = `You are a supportive, empathetic coach for a diabetes-prevention app, looking at someone's last 14 days of logged activity across five areas: food, water, exercise, sleep, and supplements. Based ONLY on the real numbers below (never invent facts not given here), write a short, warm, plain-language progress summary that touches on EVERY one of the five areas — don't skip any of them. Write like you genuinely care about this person reaching their health goal, not like you're grading them.

Food: logged ${food.daysLogged ?? 0}/14 days. Averages on logged days — fiber ${food.avgFiberG ?? 0}g (target ${food.fiberTarget ?? 0}g/day), protein ${food.avgProteinG ?? 0}g (target ${food.proteinTarget ?? 0}g/day), carbs ${food.avgCarbG ?? 0}g (target ${food.carbTarget ?? 0}g/day), calories ${food.avgCaloriesKcal ?? 0} (target ${food.calorieTarget ?? 0}/day).
Water: logged ${water.daysLogged ?? 0}/14 days. On logged days, averaged ${water.avgCupsOnLoggedDays ?? 0} cups (target ${water.target ?? 8} cups/day).
Exercise: active ${exercise.daysActive ?? 0} of the last ${exercise.windowDays ?? 14} days, totaling ${exercise.totalMinutes ?? 0} minutes. The REAL goal is about ${exercise.weeklyTarget ?? 150} minutes per week (so roughly ${Math.round(((exercise.weeklyTarget ?? 150) * (exercise.windowDays ?? 14)) / 7)} minutes expected over this whole window) — the "${exercise.dailyTarget ?? 30} min/day" figure is just a pacing guide derived from that weekly goal, NOT itself the real target, so never compare a single day's minutes to it as if that day alone proves success. Judge exercise by how the total (${exercise.totalMinutes ?? 0} min) compares to that real expected total, not by cherry-picking the best day.
Sleep: logged ${sleep.daysLogged ?? 0}/14 days. Averaged ${sleep.avgHours ?? 0} hours/night. Quality breakdown over logged nights: ${sleep.qualityCounts?.great ?? 0} great, ${sleep.qualityCounts?.good ?? 0} good, ${sleep.qualityCounts?.okay ?? 0} okay, ${sleep.qualityCounts?.poor ?? 0} poor.
Supplements: ${supplements.activeCount ?? 0} active supplement(s) tracked, ${supplements.dosesTaken ?? 0} of ${supplements.dosesPossible ?? 0} possible doses taken over the window.

Use real judgment about what each area's numbers actually mean against its real underlying goal — never let one good day, a small sample, or an average that only covers the days they bothered to log make something sound like a bigger win than it really is. Reaching a target cited by this prompt genuinely matters; praise the real pattern, not a flattering-looking number in isolation.

First, privately decide for each of the 5 areas whether it currently counts as going well (real, meaningful progress toward its actual goal) or needs attention (behind its goal, inconsistent, or barely logged) — every area goes in exactly one bucket, none are skipped.

Then write two things:
1. "doingWell" — ONE short flowing passage (a sentence or two, not a list) that names every area you sorted as going well, specific and warm, citing a real number for at least the standout one, written so they feel genuinely proud. If every area needs attention, say so honestly and gently point to the smallest, easiest place to start instead of inventing a strength.
2. "improve" — ONE short flowing passage naming every area you sorted as needing attention, each with a quick, concrete, doable nudge (a specific swap, a specific time, a specific small target) woven in naturally — never vague advice like "try harder" or "be more consistent," and never a criticism. If an area has barely any data logged, the nudge for it is simply to start logging it. If every area is already going well, say so and encourage keeping it up instead of inventing a weakness.

Keep each passage brief enough to read in a few seconds per area it covers — short words, no jargon, no filler phrases like "it's worth noting," no emoji, no bullet points or lists, just natural sentences. Talk like a caring friend who believes in them, not a report. Never use a hyphen or dash of any kind (no -, no –, no —) anywhere in either passage; write plain connected sentences instead (e.g. "even though you're busy" rather than "though busy—").

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"doingWell":"<a sentence or two covering every area going well>","improve":"<a sentence or two covering every area needing attention>"}${languageInstruction(body?.language)}`

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
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()

    const firstBrace = cleaned.indexOf("{")
    const lastBrace = cleaned.lastIndexOf("}")
    const jsonSlice = firstBrace !== -1 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned

    let parsed
    try {
      parsed = JSON.parse(jsonSlice)
    } catch {
      return json({ error: `Couldn't parse the AI's response. Raw: ${cleaned.slice(0, 300)}` }, 502)
    }

    return json(parsed)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
