import { useState } from "react"
import { useTranslation } from "react-i18next"
import { supabase } from "../lib/supabase"
import { LanguageSwitcher } from "../components/LanguageSwitcher"

const inputClass =
  "mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
const labelClass = "text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]"

export function ResetPassword({ onSaved }: { onSaved: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setError(null)
    if (password.length < 6) return setError(t("profile.passwordTooShort"))
    if (password !== confirm) return setError(t("profile.passwordMismatch"))
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      onSaved()
      await supabase.auth.signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.genericError"))
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
          <h1 className="mt-2 text-[1.6rem] font-semibold">{t("auth.setNewPasswordTitle")}</h1>
          <div className="mt-2 text-[0.88rem] text-[color:var(--color-ink-soft)]">{t("auth.setNewPasswordSubtitle")}</div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div>
            <label htmlFor="new-password" className={labelClass}>
              {t("profile.newPasswordLabel")}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className={labelClass}>
              {t("profile.confirmPasswordLabel")}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem] text-[color:var(--color-ink)]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white disabled:opacity-60"
          >
            {busy ? t("profile.passwordUpdating") : t("auth.saveNewPassword")}
          </button>
        </form>

        <button
          onClick={() => supabase?.auth.signOut()}
          disabled={busy}
          className="text-center text-[0.85rem] font-semibold text-[color:var(--color-sage)]"
        >
          {t("auth.cancelReset")}
        </button>
      </div>
    </div>
  )
}
