import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAppStore } from "../store/useAppStore"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useCompleteProfile } from "../hooks/useHousehold"
import { supabase } from "../lib/supabase"
import {
  activityLabels,
  buildCaloriePlan,
  feetInchesToCm,
  lbsToKg,
  type ActivityLevel,
  type BiologicalSex,
} from "../lib/caloriePlan"

const goals = [
  "Reverse prediabetes",
  "Prevent diabetes in my family",
  "Support a family member",
  "General wellness",
]

export function Onboarding() {
  const navigate = useNavigate()

  // Mock-data path (no backend configured)
  const mockOnboarding = useAppStore((s) => s.onboarding)
  const setMockName = useAppStore((s) => s.onboardingSetName)
  const setMockGoal = useAppStore((s) => s.onboardingSetGoal)
  const advanceMock = useAppStore((s) => s.onboardingAdvance)
  const completeMock = useAppStore((s) => s.onboardingComplete)

  // Real-data path
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const completeProfile = useCompleteProfile(householdCtx?.household.selfMember.id)

  const [step, setStep] = useState(0)
  const [name, setName] = useState(householdCtx?.household.selfMember.display_name ?? "")
  const [goalIndex, setGoalIndex] = useState<number | null>(null)
  const [heightFeet, setHeightFeet] = useState("5")
  const [heightInches, setHeightInches] = useState("4")
  const [weightLbs, setWeightLbs] = useState("160")
  const [age, setAge] = useState("30")
  const [sex, setSex] = useState<BiologicalSex | null>(null)
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [fastingGlucose, setFastingGlucose] = useState("")
  const [hbA1c, setHbA1c] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastStep = isLive ? 3 : 2

  const canContinueAboutYou = isLive
    ? Boolean(heightFeet && weightLbs && age && sex && activityLevel)
    : true

  const plan =
    isLive && sex && activityLevel && heightFeet && weightLbs && age
      ? buildCaloriePlan({
          heightCm: feetInchesToCm(Number(heightFeet), Number(heightInches) || 0),
          weightKg: lbsToKg(Number(weightLbs)),
          age: Number(age),
          sex,
          activityLevel,
        })
      : null

  async function handleFinish() {
    if (!isLive || !sex || !activityLevel) {
      completeMock()
      navigate("/")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await completeProfile.mutateAsync({
        displayName: name.trim() || householdCtx!.household.selfMember.display_name,
        goal: goalIndex !== null ? goals[goalIndex] : "General wellness",
        heightCm: feetInchesToCm(Number(heightFeet), Number(heightInches) || 0),
        weightKg: lbsToKg(Number(weightLbs)),
        age: Number(age),
        sex,
        activityLevel,
      })

      if (supabase && (fastingGlucose || hbA1c)) {
        const memberId = householdCtx!.household.selfMember.id
        const today = new Date().toISOString().slice(0, 10)
        if (fastingGlucose) {
          await supabase.from("biometric_readings").insert({
            member_id: memberId,
            metric_key: "glucose",
            value: Number(fastingGlucose),
            recorded_at: today,
          })
        }
        if (hbA1c) {
          await supabase.from("biometric_readings").insert({
            member_id: memberId,
            metric_key: "a1c",
            value: Number(hbA1c),
            recorded_at: today,
          })
        }
      }

      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      setSaving(false)
    }
  }

  function handleNext() {
    if (!isLive) {
      // original mock flow, unchanged
      if (step === 2) {
        completeMock()
        navigate("/")
        return
      }
      advanceMock()
      setStep((s) => Math.min(2, s + 1))
      return
    }

    if (step === lastStep) {
      void handleFinish()
      return
    }
    setStep((s) => Math.min(lastStep, s + 1))
  }

  function handleSkip() {
    if (!isLive) {
      completeMock()
      navigate("/")
      return
    }
    void handleFinish()
  }

  const displayStep = isLive ? step : mockOnboarding.step
  const displayGoalIndex = isLive ? goalIndex : mockOnboarding.goalIndex

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
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-7">
          {displayStep === 0 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Welcome
                </div>
                <h1 className="mt-2 text-[1.7rem] font-semibold">Let's set up your plan.</h1>
                <div className="mt-2 text-[0.92rem] text-[color:var(--color-ink-soft)]">
                  A few quick questions so your targets actually fit you.
                </div>
              </div>
              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  What should we call you?
                </label>
                <input
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  value={isLive ? name : mockOnboarding.name}
                  onChange={(e) => (isLive ? setName(e.target.value) : setMockName(e.target.value))}
                />
              </div>
            </>
          )}

          {displayStep === 1 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Step 2 of {lastStep + 1}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">What brings you here?</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  Pick what fits best — you can change this anytime.
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {goals.map((goal, i) => (
                  <button
                    key={goal}
                    onClick={() => (isLive ? setGoalIndex(i) : setMockGoal(i))}
                    className={`min-h-11 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-[0.9rem] font-bold ${
                      displayGoalIndex === i
                        ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)] text-[color:var(--color-sage)]"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-ink-soft)]"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </>
          )}

          {isLive && displayStep === 2 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Step 3 of {lastStep + 1}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">About you</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  This builds your BMI and a real calorie estimate — not just a guess. Age and sex are
                  only used for that calculation.
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Height
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
                      ft
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
                      in
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    Weight (lb)
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
                    Age
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
                  Biological sex (for the calorie estimate)
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
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Activity level
                </label>
                <div className="mt-2 flex flex-col gap-2">
                  {activityLabels.map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setActivityLevel(a.key)}
                      className={`min-h-11 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left ${
                        activityLevel === a.key
                          ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage-bg)]"
                          : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
                      }`}
                    >
                      <div className="text-[0.86rem] font-bold">{a.label}</div>
                      <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">{a.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Recent labs? (optional)
                </label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <input
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder="Glucose mg/dL"
                    value={fastingGlucose}
                    onChange={(e) => setFastingGlucose(e.target.value)}
                  />
                  <input
                    className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder="HbA1c %"
                    value={hbA1c}
                    onChange={(e) => setHbA1c(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {isLive && displayStep === 3 && plan && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Step 4 of {lastStep + 1}
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">Your plan</h1>
              </div>

              <div className="rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                    Your BMI
                  </div>
                  <div className="font-serif text-[1.6rem]">{plan.bmi.toFixed(1)}</div>
                </div>
                <div className="mt-1 text-[0.85rem] capitalize text-[color:var(--color-ink-soft)]">
                  {plan.category === "healthy" ? "In the healthy range" : `Category: ${plan.category}`}
                </div>
              </div>

              <div className="rounded-2xl bg-[color:var(--color-sage-bg)] p-4">
                <div className="text-[0.8rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Daily calorie target
                </div>
                <div className="mt-1 font-serif text-[1.8rem]">{plan.targetCalories.toLocaleString()} kcal</div>
                <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                  Estimated maintenance: {plan.maintenanceCalories.toLocaleString()} kcal
                </div>
                <div className="mt-2.5 text-[0.85rem] leading-relaxed">{plan.message}</div>
              </div>

              <div className="rounded-2xl bg-[color:var(--color-surface-2)] p-4 text-[0.8rem] leading-relaxed text-[color:var(--color-ink-soft)]">
                This is a general estimate assuming the activity level you picked — not a diagnosis.
                Always confirm before changing your diet significantly, especially alongside diabetes
                medication.
              </div>
            </>
          )}

          {!isLive && mockOnboarding.step === 2 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Step 3 of 3
                </div>
                <h1 className="mt-2 text-[1.5rem] font-semibold">Recent labs? (optional)</h1>
                <div className="mt-2 text-[0.9rem] text-[color:var(--color-ink-soft)]">
                  If you have a recent result handy, add it now — you can always do this later from
                  Trends.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    Fasting glucose
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder="mg/dL"
                  />
                </div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    HbA1c
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder="%"
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface-2)] p-4 text-[0.82rem] text-[color:var(--color-ink-soft)]">
                This helps personalize your targets. Not a diagnosis — always confirm changes with your
                doctor.
              </div>
            </>
          )}

          {error && <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{error}</div>}
        </div>

        <div className="flex flex-col gap-2.5 px-6 pb-7 pt-4">
          <button
            onClick={handleNext}
            disabled={(isLive && displayStep === 2 && !canContinueAboutYou) || saving}
            className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : displayStep === lastStep ? "Get started" : "Continue"}
          </button>
          {!isLive && displayStep === lastStep && (
            <button
              onClick={handleSkip}
              disabled={saving}
              className="min-h-11 rounded-xl bg-transparent px-4 py-3.5 text-[0.92rem] font-semibold text-[color:var(--color-ink-faint)]"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
