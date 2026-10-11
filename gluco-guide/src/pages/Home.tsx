import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { ProgressRing } from "../components/ProgressRing"
import { useAppStore } from "../store/useAppStore"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useWaterToday } from "../hooks/useWaterToday"
import { useFiberSupplement } from "../hooks/useFiberSupplement"
import { useFoodLogsToday } from "../hooks/useFoodLogsToday"
import { useWellnessActivity } from "../hooks/useWellnessActivity"
import { useSleepLogs } from "../hooks/useSleepLogs"
import { useSupplements } from "../hooks/useSupplements"
import { useExerciseLogs } from "../hooks/useExerciseLogs"
import { usePersonalTargets } from "../hooks/usePersonalTargets"
import { useDailyEncouragement } from "../hooks/useDailyEncouragement"
import { LanguageSwitcher } from "../components/LanguageSwitcher"

const MIND_STRESS_TARGET = 2 // a couple of mindful moments a day — a goal, not a clinical benchmark
// CDC National DPP activity benchmark is 150 min/week, framed by the CDC
// itself as ~30 min/day, 5 days a week — same guideline, daily cadence,
// matching the Exercise screen.
const EXERCISE_DAILY_TARGET_MINUTES = 30

const quickAdd = [
  {
    labelKey: "home.quickAddItems.logFood",
    to: "/log",
    path: "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z",
    extra: <circle cx="12" cy="13" r="3.5" />,
  },
  {
    labelKey: "home.quickAddItems.scanGrocery",
    to: "/scan",
    path: "M7 8v8M10 8v8M13 8v3M13 13v3M16 8v8",
    extra: <rect x="3" y="6" width="18" height="12" rx="1.5" />,
  },
  {
    labelKey: "home.quickAddItems.logExercise",
    to: "/exercise",
    path: "M6.5 17.5l11-11M4 15l5 5M15 4l5 5M2.5 12.5l3-3M18.5 18.5l3-3",
  },
  {
    labelKey: "home.quickAddItems.logWaterFibre",
    to: "/hydration",
    path: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  },
  {
    labelKey: "home.quickAddItems.mindSleep",
    to: "/wellness",
    path: "M12 3a6 6 0 0 0 0 12 6 6 0 0 1 0 6 9 9 0 1 1 0-18z",
  },
  {
    labelKey: "home.quickAddItems.logSupplements",
    to: "/supplements",
    path: "M7 3.5h10a1 1 0 0 1 1 1V10a5 5 0 0 1-10 0V4.5a1 1 0 0 1 1-1z",
    extra: <path d="M9 20.5h6M12 15v5.5" />,
  },
]

function formatToday(locale: string) {
  return new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })
}

