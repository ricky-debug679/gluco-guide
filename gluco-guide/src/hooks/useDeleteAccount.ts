import { useMutation } from "@tanstack/react-query"
import { supabase } from "../lib/supabase"
import { describeFunctionError } from "../lib/edgeFunctionError"

export function useDeleteAccount() {
  const mutation = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error("Not configured")
      const { data, error } = await supabase.functions.invoke("delete-account", {})
      if (error) throw new Error(await describeFunctionError(error))
      if (data?.error) throw new Error(data.error)
      // The account no longer exists server-side by this point — signOut
      // just clears local session state, and any error from it (e.g. a
      // revoke call against a user that's already gone) doesn't matter.
      await supabase.auth.signOut().catch(() => {})
    },
  })

  return {
    deleteAccount: () => mutation.mutateAsync(),
    isDeleting: mutation.isPending,
  }
}
