import { useState } from "react"
import { supabase } from "../lib/supabase"

export function Auth() {
  const [mode, setMode] = useState<"in" | "up">("in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice("Account created. If email confirmation is on for this project, check your inbox — otherwise you're signed in.")
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex w-full max-w-md flex-col justify-center gap-5 px-6">
        <div>
          <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
            Fiber Forward
          </div>
          <h1 className="mt-2 text-[1.6rem] font-semibold">
            {mode === "in" ? "Welcome back" : "Create your account"}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
            />
          </div>
          <div>
            <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem] text-[color:var(--color-ink)]">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-xl bg-[color:var(--color-sage-bg)] p-3 text-[0.82rem] text-[color:var(--color-ink)]">
              {notice}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="text-center text-[0.85rem] font-semibold text-[color:var(--color-sage)]"
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  )
}
