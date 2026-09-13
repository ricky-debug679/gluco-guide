import { useNavigate } from "react-router-dom"
import { useAppStore } from "../store/useAppStore"

const goals = [
  "Reverse prediabetes",
  "Prevent diabetes in my family",
  "Support a family member",
  "General wellness",
]

export function Onboarding() {
  const navigate = useNavigate()
  const onboarding = useAppStore((s) => s.onboarding)
  const setName = useAppStore((s) => s.onboardingSetName)
  const setGoal = useAppStore((s) => s.onboardingSetGoal)
  const setLabs = useAppStore((s) => s.onboardingSetLabs)
  const advance = useAppStore((s) => s.onboardingAdvance)
  const complete = useAppStore((s) => s.onboardingComplete)

  const { step } = onboarding

  function handleNext() {
    if (step === 2) {
      complete()
      navigate("/")
      return
    }
    advance()
  }

  function handleSkip() {
    complete()
    navigate("/")
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2 px-5 pt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full bg-[color:var(--color-line)] transition-all ${
                i === step ? "w-5 bg-[color:var(--color-sage)]" : "w-2"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-7">
          {step === 0 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Welcome
                </div>
                <h1 className="mt-2 text-[1.7rem] font-semibold">Let's set up your plan.</h1>
                <div className="mt-2 text-[0.92rem] text-[color:var(--color-ink-soft)]">
                  A few quick questions so your fiber, protein, and carb targets fit you.
                </div>
              </div>
              <div>
                <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  What should we call you?
                </label>
                <input
                  className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                  value={onboarding.name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <div className="text-[0.78rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                  Step 2 of 3
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
                    onClick={() => setGoal(i)}
                    className={`min-h-11 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-[0.9rem] font-bold ${
                      onboarding.goalIndex === i
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

          {step === 2 && (
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
                    value={onboarding.fastingGlucose}
                    onChange={(e) => setLabs(e.target.value, onboarding.hbA1c)}
                  />
                </div>
                <div>
                  <label className="text-[0.76rem] font-bold uppercase tracking-[0.06em] text-[color:var(--color-ink-faint)]">
                    HbA1c
                  </label>
                  <input
                    className="mt-2 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-[0.95rem]"
                    placeholder="%"
                    value={onboarding.hbA1c}
                    onChange={(e) => setLabs(onboarding.fastingGlucose, e.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-2xl bg-[color:var(--color-surface-2)] p-4 text-[0.82rem] text-[color:var(--color-ink-soft)]">
                This helps personalize your targets. Not a diagnosis — always confirm changes with your
                doctor.
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2.5 px-6 pb-7 pt-4">
          <button
            onClick={handleNext}
            className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.92rem] font-bold text-white"
          >
            {step === 2 ? "Get started" : "Continue"}
          </button>
          {step === 2 && (
            <button
              onClick={handleSkip}
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
