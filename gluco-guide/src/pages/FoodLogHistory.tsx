import { useNavigate } from "react-router-dom"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { HistoryChart } from "../components/HistoryChart"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { usePersonalTargets } from "../hooks/usePersonalTargets"
import { buildHistoryDays, parseLocalDate, type HistoryDay } from "../lib/history"
import { useFoodLogHistory, type DayTotals } from "../hooks/useFoodLogHistory"
import { useWaterHistory } from "../hooks/useWaterHistory"
import { useExerciseHistory } from "../hooks/useExerciseHistory"
import { useSleepLogs } from "../hooks/useSleepLogs"
import { useSupplementHistory } from "../hooks/useSupplementHistory"
import { useHistorySummary } from "../hooks/useHistorySummary"

const WATER_TARGET_CUPS = 8 // mirrors Hydration.tsx's WATER_TARGET
const EXERCISE_DAILY_TARGET_MINUTES = 30 // mirrors Exercise.tsx's DAILY_TARGET_MINUTES
const SLEEP_REFERENCE_HOURS = 8 // a typical healthy-range reference, not a strict pass/fail goal

const foodMetrics = [
  { key: "fiberG", labelKey: "home.rings.fiber", unit: "g", colorVar: "--color-sage" },
  { key: "proteinG", labelKey: "home.rings.protein", unit: "g", colorVar: "--color-honey" },
  { key: "carbG", labelKey: "home.rings.carbs", unit: "g", colorVar: "--color-berry" },
  { key: "caloriesKcal", labelKey: "home.rings.calories", unit: " kcal", colorVar: "--color-mind" },
] as const

type FoodMetricKey = (typeof foodMetrics)[number]["key"]

const areaKeys = ["food", "water", "exercise", "sleep", "supplements"] as const
type Area = (typeof areaKeys)[number]

function foodDaysToHistoryDays(days: DayTotals[], key: FoodMetricKey): HistoryDay[] {
  return days.map((d) => ({ date: d.date, value: d[key], hasEntry: d.entries.length > 0 }))
}

