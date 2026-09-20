import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useExerciseLogs } from "../hooks/useExerciseLogs"

const WEEKLY_TARGET_MINUTES = 150 // CDC National DPP activity benchmark

const activities = ["Walking", "Running", "Cycling", "Strength training", "Yoga", "Other"]

export function Exercise() {
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const exercise = useExerciseLogs(selfMemberId)

  const [showForm, setShowForm] = useState(false)
  const [activity, setActivity] = useState(activities[0])
  const [minutes, setMinutes] = useState("30")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const weekMinutes = isLive ? exercise.weekMinutes : 0
  const weekFraction = Math.min(1, weekMinutes / WEEKLY_TARGET_MINUTES)

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
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <Eyebrow>Exercise</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <h1 className="text-[1.4rem] font-semibold">This week's activity</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">Minutes this week</div>
              <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {weekMinutes} of {WEEKLY_TARGET_MINUTES} min
              </div>
            </div>
            <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-[color:var(--color-sage-bg)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-sage)] transition-all"
                style={{ width: `${weekFraction * 100}%` }}
              />
            </div>
            <div className="mt-2 text-[0.72rem] text-[color:var(--color-ink-faint)]">
              Target reflects the CDC National Diabetes Prevention Program's 150 min/week activity benchmark.
            </div>
          </Card>

          {showForm ? (
            <Card className="flex flex-col gap-2.5">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Activity
                </label>
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                >
                  {activities.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Minutes
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
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!minutes || saving}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Log it"}
                </button>
              </div>
            </Card>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="min-h-11 w-full rounded-xl bg-[color:var(--color-sage)] py-3 text-[0.85rem] font-bold text-white"
            >
              + Log activity
            </button>
          )}

          {isLive && exercise.thisWeek.length > 0 && (
            <Card className="p-0">
              {exercise.thisWeek.map((r, i) => (
                <div
                  key={r.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < exercise.thisWeek.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                  }`}
                >
                  <div>
                    <div className="text-[0.86rem] font-bold">{r.activity}</div>
                    <div className="text-[0.7rem] text-[color:var(--color-ink-faint)]">
                      {new Date(r.logged_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
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
