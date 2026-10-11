import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useSleepLogs } from "../hooks/useSleepLogs"
import { useWellnessActivity } from "../hooks/useWellnessActivity"
import type { SleepQuality, WellnessActivityKind } from "../lib/types"
import { localDateKey } from "../lib/history"

const qualityKeys: SleepQuality[] = ["poor", "okay", "good", "great"]
const activityKeys: Exclude<WellnessActivityKind, "custom">[] = [
  "meditation",
  "mindfulness",
  "journaling",
  "gratitude",
  "breathing",
]

export function Wellness() {
  const { t } = useTranslation()
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
    if (hours.trim() === "" || Number.isNaN(numeric) || numeric < 0 || numeric > 24) return
    setSleepSaving(true)
    setSleepError(null)
    try {
      if (isLive) await sleep.addSleep(numeric, quality, localDateKey())
      setShowSleepForm(false)
    } catch (err) {
      setSleepError(err instanceof Error ? err.message : t("common.genericError"))
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
      setActivityError(err instanceof Error ? err.message : t("common.genericError"))
    } finally {
      setLogging(null)
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
          <Eyebrow>{t("wellness.eyebrow")}</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <h1 className="text-[1.4rem] font-semibold">{t("wellness.title")}</h1>

          <Card>
            <div className="flex items-baseline justify-between">
              <div className="text-[0.92rem] font-bold">{t("wellness.sleep")}</div>
              {isLive && sleep.latest && (
                <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                  {t("wellness.lastLogged", {
                    hours: sleep.latest.hours,
                    quality: sleep.latest.quality ? t(`wellness.qualities.${sleep.latest.quality}`) : "",
                  })}
                </div>
              )}
            </div>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              {t("wellness.sleepNote")}
            </div>

            {showSleepForm ? (
              <div className="mt-3 flex flex-col gap-2.5">
                <div>
                  <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    {t("wellness.hoursSlept")}
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
                  {qualityKeys.map((key) => (
                    <button
                      key={key}
                      onClick={() => setQuality(key)}
                      className={`min-h-10 flex-1 rounded-xl text-[0.8rem] font-bold ${
                        quality === key
                          ? "bg-[color:var(--color-sage)] text-white"
                          : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                      }`}
                    >
                      {t(`wellness.qualities.${key}`)}
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
                    {t("common.cancel")}
                  </button>
                  <button
                    onClick={handleSaveSleep}
                    disabled={!hours || sleepSaving}
                    className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white disabled:opacity-60"
                  >
                    {sleepSaving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openSleepForm}
                className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--color-sage)] py-2.5 text-[0.85rem] font-bold text-white"
              >
                {isLive && sleep.loggedToday ? t("wellness.editEntry") : t("wellness.logSleep")}
              </button>
            )}
          </Card>

          <Card>
            <Eyebrow>{t("wellness.stressManagement")}</Eyebrow>
            <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-soft)]">
              {t("wellness.stressNote")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {activityKeys.map((key) => (
                <button
                  key={key}
                  onClick={() => handleLogActivity(key)}
                  disabled={logging === key}
                  className="min-h-11 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-[0.84rem] font-bold text-[color:var(--color-ink)] disabled:opacity-60"
                >
                  {logging === key ? t("wellness.logging") : t(`wellness.activities.${key}`)}
                </button>
              ))}
              <button
                onClick={() => setShowCustom((v) => !v)}
                className="min-h-11 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 text-[0.84rem] font-bold text-[color:var(--color-ink)]"
              >
                {t("wellness.other")}
              </button>
            </div>

            {showCustom && (
              <div className="mt-2.5 flex gap-2">
                <input
                  autoFocus
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder={t("wellness.customActivityPlaceholder")}
                  className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                />
                <button
                  onClick={() => handleLogActivity("custom", customLabel)}
                  disabled={!customLabel.trim() || logging === "custom"}
                  className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {t("wellness.log")}
                </button>
              </div>
            )}

            {activityError && (
              <div className="mt-2.5 rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{activityError}</div>
            )}

            {isLive && wellness.today.length > 0 && (
              <div className="mt-3.5 flex flex-col gap-1.5 border-t border-[color:var(--color-line)] pt-3">
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("wellness.today")}
                </div>
                {wellness.today.map((entry) => (
                  <div key={entry.id} className="text-[0.85rem] text-[color:var(--color-ink)]">
                    {entry.activity === "custom"
                      ? entry.custom_label
                      : t(`wellness.activities.${entry.activity}`, { defaultValue: entry.activity })}
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
