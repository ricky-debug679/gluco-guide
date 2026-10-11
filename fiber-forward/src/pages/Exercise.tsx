import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useExerciseLogs } from "../hooks/useExerciseLogs"

// CDC National DPP activity benchmark is 150 min/week, framed by the CDC
// itself as ~30 min/day, 5 days a week — same guideline, daily cadence.
const DAILY_TARGET_MINUTES = 30

const activityKeys = ["walking", "running", "cycling", "strength", "yoga", "other"] as const

export function Exercise() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const exercise = useExerciseLogs(selfMemberId)

  const [showForm, setShowForm] = useState(false)
  const [activity, setActivity] = useState<(typeof activityKeys)[number]>(activityKeys[0])
  const [minutes, setMinutes] = useState("30")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayMinutes = isLive ? exercise.todayMinutes : 0
  const dayFraction = Math.min(1, todayMinutes / DAILY_TARGET_MINUTES)

  async function handleAdd() {
    const numeric = Number(minutes)
    if (!numeric || numeric <= 0) return
    setSaving(true)
    setError(null)
    try {
      if (isLive) await exercise.addExercise(activity, numeric)
      setShowForm(false)
      setMinutes("30")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.genericError"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label={t("common.back")} className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <Eyebrow>{t("exercise.eyebrow")}</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <h1 className="text-[1.4rem] font-semibold">{t("exercise.title")}</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">{t("exercise.minutesToday")}</div>
              <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {t("exercise.minutesOf", { count: todayMinutes, target: DAILY_TARGET_MINUTES })}
              </div>
            </div>
            <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[color:var(--color-sage-bg)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-sage)] transition-all"
                style={{ width: `${dayFraction * 100}%` }}
              />
            </div>
            <div className="mt-2 text-[0.72rem] text-[color:var(--color-ink-faint)]">
              {t("exercise.targetNote")}
            </div>
          </Card>

          {showForm ? (
            <Card className="flex flex-col gap-2.5">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("exercise.activityLabel")}
                </label>
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value as (typeof activityKeys)[number])}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                >
                  {activityKeys.map((key) => (
                    <option key={key} value={key}>
                      {t(`exercise.activities.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("exercise.minutesLabel")}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                />
              </div>
              {error && (
                <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{error}</div>
              )}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setShowForm(false)}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!minutes || saving}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {saving ? t("common.saving") : t("exercise.logIt")}
                </button>
              </div>
            </Card>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="min-h-11 w-full rounded-xl bg-[color:var(--color-sage)] py-3 text-[0.85rem] font-bold text-white"
            >
              {t("exercise.logActivity")}
            </button>
          )}

          {isLive && exercise.today.length > 0 && (
            <Card className="p-0">
              {exercise.today.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < exercise.today.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                  }`}
                >
                  <div>
                    <div className="text-[0.86rem] font-bold">
                      {t(`exercise.activities.${r.activity}`, { defaultValue: r.activity })}
                    </div>
                    <div className="text-[0.7rem] text-[color:var(--color-ink-faint)]">
                      {new Date(r.logged_at).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <div className="text-[0.85rem] font-bold text-[color:var(--color-sage)]">{r.duration_minutes} min</div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
