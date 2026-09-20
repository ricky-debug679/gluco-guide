import { useNavigate } from "react-router-dom"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { ProgressRing } from "../components/ProgressRing"
import { useAppStore } from "../store/useAppStore"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useWaterToday } from "../hooks/useWaterToday"
import { useFiberSupplement } from "../hooks/useFiberSupplement"
import { useFoodLogsToday } from "../hooks/useFoodLogsToday"
import { useWellnessActivity } from "../hooks/useWellnessActivity"
import { useSupplements } from "../hooks/useSupplements"
import { buildCaloriePlan } from "../lib/caloriePlan"

const MIND_STRESS_TARGET = 2 // a couple of mindful moments a day — a goal, not a clinical benchmark

const quickAdd = [
  {
    label: "Log Food",
    to: "/log",
    path: "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z",
    extra: <circle cx="12" cy="13" r="3.5" />,
  },
  {
    label: "Scan Grocery",
    to: "/scan",
    path: "M7 8v8M10 8v8M13 8v3M13 13v3M16 8v8",
    extra: <rect x="3" y="6" width="18" height="12" rx="1.5" />,
  },
  {
    label: "Log Exercise",
    to: "/exercise",
    path: "M6.5 17.5l11-11M4 15l5 5M15 4l5 5M2.5 12.5l3-3M18.5 18.5l3-3",
  },
  {
    label: "Log Water/Fibre",
    to: "/hydration",
    path: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  },
  {
    label: "Mind & Sleep",
    to: "/wellness",
    path: "M12 3a6 6 0 0 0 0 12 6 6 0 0 1 0 6 9 9 0 1 1 0-18z",
  },
  {
    label: "Log Supplements",
    to: "/supplements",
    path: "M7 3.5h10a1 1 0 0 1 1 1V10a5 5 0 0 1-10 0V4.5a1 1 0 0 1 1-1z",
    extra: <path d="M9 20.5h6M12 15v5.5" />,
  },
]

function formatToday() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export function Home() {
  const navigate = useNavigate()
  const totals = useAppStore((s) => s.totals)
  const targets = useAppStore((s) => s.targets)
  const mockReminder = useAppStore((s) => s.reminder)

  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const water = useWaterToday(selfMemberId)
  const supplement = useFiberSupplement(selfMemberId)
  const foodLogs = useFoodLogsToday(selfMemberId)
  const wellness = useWellnessActivity(selfMemberId)
  const supplements = useSupplements(selfMemberId)

  const isLive = !!householdCtx
  const waterCups = isLive ? water.cupsToday : totals.waterCups
  const fiberG = isLive ? foodLogs.totals.fiberG : totals.fiberG
  const proteinG = isLive ? foodLogs.totals.proteinG : totals.proteinG
  const carbG = isLive ? foodLogs.totals.carbG : totals.carbG
  const fatG = isLive ? foodLogs.totals.fatG : totals.fatG
  const caloriesKcal = isLive ? foodLogs.totals.caloriesKcal : totals.caloriesKcal
  const selfMember = householdCtx?.household.selfMember
  const calorieTarget =
    isLive && selfMember?.height_cm && selfMember.weight_kg && selfMember.age && selfMember.biological_sex && selfMember.activity_level
      ? buildCaloriePlan({
          heightCm: selfMember.height_cm,
          weightKg: selfMember.weight_kg,
          age: selfMember.age,
          sex: selfMember.biological_sex,
          activityLevel: selfMember.activity_level,
        }).targetCalories
      : targets.caloriesKcal
  const mindStressCount = isLive ? wellness.today.length : 0
  const supplementsTaken = isLive ? supplements.takenCount : 0
  const supplementsTarget = isLive ? Math.max(supplements.active.length, 1) : 1
  const nextDoseLabel = isLive ? supplement.name : "Fiber supplement"
  const nextDoseTime = mockReminder.nextDoseTime
  const doseTakenToday = isLive ? supplement.takenToday : mockReminder.takenToday
  const name = isLive ? householdCtx.household.selfMember.display_name : "Asha"

  return (
    <Screen>
      <div>
        <Eyebrow>{formatToday()}</Eyebrow>
        <h1 className="mt-1 text-2xl font-semibold">
          {greeting()}, {name}
        </h1>
      </div>

      <Card>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          <ProgressRing
            value={caloriesKcal}
            target={calorieTarget}
            label="Calories"
            colorVar="--color-honey"
            bgVar="--color-honey-bg"
          />
          <ProgressRing
            value={fiberG}
            target={targets.fiberG}
            label="Fiber"
            unit="g"
            colorVar="--color-sage"
            bgVar="--color-sage-bg"
          />
          <ProgressRing
            value={proteinG}
            target={targets.proteinG}
            label="Protein"
            unit="g"
            colorVar="--color-mind"
            bgVar="--color-mind-bg"
          />
          <ProgressRing
            value={carbG}
            target={targets.carbG}
            label="Carbs"
            unit="g"
            colorVar="--color-berry"
            bgVar="--color-berry-bg"
          />
          <ProgressRing
            value={fatG}
            target={targets.fatG}
            label="Fat"
            unit="g"
            colorVar="--color-fat"
            bgVar="--color-fat-bg"
          />
          <ProgressRing
            value={waterCups}
            target={targets.waterCups}
            label="Water"
            colorVar="--color-water"
            bgVar="--color-water-bg"
          />
          <div className="col-span-3 flex justify-center gap-8">
            <ProgressRing
              value={mindStressCount}
              target={MIND_STRESS_TARGET}
              label="Mind/Sleep"
              colorVar="--color-supp"
              bgVar="--color-supp-bg"
            />
            <ProgressRing
              value={supplementsTaken}
              target={supplementsTarget}
              label="Supplements"
              colorVar="--color-supp"
              bgVar="--color-supp-bg"
            />
          </div>
        </div>
      </Card>

      <Card className="border-transparent bg-[color:var(--color-sage-bg)]">
        <div className="text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
          {isLive
            ? fiberG > 0
              ? "Nice work logging today — every fiber-forward choice adds up."
              : "Log your first meal today to start building your fiber trend."
            : "Your fiber intake is up from last week — nice work keeping breakfast fiber-forward."}
        </div>
      </Card>

      <div>
        <Eyebrow>Quick add</Eyebrow>
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {quickAdd.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.to)}
              className="flex min-h-11 flex-col items-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3.5 text-center"
            >
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[color:var(--color-sage)]"
              >
                <path d={item.path} />
                {item.extra}
              </svg>
              <span className="text-[0.66rem] font-bold leading-tight text-[color:var(--color-ink-soft)]">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!doseTakenToday && (
      <button onClick={() => navigate("/hydration")} className="text-left">
        <Card className="cursor-pointer">
          <Eyebrow>Up next</Eyebrow>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--color-honey-bg)]">
              <svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.8}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[color:var(--color-honey)]"
              >
                <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[0.92rem] font-bold">
                {nextDoseLabel} — {nextDoseTime}
              </div>
              <div className="text-[0.78rem] text-[color:var(--color-ink-soft)]">
                Full detail in Water &amp; Fiber
              </div>
            </div>
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-[color:var(--color-ink-faint)]"
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </Card>
      </button>
      )}
    </Screen>
  )
}
