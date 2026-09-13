import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Not wired into the app yet — the store currently runs on mock data.
// Once VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set in .env.local,
// this client is what the data layer will switch to.
export const supabase = url && anonKey ? createClient(url, anonKey) : null
