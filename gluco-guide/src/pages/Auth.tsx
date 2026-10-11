import { useState } from "react"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { LanguageSwitcher } from "../components/LanguageSwitcher"

export function Auth() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in")
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
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice(t("auth.resetEmailSent"))
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice(t("auth.signUpNotice"))
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
          <div className="flex items-center justify-between gap-2">
            <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
              {t("auth.brand")}
            </div>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-2 text-[1.6rem] font-semibold">
            {mode === "in" ? t("auth.welcomeBack") : mode === "up" ? t("auth.createAccount") : t("auth.resetPasswordTitle")}
          </h1>
          {mode === "forgot" && (
            <div className="mt-2 text-[0.88rem] text-[color:var(--color-ink-soft)]">
              {t("auth.resetPasswordSubtitle")}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
              {t("auth.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                {t("auth.password")}
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
          )}

          {mode === "in" && (
            <button
              type="button"
              onClick={() => {
                setMode("forgot")
                setError(null)
                setNotice(null)
              }}
              className="text-left text-[0.82rem] font-semibold text-[color:var(--color-sage)]"
            >
              {t("auth.forgotPassword")}
            </button>
          )}

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
            {busy
              ? mode === "forgot"
                ? t("auth.sending")
                : t("auth.pleaseWait")
              : mode === "in"
                ? t("auth.signIn")
                : mode === "up"
                  ? t("auth.signUp")
                  : t("auth.sendResetLink")}
          </button>
        </form>

        {mode === "forgot" ? (
          <button
            onClick={() => {
              setMode("in")
              setError(null)
              setNotice(null)
            }}
            className="text-center text-[0.85rem] font-semibold text-[color:var(--color-sage)]"
          >
            {t("auth.backToSignIn")}
          </button>
        ) : (
          <button
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="text-center text-[0.85rem] font-semibold text-[color:var(--color-sage)]"
          >
            {mode === "in" ? t("auth.newHere") : t("auth.alreadyHave")}
          </button>
        )}
      </div>
    </div>
  )
}
