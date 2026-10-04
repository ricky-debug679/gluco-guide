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

    const prompt = `You are a nutrition assistant for a diabetes-prevention app. A user's grocery list is below. Do two things:

1. For each item that is notably unhealthy (high in added sugar, refined carbs, or sodium) or notably healthy (high fiber/protein, whole food), give a short one-sentence note. Skip neutral items with no strong signal.

2. Look at the list AS A WHOLE for every distinct group of items that, together, suggest a specific (possibly less healthy) way they might be prepared or eaten — e.g. oil + potatoes suggests frying. Be systematic and exhaustive, not just first-match: a single list can describe more than one dish or component (for example fish + batter + oil is a fried-fish group, and potatoes + oil is a separate fried-potatoes group — both deserve their own tip even though they share "oil"; don't stop after finding the first one). Give a separate tip for each component that could be made healthier, covering sauces/condiments too if they're part of the same meal. Only include groups you're reasonably confident about, but do not under-report: if 3 distinct groups are plausible, return 3, not 1.

Write each tip as one natural, conversational sentence (or two) that both signals what you think they're about to cook and gives the practical tip — the way a knowledgeable friend glancing at the list would mention it, not a data label. If you're writing more than one tip in the same response, genuinely vary how each one opens — don't start every single one with the same phrase like "Looks like you're making...".

Grocery list:
${cleanItems.map((i) => `- ${i}`).join("\n")}

Respond with ONLY valid JSON, no markdown fences, matching exactly this shape:
{"itemFlags":[{"name":"<item as listed>","verdict":"caution"|"good","note":"<one short sentence>"}],"combinationTips":[{"items":["<item1>","<item2>"],"message":"<one natural, conversational sentence that names what they're likely cooking and gives the tip>"}]}`

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1536,
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
