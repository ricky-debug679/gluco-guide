import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAppStore } from "../store/useAppStore"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useCompleteProfile, useSetWeightGoal, useSetWeightPace } from "../hooks/useHousehold"
import { supabase } from "../lib/supabase"
import {
  activityLevelKeys,
  buildCaloriePlan,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
  type ActivityLevel,
  type BiologicalSex,
  type WeightPace,
} from "../lib/caloriePlan"
import { estimateGoal, formatGoalDate, paceOptions, suggestedTargetLbs } from "../lib/weightGoal"
import { goalKeys } from "../lib/goals"
import { trackedAreaKeys, type TrackedArea } from "../lib/trackedAreas"
import { LanguageSwitcher } from "../components/LanguageSwitcher"
import { localDateKey } from "../lib/history"

// Accepts how people actually write lab results: "5.7%", "110 mg/dL", "5,7".
function parseLabValue(raw: string): number | null {
  const value = parseFloat(raw.replace(",", "."))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function Onboarding() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  // Demo-data path (no backend configured)
  const demoOnboarding = useAppStore((s) => s.onboarding)
  const setDemoName = useAppStore((s) => s.onboardingSetName)
  const setDemoGoal = useAppStore((s) => s.onboardingSetGoal)
  const advanceDemo = useAppStore((s) => s.onboardingAdvance)
  const completeDemo = useAppStore((s) => s.onboardingComplete)

  // Real-data path
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const completeProfile = useCompleteProfile(householdCtx?.household.selfMember.id)
  const setWeightGoal = useSetWeightGoal(householdCtx?.household.selfMember.id)
  const setWeightPace = useSetWeightPace(householdCtx?.household.selfMember.id)

  const [step, setStep] = useState(0)
  // Always starts blank — never pre-filled from the placeholder bootstrap
  // name, so every user has to actually type their own name here.
  const [name, setName] = useState("")
  const [goalIndex, setGoalIndex] = useState<number | null>(null)
  const [trackedAreas, setTrackedAreas] = useState<TrackedArea[]>([...trackedAreaKeys])
  const [heightFeet, setHeightFeet] = useState("5")
  const [heightInches, setHeightInches] = useState("4")
  const [weightLbs, setWeightLbs] = useState("160")
  const [age, setAge] = useState("30")
  const [sex, setSex] = useState<BiologicalSex | null>(null)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [fastingGlucose, setFastingGlucose] = useState("")
  const [glucose2h, setGlucose2h] = useState("")
  const [hbA1c, setHbA1c] = useState("")
  const [targetLbs, setTargetLbs] = useState("")
  const [pace, setPace] = useState<WeightPace | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Live steps: 0 name, 1 goal, 2 what to track, 3 about you, 4 plan, 5 weight goal.
  const lastStep = isLive ? 5 : 2

  function toggleTrackedArea(key: TrackedArea) {
    setTrackedAreas((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))
  }

  const currentName = isLive ? name : demoOnboarding.name
  const canContinueName = currentName.trim().length > 0

  const canContinueAboutYou = isLive
    ? Boolean(heightFeet && weightLbs && age && sex && activityLevel)
    : true

  const planInput =
    isLive && sex && activityLevel && heightFeet && weightLbs && age
      ? {
          heightCm: feetInchesToCm(Number(heightFeet), Number(heightInches) || 0),
          weightKg: lbsToKg(Number(weightLbs)),
          age: Number(age),
          sex,
          activityLevel,
        }
      : null
  const plan = planInput ? buildCaloriePlan(planInput) : null

  // Weight goal step: a blank target means no goal (the plan's default pace still applies).
  const goalInput = planInput && Number(targetLbs) > 0 ? { ...planInput, targetWeightKg: lbsToKg(Number(targetLbs)) } : null
  const goalEstimate = goalInput ? estimateGoal(goalInput, pace) : null
  const goalIsValid = goalEstimate?.kind === "eta"
  const goalPlan = planInput ? buildCaloriePlan(goalIsValid && goalInput ? { ...goalInput, pace } : planInput) : null
  const canFinishGoal = !targetLbs.trim() || goalIsValid

  async function handleFinish(saveGoal = false) {
    if (!isLive || !sex || !activityLevel) {
      completeDemo()
      navigate("/")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await completeProfile.mutateAsync({
        displayName: name.trim() || householdCtx!.household.selfMember.display_name,
        goal: goalIndex !== null ? goalKeys[goalIndex] : "generalWellness",
        heightCm: feetInchesToCm(Number(heightFeet), Number(heightInches) || 0),
        weightKg: lbsToKg(Number(weightLbs)),
        age: Number(age),
        sex,
        activityLevel,
        trackedAreas,
      })

      if (saveGoal && goalInput && goalEstimate?.kind === "eta") {
        await setWeightGoal.mutateAsync({ targetWeightKg: goalInput.targetWeightKg, startWeightKg: goalInput.weightKg })
        await setWeightPace.mutateAsync(goalEstimate.activePace)
      }

      if (supabase) {
        const memberId = householdCtx!.household.selfMember.id
        const today = localDateKey()
        const readings = (
          [
            ["glucose", fastingGlucose],
            ["glucose_2h", glucose2h],
            ["a1c", hbA1c],
          ] as const
        ).flatMap(([metricKey, raw]) => {
          const value = parseLabValue(raw)
          return value === null ? [] : [{ member_id: memberId, metric_key: metricKey, value, recorded_at: today }]
        })
        if (readings.length > 0) {
          const { error: labError } = await supabase.from("biometric_readings").insert(readings)
          if (labError) throw labError
        }
      }

      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : t("onboarding.genericError"))
    } finally {
      setSaving(false)
    }
  }

  function handleNext() {
    if (!isLive) {
      // original demo flow, unchanged
      if (step === 2) {
        completeDemo()
        navigate("/")
        return
      }
      advanceDemo()
      setStep((s) => Math.min(2, s + 1))
      return
    }

    if (step === lastStep) {
      void handleFinish(true)
      return
    }
    // Entering the weight goal step: start from the suggested target for this body.
    if (step === lastStep - 1 && plan && planInput) {
      const suggestion = suggestedTargetLbs(plan, planInput.weightKg)
      setTargetLbs(suggestion ? String(suggestion) : "")
      setPace(null)
    }
    setStep((s) => Math.min(lastStep, s + 1))
  }

  // Back to the home address, so whoever signs in next starts from the top.
  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut()
    navigate("/", { replace: true })
  }

  function handleSkip() {
    if (!isLive) {
      completeDemo()
      navigate("/")
      return
    }
    void handleFinish()
  }

  const displayStep = isLive ? step : demoOnboarding.step
  const displayGoalIndex = isLive ? goalIndex : demoOnboarding.goalIndex

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2 px-5 pt-6">
          {Array.from({ length: lastStep + 1 }, (_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full bg-[color:var(--color-line)] transition-all ${
                i === displayStep ? "w-5 bg-[color:var(--color-sage)]" : "w-2"
              }`}
            />
          ))}
          {/* Other pages wait until sign-up is done, so this is the way out for someone in the wrong account. */}
          {isLive && (
            <button
              onClick={() => void handleSignOut()}
              className="ml-auto min-h-9 px-1 text-[0.78rem] font-semibold text-[color:var(--color-ink-faint)]"
            >
              {t("nav.signOut")}
            </button>
          )}
          <LanguageSwitcher className={isLive ? "" : "ml-auto"} />
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-7">
          {displayStep === 0 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.welcome")}
                </div>
                <h1 className="mt-2 text-[1.7rem] font-semibold">{t("onboarding.title")}</h1>
                <div className="mt-2 text-[0.92rem] text-[color:var(--color-ink-soft)]">
                  {t("onboarding.subtitle")}
                </div>
              </div>
              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.nameLabel")}
                </label>
                <input
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  placeholder={t("onboarding.namePlaceholder")}
                  value={isLive ? name : demoOnboarding.name}
                  onChange={(e) => (isLive ? setName(e.target.value) : setDemoName(e.target.value))}
                />
              </div>
            </>
          )}

          {displayStep === 1 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 2, total: lastStep + 1 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.goalsTitle")}</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  {t("onboarding.goalsSubtitle")}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {goalKeys.map((key, i) => (
                  <button
                    key={key}
                    onClick={() => (isLive ? setGoalIndex(i) : setDemoGoal(i))}
                    className={`min-h-11 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-[0.9rem] font-bold ${
                      displayGoalIndex === i
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
                    }`}
                  >
                    {t(`onboarding.goals.${key}`)}
                  </button>
                ))}
              </div>
            </>
          )}

          {isLive && displayStep === 2 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 3, total: lastStep + 1 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.trackTitle")}</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  {t("onboarding.trackSubtitle")}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {trackedAreaKeys.map((key) => {
                  const on = trackedAreas.includes(key)
                  return (
                    <button
                      key={key}
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleTrackedArea(key)}
                      className={`flex min-h-11 items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-left ${
                        on
                          ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                          on
                            ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage)] text-white"
                            : "border-[color:var(--color-line)]"
                        }`}
                      >
                        {on && (
                          <svg width={14} height={14} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12l5 5 9-10" />
                          </svg>
                        )}
                      </span>
                      <span>
                        <span className="block text-[0.9rem] font-bold">{t(`onboarding.trackAreas.${key}.label`)}</span>
                        <span className="block text-[0.75rem] text-[color:var(--color-ink-faint)]">
                          {t(`onboarding.trackAreas.${key}.hint`)}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {isLive && displayStep === 3 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 4, total: lastStep + 1 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.aboutYouTitle")}</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  {t("onboarding.aboutYouSubtitle")}
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.heightLabel")}
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      type="number"
                      value={heightFeet}
                      onChange={(e) => setHeightFeet(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                      {t("onboarding.ft")}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={heightInches}
                      onChange={(e) => setHeightInches(e.target.value)}
                      className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                      {t("onboarding.in")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.weightLabel")}
                  </label>
                  <input
                    type="number"
                    value={weightLbs}
                    onChange={(e) => setWeightLbs(e.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  />
                </div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.ageLabel")}
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.sexLabel")}
                </label>
                <div className="mt-2 flex gap-2.5">
                  {(["female", "male"] as BiologicalSex[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSex(s)}
                      className={`min-h-11 flex-1 rounded-xl text-[0.88rem] font-bold capitalize ${
                        sex === s
                          ? "bg-[color:var(--color-sage)] text-white"
                          : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                      }`}
                    >
                      {t(s === "female" ? "onboarding.sexFemale" : "onboarding.sexMale")}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.activityLabel")}
                </label>
                <div className="mt-2 flex flex-col gap-2">
                  {activityLevelKeys.map((key) => (
                    <button
                      key={key}
                      onClick={() => setActivityLevel(key)}
                      className={`min-h-11 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left ${
                        activityLevel === key
                          ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                      }`}
                    >
                      <div className="text-[0.86rem] font-bold">{t(`onboarding.activity.${key}.label`)}</div>
                      <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">
                        {t(`onboarding.activity.${key}.hint`)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.labsLabel")}
                </label>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.labsNote")}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    inputMode="decimal"
                    placeholder={t("onboarding.fastingGlucosePlaceholder")}
                    value={fastingGlucose}
                    onChange={(e) => setFastingGlucose(e.target.value)}
                  />
                  <input
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    inputMode="decimal"
                    placeholder={t("onboarding.glucose2hPlaceholder")}
                    value={glucose2h}
                    onChange={(e) => setGlucose2h(e.target.value)}
                  />
                  <input
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    inputMode="decimal"
                    placeholder={t("onboarding.hba1cPlaceholder")}
                    value={hbA1c}
                    onChange={(e) => setHbA1c(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {isLive && displayStep === 4 && plan && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 5, total: lastStep + 1 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.planTitle")}</h1>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.yourBmi")}
                  </div>
                  <div className="font-serif text-[1.6rem]">{plan.bmi.toFixed(1)}</div>
                </div>
                <div className={`mt-1 text-[0.85rem] text-[color:var(--color-ink-soft)] ${plan.isMinor ? "" : "capitalize"}`}>
                  {plan.isMinor
                    ? t("onboarding.categoryMinor")
                    : plan.category === "healthy"
                      ? t("onboarding.categoryHealthy")
                      : t("onboarding.categoryOther", { category: t(`onboarding.categories.${plan.category}`) })}
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--color-sage-bg)] p-4">
                <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.dailyCalorieTarget")}
                </div>
                <div className="mt-1 font-serif text-[1.8rem]">{plan.targetCalories.toLocaleString()} kcal</div>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.estimatedMaintenance", { kcal: plan.maintenanceCalories.toLocaleString() })}
                </div>
                <div className="mt-2.5 text-[0.85rem] leading-relaxed">
                  {plan.isMinor
                    ? t("onboarding.plan.messageMinor")
                    : plan.category === "healthy"
                      ? t("onboarding.plan.messageHealthy")
                      : plan.category === "underweight"
                        ? t("onboarding.plan.messageUnderweight", {
                            surplus: Math.round(plan.dailySurplus),
                            kg: Math.abs(plan.weeklyChangeKg).toFixed(1),
                            lb: Math.abs(plan.weeklyChangeKg * 2.2046).toFixed(1),
                          })
                        : t("onboarding.plan.messageDeficit", {
                            deficit: Math.round(plan.dailyDeficit),
                            kg: Math.abs(plan.weeklyChangeKg).toFixed(1),
                            lb: Math.abs(plan.weeklyChangeKg * 2.2046).toFixed(1),
                          })}
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--color-surface-2)] p-4 text-[0.8rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                {t("onboarding.disclaimer")}
              </div>
            </>
          )}

          {isLive && displayStep === 5 && plan && goalPlan && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 6, total: lastStep + 1 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.weightGoalTitle")}</h1>
                <div className="mt-2 text-[0.9rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                  {plan.isMinor
                    ? t("profile.goalMinor")
                    : plan.category === "healthy"
                      ? t("onboarding.weightGoalHealthy")
                      : plan.category === "underweight"
                        ? t("onboarding.weightGoalGain")
                        : t("onboarding.weightGoalLoss")}
                </div>
              </div>

              {!plan.isMinor && (
                <>
                  <div>
                    <label
                      htmlFor="onboarding-target-weight"
                      className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]"
                    >
                      {plan.category === "healthy" ? t("onboarding.targetWeightOptional") : t("profile.targetWeightLabel")}
                    </label>
                    <input
                      id="onboarding-target-weight"
                      type="number"
                      inputMode="numeric"
                      className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                      value={targetLbs}
                      onChange={(e) => setTargetLbs(e.target.value)}
                    />
                  </div>

                  {goalEstimate?.kind === "eta" && goalInput ? (
                    <div className="flex flex-col gap-2">
                      <div className="text-[0.72rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                        {t("profile.paceLabel")}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {paceOptions(goalInput).map(({ pace: option, rateLb }) => {
                          const active = goalEstimate.activePace === option
                          return (
                            <button
                              key={option}
                              aria-pressed={active}
                              onClick={() => setPace(option)}
                              className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-[1.5px] px-1 py-2 ${
                                active
                                  ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                                  : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
                              }`}
                            >
                              <span className="text-[0.84rem] font-bold">{t(`profile.paces.${option}`)}</span>
                              <span className="text-[0.7rem]">{t("profile.paceRate", { rate: rateLb, unit: t("profile.lb") })}</span>
                            </button>
                          )
                        })}
                      </div>
                      <div className="text-[0.85rem] leading-relaxed">
                        {t("profile.goalEta", {
                          rate: goalEstimate.rateLb,
                          target: Math.round(kgToLbs(goalInput.targetWeightKg)),
                          unit: t("profile.lb"),
                          date: formatGoalDate(goalEstimate.date, i18n.language),
                        })}
                      </div>
                      <div className="text-[0.75rem] leading-relaxed text-[color:var(--color-ink-faint)]">
                        {goalEstimate.gaining ? t("profile.paceGainNote") : t("profile.paceLossNote")}
                      </div>
                    </div>
                  ) : goalEstimate ? (
                    <div className="rounded-xl bg-[color:var(--color-honey-bg)] p-3 text-[0.82rem] leading-relaxed">
                      {goalEstimate.kind === "belowHealthy"
                        ? t("profile.goalBelowHealthy")
                        : goalEstimate.kind === "aboveHealthy"
                          ? t("profile.goalAboveHealthy")
                          : t("profile.goalNoDeficit")}
                    </div>
                  ) : null}
                </>
              )}

              <div className="rounded-2xl bg-[color:var(--color-sage-bg)] p-4">
                <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.dailyCalorieTarget")}
                </div>
                <div className="mt-1 font-serif text-[1.8rem]">{goalPlan.targetCalories.toLocaleString()} kcal</div>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.weightGoalLater")}
                </div>
              </div>
            </>
          )}

          {!isLive && demoOnboarding.step === 2 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  {t("onboarding.stepOf", { n: 3, total: 3 })}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">{t("onboarding.labsLabel")}</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  {t("onboarding.demoLabsSubtitle")}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.demoFastingGlucoseLabel")}
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder={t("onboarding.mgdl")}
                  />
                </div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.demo2hrGlucoseLabel")}
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder={t("onboarding.mgdl")}
                  />
                </div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    {t("onboarding.demoHba1cLabel")}
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder={t("onboarding.percent")}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface-2)] p-4 text-[0.82rem] text-[color:var(--color-ink-soft)]">
                {t("onboarding.demoDisclaimer")}
              </div>
            </>
          )}

          {error && <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{error}</div>}
        </div>

        <div className="flex flex-col gap-2.5 px-6 pb-7 pt-4">
          <button
            onClick={handleNext}
            disabled={
              (displayStep === 0 && !canContinueName) ||
              (isLive && displayStep === 3 && !canContinueAboutYou) ||
              (isLive && displayStep === 5 && !canFinishGoal) ||
              saving
            }
            className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white disabled:opacity-60"
          >
            {saving ? t("onboarding.saving") : displayStep === lastStep ? t("onboarding.getStarted") : t("onboarding.continue")}
          </button>
          {displayStep === lastStep && (!isLive || targetLbs.trim() !== "") && (
            <button
              onClick={handleSkip}
              disabled={saving}
              className="min-h-11 rounded-xl bg-transparent px-4 py-3.5 text-[0.92rem] font-semibold text-[color:var(--color-ink-faint)]"
            >
              {t("onboarding.skipForNow")}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
