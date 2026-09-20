import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useSleepLogs } from "../hooks/useSleepLogs"
import { useWellnessActivity } from "../hooks/useWellnessActivity"
import type { SleepQuality, WellnessActivityKind } from "../lib/types"

const qualities: { key: SleepQuality; label: string }[] = [
  { key: "poor", label: "Poor" },
  { key: "okay", label: "Okay" },
  { key: "good", label: "Good" },
  { key: "great", label: "Great" },
]

const activities: { key: WellnessActivityKind; label: string }[] = [
  { key: "meditation", label: "Meditation" },
  { key: "mindfulness", label: "Mindfulness" },
  { key: "journaling", label: "Journaling" },
  { key: "gratitude", label: "Gratitude" },
  { key: "breathing", label: "Breathing exercise" },
]

export function Wellness() {
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const sleep = useSleepLogs(selfMemberId)
  const wellness = useWellnessActivity(selfMemberId)

  const [showSleepForm, setShowSleepForm] = useState(false)
  const [hours, setHours] = useState("7.5")
  const [quality, setQuality] = useState<SleepQuality>("good")
  const [sleepSaving, setSleepSaving] = useState(false)

  function openSleepForm() {
    // If today's already logged, edit that entry's real values instead of
    // resetting to defaults — otherwise it looks like you can't change
    // what you picked, when really you just never saw it again.
    if (isLive && sleep.loggedToday && sleep.latest) {
      setHours(String(sleep.latest.hours))
      if (sleep.latest.quality) setQuality(sleep.latest.quality)
    }
    setShowSleepForm(true)
  }
  const [sleepError, setSleepError] = useState<string | null>(null)

  const [logging, setLogging] = useState<WellnessActivityKind | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)
  const [showCustom, setShowCustom] = useState(false)
  const [customLabel, setCustomLabel] = useState("")

  async function handleSaveSleep() {
    const numeric = Number(hours)
    if (!numeric || numeric <= 0) return
    setSleepSaving(true)
    setSleepError(null)
    try {
      if (isLive) await sleep.addSleep(numeric, quality, new Date().toISOString().slice(0, 10))
      setShowSleepForm(false)
    } catch (err) {
      setSleepError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setSleepSaving(false)
    }
  }

  async function handleLogActivity(activity: WellnessActivityKind, label?: string) {
    setActivityError(null)
    setLogging(activity)
    try {
      if (isLive) await wellness.addActivity(activity, label)
      if (activity === "custom") {
        setCustomLabel("")
        setShowCustom(false)
      }
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setLogging(null)
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
          <Eyebrow>Mind &amp; sleep</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <h1 className="text-[1.4rem] font-semibold">Rest and reset</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">Sleep</div>
              {isLive && sleep.latest && (
                <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                  Last logged: {sleep.latest.hours}h · {sleep.latest.quality}
                </div>
              )}
            </div>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              Poor sleep makes blood sugar harder to manage — even a rough estimate helps you see the pattern.
            </div>

            {showSleepForm ? (
              <div className="mt-3 flex flex-col gap-2.5">
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    Hours slept
                  </label>
                  <input
                    autoFocus
                    type="number"
                    step="0.5"
                    inputMode="decimal"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                  />
                </div>
                <div className="flex gap-1.5">
                  {qualities.map((q) => (
                    <button
                      key={q.key}
                      onClick={() => setQuality(q.key)}
                      className={`min-h-10 flex-1 rounded-xl text-[0.8rem] font-bold ${
                        quality === q.key
                          ? "bg-[color:var(--color-sage)] text-white"
                          : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
                {sleepError && (
                  <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{sleepError}</div>
                )}
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowSleepForm(false)}
                    className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSleep}
                    disabled={!hours || sleepSaving}
                    className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                  >
                    {sleepSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openSleepForm}
                className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--color-sage)] py-2.5 text-[0.85rem] font-bold text-white"
              >
                {isLive && sleep.loggedToday ? "Edit today's entry" : "+ Log last night's sleep"}
              </button>
            )}
          </Card>

          <Card>
            <Eyebrow>Stress management</Eyebrow>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              Chronic stress raises blood sugar too — a few minutes of any of these genuinely helps.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activities.map((a) => (
                <button
                  key={a.key}
                  onClick={() => handleLogActivity(a.key)}
                  disabled={logging === a.key}
                  className="min-h-11 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-[0.84rem] font-bold text-[color:var(--color-ink)] disabled:opacity-60"
                >
                  {logging === a.key ? "Logging…" : a.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="min-h-11 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-[0.84rem] font-bold text-[color:var(--color-ink)]"
              >
                Other
              </button>
            </div>

            {showCustom && (
              <div className="mt-2.5 flex gap-2">
                <input
                  autoFocus
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="What did you do?"
                  className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                />
                <button
                  onClick={() => handleLogActivity("custom", customLabel)}
                  disabled={!customLabel.trim() || logging === "custom"}
                  className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  Log
                </button>
              </div>
            )}

            {activityError && (
              <div className="mt-2.5 rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{activityError}</div>
            )}

            {isLive && wellness.today.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-1.5 border-t border-[color:var(--color-line)] pt-3">
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Today
                </div>
                {wellness.today.map((entry) => (
                  <div key={entry.id} className="text-[0.85rem] text-[color:var(--color-ink)]">
                    {entry.activity === "custom"
                      ? entry.custom_label
                      : activities.find((a) => a.key === entry.activity)?.label}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
