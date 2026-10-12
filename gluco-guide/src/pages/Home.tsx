import { useEffect, useState, type ComponentProps } from "react"
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
import { resolveTrackedAreas, type TrackedArea } from "../lib/trackedAreas"
import { LanguageSwitcher } from "../components/LanguageSwitcher"

const MIND_STRESS_TARGET = 2 // a couple of mindful moments a day — a goal, not a clinical benchmark
// CDC National DPP activity benchmark is 150 min/week, framed by the CDC
// itself as ~30 min/day, 5 days a week — same guideline, daily cadence,
// matching the Exercise screen.
const EXERCISE_DAILY_TARGET_MINUTES = 30
// Set once the first-day checklist is finished or hidden; a per-device
// convenience, so it never needs the database.
const START_HERE_DONE_KEY = "glucoguide_start_here_done"

function readStartHereDone() {
  try {
    return localStorage.getItem(START_HERE_DONE_KEY) === "1"
  } catch {
    return false
  }
}

function saveStartHereDone() {
  try {
    localStorage.setItem(START_HERE_DONE_KEY, "1")
  } catch {
    // Storage blocked: the card just shows again next visit.
  }
}

function formatToday(locale: string) {
  return new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" })
}

type RingProps = ComponentProps<typeof ProgressRing>
interface RingItem extends RingProps {
  key: string
  to: string
  /** Optional area this ring belongs to; food rings have none and always show. */
  area?: TrackedArea
}

