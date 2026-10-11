import { createClient } from "npm:@supabase/supabase-js@2"

// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are all
// injected automatically for every Edge Function — no secret to set
// manually for this one, unlike the AI functions (no ANTHROPIC_API_KEY
// needed here, this never calls the AI).
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Not authenticated." }, 401)

    // Identify the caller with the ANON client + their own token — this is
    // what proves "delete MY account", never an arbitrary user id passed in
    // the request body.
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) return json({ error: "Not authenticated." }, 401)

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Account deletion isn't configured yet — missing SUPABASE_SERVICE_ROLE_KEY." }, 500)
    }

    // Deleting the auth user is the only step needed — households.owner_user_id
    // references auth.users with ON DELETE CASCADE, and every table below it
    // (members, all the daily logs, grocery lists/favorites) cascades from
    // there via its own FK, so this one call removes everything.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id)
    if (deleteError) return json({ error: deleteError.message }, 500)

    return json({ success: true })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500)
  }
})
