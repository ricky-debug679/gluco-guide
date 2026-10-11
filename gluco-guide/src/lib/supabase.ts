import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Read the email-link fragment before the client consumes and clears it.
const linkParams = new URLSearchParams(window.location.hash.slice(1))
export const openedFromPasswordReset = linkParams.get("type") === "recovery"
let authLinkError = linkParams.get("error_description")

/** The error from an expired or invalid email link, returned once. */
export function takeAuthLinkError(): string | null {
  const error = authLinkError
  authLinkError = null
  return error
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null
