import { supabase } from "./supabase"
import { describeFunctionError } from "./edgeFunctionError"

/** Translates saved AI text into `language`; returns the strings in the same order. */
export async function translateTexts(texts: string[], language: string): Promise<string[]> {
  if (!supabase) throw new Error("Not configured")
  const { data, error } = await supabase.functions.invoke("translate-texts", { body: { texts, language } })
  if (error) throw new Error(await describeFunctionError(error))
  if (data?.error) throw new Error(data.error)
  return data.texts as string[]
}
