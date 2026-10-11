import { FunctionsHttpError } from "@supabase/supabase-js"

// supabase-js treats ANY non-2xx response from an Edge Function as a
// transport-level error, even when the function deliberately returned a
// specific, useful JSON error body (auth failure, upstream AI error, etc.)
// — so the real reason has to be read back out of the response here, or
// every failure looks identical and undebuggable from the client.
export async function describeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === "string") return body.error
    } catch {
      // response body wasn't JSON — fall through to the generic message
    }
  }
  return "Couldn't reach the server — try again."
}
