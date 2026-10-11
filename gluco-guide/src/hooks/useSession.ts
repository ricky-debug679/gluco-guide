import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { openedFromPasswordReset, supabase } from "../lib/supabase"

// A reset link signs the user in. Persisting this flag keeps them on the
// set-new-password screen even if they reload before finishing.
const RECOVERY_KEY = "glucoguide_password_recovery"

function writeRecoveryFlag(on: boolean) {
  try {
    if (on) localStorage.setItem(RECOVERY_KEY, "1")
    else localStorage.removeItem(RECOVERY_KEY)
  } catch {
    // storage unavailable (private mode): the in-memory flag still works
  }
}

function readRecoveryFlag() {
  try {
    return localStorage.getItem(RECOVERY_KEY) === "1"
  } catch {
    return false
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(() => {
    if (openedFromPasswordReset) writeRecoveryFlag(true)
    return openedFromPasswordReset || readRecoveryFlag()
  })

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "PASSWORD_RECOVERY") {
        writeRecoveryFlag(true)
        setRecovering(true)
      } else if (event === "SIGNED_OUT") {
        writeRecoveryFlag(false)
        setRecovering(false)
      }
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, loading, recovering: recovering && !!session }
}