export function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const totals = useAppStore((s) => s.totals)
  const targets = usePersonalTargets()
  const demoReminder = useAppStore((s) => s.reminder)

  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const water = useWaterToday(selfMemberId)
  const supplement = useFiberSupplement(selfMemberId)
  const foodLogs = useFoodLogsToday(selfMemberId)
  const wellness = useWellnessActivity(selfMemberId)
  const sleep = useSleepLogs(selfMemberId)
  const supplements = useSupplements(selfMemberId)
  const exercise = useExerciseLogs(selfMemberId)

  const isLive = !!householdCtx
  const waterCups = isLive ? water.cupsToday : totals.waterCups
  const fiberG = isLive ? foodLogs.totals.fiberG : totals.fiberG
  const proteinG = isLive ? foodLogs.totals.proteinG : totals.proteinG
  const carbG = isLive ? foodLogs.totals.carbG : totals.carbG
  const fatG = isLive ? foodLogs.totals.fatG : totals.fatG
  const caloriesKcal = isLive ? foodLogs.totals.caloriesKcal : totals.caloriesKcal
  const calorieTarget = targets.caloriesKcal
  // "Mind/Sleep" bundles stress-relief activities and last night's sleep into
  // one ring — a logged sleep entry for today counts toward it just like a
  // stress-relief activity does, so logging sleep is actually visible here
  // instead of silently not moving the ring.
  const mindStressCount = isLive ? wellness.today.length + (sleep.loggedToday ? 1 : 0) : 0
  const supplementsTaken = isLive ? supplements.takenCount : 0
  const supplementsTarget = isLive ? Math.max(supplements.active.length, 1) : 1
  const exerciseTodayMinutes = isLive ? exercise.todayMinutes : 0
  const nextDoseLabel = isLive ? supplement.name : t("home.fiberSupplement")
  const doseTakenToday = isLive ? supplement.takenToday : demoReminder.takenToday
  // A brand-new live user who's never touched the picker gets shown psyllium
  // as a starting idea, not as something they chose — framed as a
  // suggestion until they actually tap something on Hydration (even
  // psyllium itself), which is when a real preference row exists.
  const hasFiberPreference = isLive ? supplement.hasPreference : true
  const isFiberSuggestion = isLive && !hasFiberPreference
  const fiberTimingNote = isLive ? supplement.timingNote : null
  const name = isLive ? householdCtx.household.selfMember.display_name : "Asha"

  const todayLoading =
    foodLogs.isLoading || water.isLoading || exercise.isLoading || wellness.isLoading || sleep.isLoading || supplements.isLoading
  const loggedAnythingToday =
    foodLogs.todaysFoods.length > 0 || waterCups > 0 || exerciseTodayMinutes > 0 || mindStressCount > 0 || supplementsTaken > 0
  const encouragement = useDailyEncouragement(
    selfMemberId,
    isLive && !todayLoading && loggedAnythingToday
      ? {
          caloriesKcal,
          calorieTarget,
          fiberG,
          fiberTarget: targets.fiberG,
          proteinG,
          proteinTarget: targets.proteinG,
          carbG,
          carbTarget: targets.carbG,
          fatG,
          fatTarget: targets.fatG,
          mealsLogged: foodLogs.todaysFoods.length,
          waterCups,
          waterTarget: targets.waterCups,
          exerciseMinutes: exerciseTodayMinutes,
          exerciseTarget: EXERCISE_DAILY_TARGET_MINUTES,
          mindActivities: wellness.today.length,
          sleepLogged: sleep.loggedToday,
          supplementsTaken,
          supplementsActive: supplements.active.length,
        }
      : null,
    i18n.language,
  )

  const hour = new Date().getHours()
  const greetingText = t(hour < 12 ? "home.greetingMorning" : hour < 18 ? "home.greetingAfternoon" : "home.greetingEvening")

  return (
    <Screen>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Eyebrow>{formatToday(i18n.language)}</Eyebrow>
          <h1 className="mt-1 text-2xl font-semibold">
            {greetingText}, {name}
          </h1>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <LanguageSwitcher />
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-3 gap-x-2 gap-y-4">
          <ProgressRing
            value={caloriesKcal}
            target={calorieTarget}
            label={t("home.rings.calories")}
            colorVar="--color-honey"
            bgVar="--color-honey-bg"
          />
          <ProgressRing
            value={fiberG}
            target={targets.fiberG}
            label={t("home.rings.fiber")}
            unit="g"
            colorVar="--color-sage"
            bgVar="--color-sage-bg"
          />
          <ProgressRing
            value={proteinG}
            target={targets.proteinG}
            label={t("home.rings.protein")}
            unit="g"
            colorVar="--color-mind"
            bgVar="--color-mind-bg"
          />
          <ProgressRing
            value={carbG}
            target={targets.carbG}
            label={t("home.rings.carbs")}
            unit="g"
            colorVar="--color-berry"
            bgVar="--color-berry-bg"
          />
          <ProgressRing
            value={fatG}
            target={targets.fatG}
            label={t("home.rings.fat")}
            unit="g"
            colorVar="--color-fat"
            bgVar="--color-fat-bg"
          />
          <ProgressRing
            value={waterCups}
            target={targets.waterCups}
            label={t("home.rings.water")}
            colorVar="--color-water"
            bgVar="--color-water-bg"
          />
          <ProgressRing
            value={mindStressCount}
            target={MIND_STRESS_TARGET}
            label={t("home.rings.mindSleep")}
            colorVar="--color-supp"
            bgVar="--color-supp-bg"
          />
          <ProgressRing
            value={supplementsTaken}
            target={supplementsTarget}
            label={t("home.rings.supplements")}
            colorVar="--color-supp"
            bgVar="--color-supp-bg"
          />
          <ProgressRing
            value={exerciseTodayMinutes}
            target={EXERCISE_DAILY_TARGET_MINUTES}
            label={t("home.rings.exerciseDay")}
            unit="m"
            colorVar="--color-move"
            bgVar="--color-move-bg"
          />
        </div>
      </Card>

      {isLive && !todayLoading && (!loggedAnythingToday || encouragement.message || encouragement.pending) && (
        <Card className="border-transparent bg-[color:var(--color-sage-bg)]">
          <div
            className={`text-[0.85rem] leading-relaxed ${
              loggedAnythingToday && !encouragement.message
                ? "motion-safe:animate-pulse text-[color:var(--color-ink-soft)]"
                : "text-[color:var(--color-ink)]"
            }`}
          >
            {!loggedAnythingToday
              ? t("home.encourageEmpty")
              : (encouragement.message ?? t("home.encouragementLoading"))}
          </div>
        </Card>
      )}

      <div>
        <Eyebrow>{t("home.quickAdd")}</Eyebrow>
        <div className="mt-2.5 grid grid-cols-3 gap-2.5">
          {quickAdd.map((item) => (
            <button
              key={item.labelKey}
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
                {t(item.labelKey)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {!doseTakenToday && (
      <Card>
        <Eyebrow>{isFiberSuggestion ? t("home.suggestedForYou") : t("home.upNext")}</Eyebrow>
        <button onClick={() => navigate("/hydration")} className="mt-2 flex w-full items-center gap-3 text-left">
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
                {nextDoseLabel}
              </div>
              <div className="text-[0.78rem] text-[color:var(--color-ink-soft)]">
                {fiberTimingNote ?? t("home.fullDetailIn")}
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
        </button>
      </Card>
      )}
    </Screen>
  )
}