export function FoodLogHistory() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMember = householdCtx?.household.selfMember
  const selfMemberId = selfMember?.id

  const foodHistory = useFoodLogHistory(selfMemberId)
  const waterHistory = useWaterHistory(selfMemberId)
  const exerciseHistory = useExerciseHistory(selfMemberId)
  const sleep = useSleepLogs(selfMemberId)
  const supplementHistory = useSupplementHistory(selfMemberId)
  const targets = usePersonalTargets()
  const cupsUnit = ` ${t("units.cups")}`
  const minutesUnit = ` ${t("units.minutes")}`
  const hoursUnit = ` ${t("units.hours")}`
  const calorieTarget = targets.caloriesKcal

  const goalsByMetric: Record<FoodMetricKey, number> = {
    fiberG: targets.fiberG,
    proteinG: targets.proteinG,
    carbG: targets.carbG,
    caloriesKcal: calorieTarget,
  }

  const [area, setArea] = useState<Area>("food")
  const [foodMetricKey, setFoodMetricKey] = useState<FoodMetricKey>("fiberG")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [summaryExpanded, setSummaryExpanded] = useState(true)

  function handleAreaChange(next: Area) {
    setArea(next)
    setSelectedDate(null)
  }

  const foodMetric = foodMetrics.find((m) => m.key === foodMetricKey)!
  const foodGoal = goalsByMetric[foodMetricKey]
  const foodChartDays = foodDaysToHistoryDays(foodHistory.days, foodMetricKey)

  // sleep_logs has one row per calendar day max (unique constraint), so each
  // bucket has at most one entry — just read its hours straight through.
  const sleepChartDays: HistoryDay[] = buildHistoryDays(
    sleep.entries,
    (e) => parseLocalDate(e.logged_at),
    (dayRows) => (dayRows.length > 0 ? Number(dayRows[0].hours) : 0),
  )

  const noEntryLabel = t("foodLogHistory.noEntryLogged")
  const metGoalLabel = t("foodLogHistory.metGoalLegend")
  const belowGoalLabel = t("foodLogHistory.belowGoalLegend")
  const axisNoteLabel = t("foodLogHistory.axisNote")

  function dayStatusText(goal: number, unit: string) {
    return (day: HistoryDay) =>
      t("foodLogHistory.dayStatus", {
        value: day.value,
        unit,
        arrow: day.value >= goal ? "▲" : "▼",
        diff: Math.abs(day.value - goal),
        status: t(day.value >= goal ? "foodLogHistory.above" : "foodLogHistory.below"),
      })
  }

  // --- AI summary aggregation ---
  const foodLoggedDays = foodHistory.days.filter((d) => d.entries.length > 0)
  const avgOverLoggedDays = (values: number[]) =>
    values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0

  const waterLoggedDays = waterHistory.days.filter((d) => d.hasEntry)
  const exerciseActiveDays = exerciseHistory.days.filter((d) => d.hasEntry)

  const sleepQualityCounts = {
    poor: sleep.entries.filter((e) => e.quality === "poor").length,
    okay: sleep.entries.filter((e) => e.quality === "okay").length,
    good: sleep.entries.filter((e) => e.quality === "good").length,
    great: sleep.entries.filter((e) => e.quality === "great").length,
  }

  const summaryInput = isLive
    ? {
        language: i18n.language,
        food: {
          daysLogged: foodLoggedDays.length,
          avgFiberG: avgOverLoggedDays(foodLoggedDays.map((d) => d.fiberG)),
          fiberTarget: targets.fiberG,
          avgProteinG: avgOverLoggedDays(foodLoggedDays.map((d) => d.proteinG)),
          proteinTarget: targets.proteinG,
          avgCarbG: avgOverLoggedDays(foodLoggedDays.map((d) => d.carbG)),
          carbTarget: targets.carbG,
          avgCaloriesKcal: avgOverLoggedDays(foodLoggedDays.map((d) => d.caloriesKcal)),
          calorieTarget,
        },
        water: {
          daysLogged: waterLoggedDays.length,
          avgCupsOnLoggedDays: avgOverLoggedDays(waterLoggedDays.map((d) => d.value)),
          target: WATER_TARGET_CUPS,
        },
        exercise: {
          daysActive: exerciseActiveDays.length,
          avgMinutesOnActiveDays: avgOverLoggedDays(exerciseActiveDays.map((d) => d.value)),
          totalMinutes: exerciseHistory.days.reduce((s, d) => s + d.value, 0),
          windowDays: exerciseHistory.days.length,
          dailyTarget: EXERCISE_DAILY_TARGET_MINUTES,
          // The real CDC goal is weekly (150 min/week) — dailyTarget above is
          // just a pacing guide derived from it, not the actual target. Sent
          // separately so the AI judges real progress against the real goal
          // instead of a single strong day vs. the daily pacing number.
          weeklyTarget: EXERCISE_DAILY_TARGET_MINUTES * 5,
        },
        sleep: {
          daysLogged: sleep.entries.length,
          avgHours: avgOverLoggedDays(sleep.entries.map((e) => Number(e.hours))),
          qualityCounts: sleepQualityCounts,
        },
        supplements: {
          activeCount: supplementHistory.activeCount,
          dosesTaken: supplementHistory.dosesTaken,
          dosesPossible: supplementHistory.dosesPossible,
        },
      }
    : null

  const summary = useHistorySummary(selfMemberId, summaryInput)

  const supplementsPct =
    supplementHistory.dosesPossible > 0 ? Math.round((supplementHistory.dosesTaken / supplementHistory.dosesPossible) * 100) : 0

  return (
    <Screen>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Eyebrow>{t("foodLogHistory.eyebrow")}</Eyebrow>
          <h1 className="mt-1.5 text-[1.4rem] font-semibold">{t("foodLogHistory.title")}</h1>
        </div>
        <button
          onClick={() => navigate("/log")}
          className="min-h-9 shrink-0 rounded-xl bg-[color:var(--color-sage)] px-3.5 text-[0.78rem] font-bold text-white"
        >
          {t("foodLogHistory.logAMeal")}
        </button>
      </div>

      {!isLive ? (
        <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
          {t("foodLogHistory.setupAccount")}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {areaKeys.map((a) => (
              <button
                key={a}
                onClick={() => handleAreaChange(a)}
                className={`min-h-10 rounded-[11px] px-3.5 text-[0.78rem] font-bold ${
                  a === area
                    ? "bg-[color:var(--color-sage)] text-white"
                    : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                }`}
              >
                {t(`foodLogHistory.area${a.charAt(0).toUpperCase()}${a.slice(1)}`)}
              </button>
            ))}
          </div>

          {area === "food" && (
            <>
              <div className="flex gap-1.5">
                {foodMetrics.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setFoodMetricKey(m.key)}
                    className={`min-h-10 flex-1 rounded-[11px] text-[0.78rem] font-bold ${
                      m.key === foodMetricKey
                        ? "bg-[color:var(--color-sage)] text-white"
                        : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                    }`}
                  >
                    {t(m.labelKey)}
                  </button>
                ))}
              </div>

              <Card>
                <div className="flex items-baseline justify-between">
                  <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">
                    {t("foodLogHistory.last14Days", { metric: t(foodMetric.labelKey) })}
                  </div>
                  <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                    {t("foodLogHistory.goalPerDay", { goal: foodGoal, unit: foodMetric.unit })}
                  </div>
                </div>
                <HistoryChart
                  days={foodChartDays}
                  goal={foodGoal}
                  unit={foodMetric.unit}
                  colorVar={foodMetric.colorVar}
                  locale={i18n.language}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  noEntryLabel={noEntryLabel}
                  metGoalLabel={metGoalLabel}
                  belowGoalLabel={belowGoalLabel}
                  axisNoteLabel={axisNoteLabel}
                  dayStatusText={dayStatusText(foodGoal, foodMetric.unit)}
                />
              </Card>
            </>
          )}

          {area === "water" && (
            <Card>
              <div className="flex items-baseline justify-between">
                <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.last14Days", { metric: t("foodLogHistory.areaWater") })}
                </div>
                <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.goalPerDay", { goal: WATER_TARGET_CUPS, unit: cupsUnit })}
                </div>
              </div>
              <HistoryChart
                days={waterHistory.days}
                goal={WATER_TARGET_CUPS}
                unit={cupsUnit}
                colorVar="--color-water"
                locale={i18n.language}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                noEntryLabel={noEntryLabel}
                metGoalLabel={metGoalLabel}
                belowGoalLabel={belowGoalLabel}
                axisNoteLabel={axisNoteLabel}
                dayStatusText={dayStatusText(WATER_TARGET_CUPS, cupsUnit)}
              />
            </Card>
          )}

          {area === "exercise" && (
            <Card>
              <div className="flex items-baseline justify-between">
                <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.last14Days", { metric: t("foodLogHistory.areaExercise") })}
                </div>
                <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.goalPerDay", { goal: EXERCISE_DAILY_TARGET_MINUTES, unit: minutesUnit })}
                </div>
              </div>
              <HistoryChart
                days={exerciseHistory.days}
                goal={EXERCISE_DAILY_TARGET_MINUTES}
                unit={minutesUnit}
                colorVar="--color-move"
                locale={i18n.language}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                noEntryLabel={noEntryLabel}
                metGoalLabel={metGoalLabel}
                belowGoalLabel={belowGoalLabel}
                axisNoteLabel={axisNoteLabel}
                dayStatusText={dayStatusText(EXERCISE_DAILY_TARGET_MINUTES, minutesUnit)}
              />
            </Card>
          )}

          {area === "sleep" && (
            <Card>
              <div className="flex items-baseline justify-between">
                <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.last14Days", { metric: t("foodLogHistory.areaSleep") })}
                </div>
                <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                  {t("foodLogHistory.goalPerDay", { goal: SLEEP_REFERENCE_HOURS, unit: hoursUnit })}
                </div>
              </div>
              <HistoryChart
                days={sleepChartDays}
                goal={SLEEP_REFERENCE_HOURS}
                unit={hoursUnit}
                colorVar="--color-supp"
                locale={i18n.language}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                noEntryLabel={noEntryLabel}
                metGoalLabel={metGoalLabel}
                belowGoalLabel={belowGoalLabel}
                axisNoteLabel={axisNoteLabel}
                dayStatusText={dayStatusText(SLEEP_REFERENCE_HOURS, hoursUnit)}
              />
            </Card>
          )}

          {area === "supplements" && (
            <Card>
              <div className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]">
                {t("foodLogHistory.last14Days", { metric: t("foodLogHistory.areaSupplements") })}
              </div>
              {supplementHistory.activeCount === 0 ? (
                <div className="mt-2 text-[0.85rem] text-[color:var(--color-ink-soft)]">
                  {t("foodLogHistory.noSupplementsTracked")}
                </div>
              ) : (
                <div className="mt-2 text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
                  {t("foodLogHistory.supplementsStat", {
                    count: supplementHistory.activeCount,
                    taken: supplementHistory.dosesTaken,
                    possible: supplementHistory.dosesPossible,
                    pct: supplementsPct,
                  })}
                </div>
              )}
            </Card>
          )}

          <Card>
            <button
              onClick={() => setSummaryExpanded((v) => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <div className="text-[0.92rem] font-bold">{t("foodLogHistory.summary.title")}</div>
                {!summaryExpanded && summary.data && (
                  <div className="mt-0.5 text-[0.76rem] text-[color:var(--color-ink-faint)]">
                    {t("foodLogHistory.summary.collapsedHint")}
                  </div>
                )}
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
                className={`shrink-0 text-[color:var(--color-ink-faint)] transition-transform ${summaryExpanded ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {summaryExpanded && (
              <>
                {summary.data && (
                  <div className="mt-1 flex items-baseline justify-between">
                    <div className="text-[0.78rem] text-[color:var(--color-ink-faint)]">
                      {t("foodLogHistory.summary.subtitle")}
                    </div>
                    <button
                      onClick={() => void summary.generate()}
                      disabled={summary.isLoading}
                      className="shrink-0 text-[0.74rem] font-bold text-[color:var(--color-sage)] disabled:opacity-50"
                    >
                      {t("foodLogHistory.summary.refresh")}
                    </button>
                  </div>
                )}
                {!summary.data && (
                  <div className="mt-1 text-[0.78rem] text-[color:var(--color-ink-faint)]">
                    {t("foodLogHistory.summary.subtitle")}
                  </div>
                )}

                {!summary.data && !summary.isLoading && (
                  <button
                    onClick={() => void summary.generate()}
                    className="mt-3 min-h-11 w-full rounded-xl bg-[color:var(--color-sage)] text-[0.85rem] font-bold text-white"
                  >
                    {t("foodLogHistory.summary.button")}
                  </button>
                )}

                {summary.isLoading && (
                  <div className="mt-3 flex items-center gap-1.5 text-[0.82rem] text-[color:var(--color-ink-faint)]">
                    <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--color-sage)]" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    {t("foodLogHistory.summary.loading")}
                  </div>
                )}

                {summary.error && (
                  <div className="mt-3 rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.8rem]">{summary.error}</div>
                )}

                {summary.data && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="rounded-xl bg-[color:var(--color-sage-bg)] p-3">
                      <div className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-sage)]">
                        {t("foodLogHistory.summary.doingWellLabel")}
                      </div>
                      <div className="mt-1 text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
                        {summary.data.doingWell}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[color:var(--color-honey-bg)] p-3">
                      <div className="text-[0.7rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-honey)]">
                        {t("foodLogHistory.summary.improveLabel")}
                      </div>
                      <div className="mt-1 text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
                        {summary.data.improve}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  )
}