export function Home() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const totals = useAppStore((s) => s.totals)
  const targets = usePersonalTargets()
  const demoReminder = useAppStore((s) => s.reminder)

  const householdCtx = useOptionalHousehold()
  const selfMember = householdCtx?.household.selfMember
  const selfMemberId = selfMember?.id
  const water = useWaterToday(selfMemberId)
  const supplement = useFiberSupplement(selfMemberId)
  const foodLogs = useFoodLogsToday(selfMemberId)
  const wellness = useWellnessActivity(selfMemberId)
  const sleep = useSleepLogs(selfMemberId)
  const supplements = useSupplements(selfMemberId)
  const exercise = useExerciseLogs(selfMemberId)

  const [showAllRings, setShowAllRings] = useState(false)
  const [startHereDone, setStartHereDone] = useState(readStartHereDone)

  const isLive = !!householdCtx
  const tracked = resolveTrackedAreas(selfMember?.tracked_areas)
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
  const name = isLive ? selfMember!.display_name : "Asha"

  const todayLoading =
    foodLogs.isLoading || water.isLoading || exercise.isLoading || wellness.isLoading || sleep.isLoading || supplements.isLoading
  const loggedAnythingToday =
    foodLogs.todaysFoods.length > 0 || waterCups > 0 || exerciseTodayMinutes > 0 || mindStressCount > 0 || supplementsTaken > 0

  // First-day checklist: a meal, then up to two of the areas this person tracks.
  const startHereTasks = [
    { key: "meal", done: foodLogs.todaysFoods.length > 0, to: "/log" },
    tracked.has("waterFiber") && { key: "water", done: waterCups > 0, to: "/hydration" },
    tracked.has("exercise") && { key: "exercise", done: exerciseTodayMinutes > 0, to: "/exercise" },
    tracked.has("mindSleep") && { key: "mind", done: mindStressCount > 0, to: "/wellness" },
  ]
    .filter((task): task is { key: string; done: boolean; to: string } => !!task)
    .slice(0, 3)
  const startHereComplete = startHereTasks.every((task) => task.done)
  const showStartHere = isLive && !todayLoading && !startHereDone && !startHereComplete

  // Finishing every task already hides the card this visit; remember it so
  // it stays gone on later days too.
  useEffect(() => {
    if (isLive && !todayLoading && startHereComplete) saveStartHereDone()
  }, [isLive, todayLoading, startHereComplete])

  function hideStartHere() {
    saveStartHereDone()
    setStartHereDone(true)
  }

  // Not requested while the Start here card is up: that card replaces the
  // message, so asking the AI then would be a paid call nobody sees.
  const encouragement = useDailyEncouragement(
    selfMemberId,
    isLive && !todayLoading && loggedAnythingToday && !showStartHere
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

  // Every ring opens the screen where you add to it. The first three are the
  // daily basics; the rest sit behind "See all" so a new user isn't faced with
  // nine numbers at once.
  const allRings: RingItem[] = [
    { key: "calories", to: "/log", value: caloriesKcal, target: calorieTarget, label: t("home.rings.calories"), colorVar: "--color-honey", bgVar: "--color-honey-bg" },
    { key: "fiber", to: "/hydration", value: fiberG, target: targets.fiberG, label: t("home.rings.fiber"), unit: "g", colorVar: "--color-sage", bgVar: "--color-sage-bg" },
    { key: "water", to: "/hydration", area: "waterFiber", value: waterCups, target: targets.waterCups, label: t("home.rings.water"), colorVar: "--color-water", bgVar: "--color-water-bg" },
    { key: "protein", to: "/log", value: proteinG, target: targets.proteinG, label: t("home.rings.protein"), unit: "g", colorVar: "--color-mind", bgVar: "--color-mind-bg" },
    { key: "carbs", to: "/log", value: carbG, target: targets.carbG, label: t("home.rings.carbs"), unit: "g", colorVar: "--color-berry", bgVar: "--color-berry-bg" },
    { key: "fat", to: "/log", value: fatG, target: targets.fatG, label: t("home.rings.fat"), unit: "g", colorVar: "--color-fat", bgVar: "--color-fat-bg" },
    { key: "exercise", to: "/exercise", area: "exercise", value: exerciseTodayMinutes, target: EXERCISE_DAILY_TARGET_MINUTES, label: t("home.rings.exerciseDay"), unit: t("units.minutesShort"), colorVar: "--color-move", bgVar: "--color-move-bg" },
    { key: "mindSleep", to: "/wellness", area: "mindSleep", value: mindStressCount, target: MIND_STRESS_TARGET, label: t("home.rings.mindSleep"), colorVar: "--color-supp", bgVar: "--color-supp-bg" },
    { key: "supplements", to: "/supplements", area: "supplements", value: supplementsTaken, target: supplementsTarget, label: t("home.rings.supplements"), colorVar: "--color-supp", bgVar: "--color-supp-bg" },
  ]
  const rings = allRings.filter((ring) => !ring.area || tracked.has(ring.area))
  const mainRings = rings.slice(0, 3)
  const moreRings = rings.slice(3)

  const hour = new Date().getHours()
  const greetingText = t(hour < 12 ? "home.greetingMorning" : hour < 18 ? "home.greetingAfternoon" : "home.greetingEvening")

  function renderRing({ key, to, area: _area, ...ringProps }: RingItem) {
    return (
      <button
        key={key}
        onClick={() => navigate(to)}
        className="flex justify-center rounded-2xl py-1 active:bg-[color:var(--color-surface-2)]"
      >
        <ProgressRing {...ringProps} />
      </button>
    )
  }

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

      {showStartHere && (
        <Card className="flex flex-col gap-3 border-transparent bg-[color:var(--color-sage-bg)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[1rem] font-bold">{t("home.startHere.title")}</div>
              <div className="mt-0.5 text-[0.82rem] text-[color:var(--color-ink-soft)]">{t("home.startHere.subtitle")}</div>
            </div>
            <button
              onClick={hideStartHere}
              className="min-h-11 shrink-0 px-1 text-[0.8rem] font-semibold text-[color:var(--color-ink-faint)]"
            >
              {t("home.startHere.hide")}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {startHereTasks.map((task) => (
              <button
                key={task.key}
                onClick={() => navigate(task.to)}
                disabled={task.done}
                className="flex min-h-11 items-center gap-3 rounded-xl bg-[color:var(--color-surface)] px-3.5 py-2.5 text-left disabled:opacity-70"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    task.done
                      ? "border-[color:var(--color-sage)] bg-[color:var(--color-sage)] text-white"
                      : "border-[color:var(--color-line)]"
                  }`}
                >
                  {task.done && (
                    <svg width={14} height={14} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  )}
                </span>
                <span className={`flex-1 text-[0.9rem] font-bold ${task.done ? "line-through text-[color:var(--color-ink-faint)]" : ""}`}>
                  {t(`home.startHere.${task.key}`)}
                </span>
                {!task.done && (
                  <svg width={18} height={18} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--color-ink-faint)]">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}

      {isLive && !todayLoading && !showStartHere && (!loggedAnythingToday || encouragement.message || encouragement.pending) && (
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

      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          {mainRings.map(renderRing)}
          {showAllRings && moreRings.map(renderRing)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[0.76rem] text-[color:var(--color-ink-faint)]">{t("home.tapRingHint")}</div>
          {moreRings.length > 0 && (
            <button
              onClick={() => setShowAllRings((v) => !v)}
              className="min-h-11 shrink-0 px-1 text-[0.8rem] font-bold text-[color:var(--color-sage)]"
            >
              {showAllRings ? t("home.seeLess") : t("home.seeAll", { count: moreRings.length })}
            </button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => navigate("/log")}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-sage)] px-3 py-3.5 text-[0.9rem] font-bold text-white"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          {t("home.logMeal")}
        </button>
        <button
          onClick={() => navigate("/scan")}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3 py-3.5 text-[0.9rem] font-bold text-[color:var(--color-ink-soft)]"
        >
          <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-sage)]">
            <rect x="3" y="6" width="18" height="12" rx="1.5" />
            <path d="M7 8v8M10 8v8M13 8v3M13 13v3M16 8v8" />
          </svg>
          {t("home.checkGroceries")}
        </button>
      </div>

      {!doseTakenToday && !showStartHere && tracked.has("waterFiber") && (
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
