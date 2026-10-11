import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { demoFoodSearchResults } from "../lib/demoData"
import { searchOpenNutrition } from "../lib/opennutrition"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useFoodLogsToday } from "../hooks/useFoodLogsToday"
import { useMealPhotoAnalysis, useMealPhotoRefinement, type MealPhotoAnalysis } from "../hooks/useMealPhotoAnalysis"
import { PhotoCaptureButton } from "../components/PhotoCapture"
import type { FoodItem } from "../lib/types"

// Standard Atwater factors. Carbs here means *total* carbohydrate (the
// way nutrition labels report it), which already includes fiber — so
// fiber isn't added again on top, only counted toward the fiber ring.
function calcCalories(proteinG: number, carbG: number, fatG: number) {
  return Math.round(proteinG * 4 + carbG * 4 + fatG * 9)
}

function computeScoreFraction(fiberG: number, proteinG: number, netCarbG: number) {
  const score = (fiberG * 4 + proteinG * 2) / (fiberG * 4 + proteinG * 2 + netCarbG + 5)
  return Math.min(1, Math.max(0, score))
}

export function FoodLog() {
  const { t } = useTranslation()
  const NOT_SURE_ANSWER = t("foodLog.notSureAnswer")
  const [tab, setTab] = useState<"photo" | "search" | "manual">("photo")
  const demoAddFoodToLog = useAppStore((s) => s.addFoodToLog)

  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const isLive = !!householdCtx
  const foodLogs = useFoodLogsToday(selfMemberId)

  const [query, setQuery] = useState("lentil")
  const [results, setResults] = useState<FoodItem[]>(demoFoodSearchResults)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  // Tracks the most recently *dispatched* query so a slow, older request's
  // response can't clobber a newer one that already resolved — broad
  // queries (e.g. a single letter) can take longer than narrow ones, so
  // responses don't always arrive in the order they were sent.
  const latestQueryRef = useRef("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [photoAnalyzing, setPhotoAnalyzing] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [mealAnalysis, setMealAnalysis] = useState<MealPhotoAnalysis | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoAdding, setPhotoAdding] = useState(false)
  const mealPhotoAnalysis = useMealPhotoAnalysis()
  const mealPhotoRefinement = useMealPhotoRefinement()

  const [manualName, setManualName] = useState("")
  const [manualFiber, setManualFiber] = useState("")
  const [manualProtein, setManualProtein] = useState("")
  const [manualCarb, setManualCarb] = useState("")
  const [manualFat, setManualFat] = useState("")
  const [manualSaving, setManualSaving] = useState(false)
  const [manualAdded, setManualAdded] = useState(false)
  const manualCalories = calcCalories(Number(manualProtein) || 0, Number(manualCarb) || 0, Number(manualFat) || 0)

  async function runSearch(q: string) {
    latestQueryRef.current = q
    if (!isLive) {
      setResults(demoFoodSearchResults.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())))
      return
    }
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const found = await searchOpenNutrition(q)
      if (latestQueryRef.current !== q) return
      setResults(found)
    } catch (err) {
      if (latestQueryRef.current !== q) return
      setSearchError(err instanceof Error ? err.message : t("foodLog.searchFailed"))
    } finally {
      if (latestQueryRef.current === q) setSearching(false)
    }
  }

  function handleQueryChange(q: string) {
    setQuery(q)
    setJustAddedId(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(q), 250)
  }

  async function handleAddSearchResult(food: FoodItem) {
    if (addingId || justAddedId === food.id) return
    setAddError(null)
    setAddingId(food.id)
    try {
      if (isLive) {
        await foodLogs.addFood(food, "search")
      } else {
        demoAddFoodToLog(food)
      }
      setJustAddedId(food.id)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("common.genericError"))
    } finally {
      setAddingId(null)
    }
  }

  async function handlePhotoCaptured(dataUrl: string) {
    setMealAnalysis(null)
    setPhotoError(null)
    setCapturedPhoto(dataUrl)
    setPhotoAnalyzing(true)
    try {
      const result = await mealPhotoAnalysis.analyze(dataUrl)
      if (!result?.mealName || !result.estimatedMacros) {
        setPhotoError(t("foodLog.noMealFound"))
        return
      }
      setMealAnalysis(result)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("foodLog.photoAnalyzeFailed"))
    } finally {
      setPhotoAnalyzing(false)
      setCapturedPhoto(null)
    }
  }

  async function handleClarifyAnswer(answer: string) {
    if (!mealAnalysis?.clarifyingQuestion) return
    const question = mealAnalysis.clarifyingQuestion
    // "Not sure" needs no extra AI call — it just means keep the original
    // best-guess numbers already on mealAnalysis and stop asking.
    if (answer === NOT_SURE_ANSWER) {
      setMealAnalysis({ ...mealAnalysis, clarifyingQuestion: null })
      return
    }
    setPhotoError(null)
    try {
      const refined = await mealPhotoRefinement.refine({
        mealName: mealAnalysis.mealName,
        portionEstimate: mealAnalysis.portionEstimate,
        ingredients: mealAnalysis.ingredients,
        question: question.question,
        answer,
      })
      setMealAnalysis({ ...refined, clarifyingQuestion: null })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("foodLog.refineFailed"))
    }
  }

  async function handlePhotoAdd() {
    if (!mealAnalysis) return
    setPhotoAdding(true)
    setPhotoError(null)
    const macros = mealAnalysis.estimatedMacros
    const food: FoodItem = {
      id: `photo-${Date.now()}`,
      name: mealAnalysis.mealName,
      portion: mealAnalysis.portionEstimate,
      fiberG: macros.fiberG,
      proteinG: macros.proteinG,
      carbG: macros.carbG,
      fatG: macros.fatG,
      caloriesKcal: macros.caloriesKcal,
    }
    try {
      if (isLive) {
        await foodLogs.addFood(food, "photo")
      } else {
        demoAddFoodToLog(food)
      }
      setMealAnalysis(null)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("common.genericError"))
    } finally {
      setPhotoAdding(false)
    }
  }

  function handlePhotoSkip() {
    setMealAnalysis(null)
    setPhotoError(null)
  }

  async function handleAddManual() {
    if (!manualName.trim()) return
    setAddError(null)
    setManualSaving(true)
    const food: FoodItem = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      portion: "as entered",
      fiberG: Number(manualFiber) || 0,
      proteinG: Number(manualProtein) || 0,
      carbG: Number(manualCarb) || 0,
      fatG: Number(manualFat) || 0,
      caloriesKcal: manualCalories,
    }
    try {
      if (isLive) {
        await foodLogs.addFood(food, "manual")
      } else {
        demoAddFoodToLog(food)
      }
      setManualAdded(true)
      setManualName("")
      setManualFiber("")
      setManualProtein("")
      setManualCarb("")
      setManualFat("")
      setTimeout(() => setManualAdded(false), 2000)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("common.genericError"))
    } finally {
      setManualSaving(false)
    }
  }

  async function handleRemoveFood(id: string) {
    setAddError(null)
    setRemovingId(id)
    try {
      if (isLive) await foodLogs.removeFood(id)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t("foodLog.removeFailed"))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Screen>
      <div>
        <Eyebrow>{t("foodLog.eyebrow")}</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">{t("foodLog.title")}</h1>
      </div>

      <div className="flex gap-1.5 rounded-xl bg-[color:var(--color-surface-2)] p-1">
        {(["photo", "search", "manual"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => {
              setTab(tabKey)
              if (tabKey === "search") void runSearch(query)
            }}
            className={`min-h-[38px] flex-1 rounded-lg text-center text-[0.86rem] font-bold capitalize ${
              tab === tabKey
                ? "bg-[color:var(--color-surface)] text-[color:var(--color-sage)] shadow-sm"
                : "text-[color:var(--color-ink-faint)]"
            }`}
          >
            {t(`foodLog.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {addError && (
        <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{addError}</div>
      )}

      {tab === "photo" ? (
        <>
          {isLive ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <PhotoCaptureButton
                onCapture={(dataUrl) => void handlePhotoCaptured(dataUrl)}
                ariaLabel={t("foodLog.cameraLabel")}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-sage)] text-white shadow-sm"
              >
                <svg width={32} height={32} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .83-.45l.94-1.4a1 1 0 0 1 .83-.45h4.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
              </PhotoCaptureButton>
              <div className="text-center text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {t("foodLog.cameraCaption")}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
              {t("foodLog.setupAccountCamera")}
            </div>
          )}

          {photoAnalyzing && (
            <Card className="flex items-center gap-3">
              {capturedPhoto && (
                <img src={capturedPhoto} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              )}
              <div className="flex flex-col gap-0.5">
                <div className="text-[0.88rem] font-bold text-[color:var(--color-ink)]">
                  {t("foodLog.photoCaptured")}
                </div>
                <div className="flex items-center gap-1.5 text-[0.8rem] text-[color:var(--color-ink-soft)]">
                  <svg
                    className="h-3.5 w-3.5 shrink-0 animate-spin text-[color:var(--color-sage)]"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  {t("foodLog.analyzingPhoto")}
                </div>
              </div>
            </Card>
          )}

          {photoError && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{photoError}</div>
          )}

          {mealAnalysis && (
            <Card>
              <div className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-sage)]">
                {t("foodLog.looksLike")}
              </div>
              <h2 className="mt-1.5 text-[1.15rem] font-semibold">{mealAnalysis.mealName}</h2>
              <div className="mt-1 text-[0.8rem] text-[color:var(--color-ink-faint)]">{mealAnalysis.portionEstimate}</div>

              {mealAnalysis.clarifyingQuestion && (
                <div className="mt-3 rounded-xl border-[1.5px] border-[color:var(--color-honey)] bg-[color:var(--color-honey-bg)] p-3">
                  <div className="text-[0.85rem] font-bold leading-snug">{mealAnalysis.clarifyingQuestion.question}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[...mealAnalysis.clarifyingQuestion.options, NOT_SURE_ANSWER].map((option) => (
                      <button
                        key={option}
                        onClick={() => void handleClarifyAnswer(option)}
                        disabled={mealPhotoRefinement.refining}
                        className="min-h-9 rounded-full border-[1.5px] border-[color:var(--color-sage)] bg-[color:var(--color-surface)] px-3.5 text-[0.78rem] font-bold text-[color:var(--color-sage)] disabled:opacity-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {mealPhotoRefinement.refining && (
                    <div className="mt-2 text-[0.76rem] text-[color:var(--color-ink-faint)]">{t("foodLog.updatingEstimate")}</div>
                  )}
                  <div className="mt-2 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                    {t("foodLog.unconfirmedNote")}
                  </div>
                </div>
              )}

              <div className={mealAnalysis.clarifyingQuestion ? "pointer-events-none opacity-40" : ""}>
                {mealAnalysis.ingredients.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mealAnalysis.ingredients.map((ing, i) => (
                      <span
                        key={i}
                        className={`rounded-full px-2.5 py-1 text-[0.72rem] font-bold ${
                          ing.caution
                            ? "bg-[color:var(--color-berry-bg)] text-[color:var(--color-berry)]"
                            : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                        }`}
                        title={ing.note || undefined}
                      >
                        {ing.caution ? "⚠ " : ""}
                        {ing.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative my-3.5 h-2.5 rounded-md bg-gradient-to-r from-[color:var(--color-berry)] via-[color:var(--color-honey-bg)] to-[color:var(--color-sage)]">
                  <div
                    className="absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
                    style={{
                      left: `${
                        computeScoreFraction(
                          mealAnalysis.estimatedMacros.fiberG,
                          mealAnalysis.estimatedMacros.proteinG,
                          Math.max(0, mealAnalysis.estimatedMacros.carbG - mealAnalysis.estimatedMacros.fiberG),
                        ) * 100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[0.62rem] font-bold text-[color:var(--color-ink-faint)]">
                  <span>{t("foodLog.moreRefinedCarbs")}</span>
                  <span>{t("foodLog.moreFiberProtein")}</span>
                </div>

                <div className="mt-3 flex gap-2">
                  <Stat label={t("foodLog.stats.fiber")} value={`${mealAnalysis.estimatedMacros.fiberG}g`} colorVar="--color-sage" />
                  <Stat label={t("foodLog.stats.protein")} value={`${mealAnalysis.estimatedMacros.proteinG}g`} colorVar="--color-honey" />
                  <Stat
                    label={t("foodLog.stats.netCarbs")}
                    value={`${Math.max(0, mealAnalysis.estimatedMacros.carbG - mealAnalysis.estimatedMacros.fiberG)}g`}
                    colorVar="--color-berry"
                  />
                  <Stat label={t("foodLog.stats.fat")} value={`${mealAnalysis.estimatedMacros.fatG}g`} colorVar="--color-fat" />
                </div>
                <div className="mt-2 text-center font-serif text-[1.3rem]">{mealAnalysis.estimatedMacros.caloriesKcal} kcal</div>
                <div className="mt-1 text-center text-[0.62rem] text-[color:var(--color-ink-faint)]">
                  {t("common.aiEstimateDisclaimer")}
                </div>

                <div
                  className={`mt-3 text-[0.82rem] leading-relaxed ${
                    mealAnalysis.verdict === "caution"
                      ? "text-[color:var(--color-berry)]"
                      : mealAnalysis.verdict === "good"
                        ? "text-[color:var(--color-sage)]"
                        : "text-[color:var(--color-ink-soft)]"
                  }`}
                >
                  {mealAnalysis.verdict === "caution" ? "⚠ " : mealAnalysis.verdict === "good" ? "✓ " : ""}
                  {mealAnalysis.insight}
                </div>

                {mealAnalysis.nextTimeSuggestion && (
                  <div className="mt-3 rounded-xl bg-[color:var(--color-honey-bg)] p-3 text-[0.8rem] leading-relaxed">
                    <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                      {t("foodLog.nextTime")}
                    </div>
                    <div className="mt-1">{mealAnalysis.nextTimeSuggestion}</div>
                  </div>
                )}
              </div>

              <div className="mt-3.5 flex gap-2.5">
                <button
                  onClick={handlePhotoSkip}
                  disabled={photoAdding}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] px-4 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)] disabled:opacity-50"
                >
                  {t("foodLog.skip")}
                </button>
                <button
                  onClick={() => void handlePhotoAdd()}
                  disabled={photoAdding || !!mealAnalysis.clarifyingQuestion}
                  className="min-h-11 flex-[2] rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {photoAdding
                    ? t("foodLog.adding")
                    : mealAnalysis.clarifyingQuestion
                      ? t("foodLog.answerAboveToAdd")
                      : t("foodLog.addToLog")}
                </button>
              </div>
            </Card>
          )}
        </>
      ) : tab === "search" ? (
        <>
          <input
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.92rem]"
            placeholder={t("foodLog.searchPlaceholder")}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {isLive && (
            <div className="text-[0.7rem] text-[color:var(--color-ink-faint)]">
              {t("foodLog.nutritionDataFrom")}{" "}
              <a
                href="https://www.opennutrition.app"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                OpenNutrition
              </a>
            </div>
          )}
          {searchError && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{searchError}</div>
          )}
          <Card className="p-0">
            {searching ? (
              <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">{t("foodLog.searching")}</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                {t("foodLog.noResultsYet")}
              </div>
            ) : (
              results.map((food, i) => {
                const isAdding = addingId === food.id
                const isAdded = justAddedId === food.id
                return (
                  <button
                    key={food.id}
                    onClick={() => handleAddSearchResult(food)}
                    disabled={isAdding || isAdded}
                    className={`w-full px-4 py-3 text-left ${
                      i < results.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                    } ${isAdded ? "bg-[color:var(--color-sage-bg)]" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="text-[0.88rem] font-bold">{food.name}</div>
                      {isAdded ? (
                        <div className="text-[0.8rem] font-bold text-[color:var(--color-sage)]">{t("foodLog.added")}</div>
                      ) : (
                        <div className="text-[0.8rem] font-bold text-[color:var(--color-ink-soft)]">
                          {isAdding ? t("foodLog.adding") : `${food.caloriesKcal} kcal`}
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                      {t("foodLog.resultDetail", {
                        portion: food.portion,
                        fiber: food.fiberG,
                        protein: food.proteinG,
                        carb: food.carbG,
                        fat: food.fatG,
                      })}
                    </div>
                  </button>
                )
              })
            )}
          </Card>
        </>
      ) : (
        <>
          <Card>
            <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
              {t("foodLog.manualIntro")}
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("foodLog.foodNameLabel")}
                </label>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder={t("foodLog.foodNamePlaceholder")}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField label={t("foodLog.fiberG")} value={manualFiber} onChange={setManualFiber} />
                <NumberField label={t("foodLog.proteinG")} value={manualProtein} onChange={setManualProtein} />
                <NumberField label={t("foodLog.totalCarbsG")} value={manualCarb} onChange={setManualCarb} />
                <NumberField label={t("foodLog.fatG")} value={manualFat} onChange={setManualFat} />
              </div>
              <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                {t("foodLog.totalCarbsNote")}
              </div>
              <div className="rounded-xl bg-[color:var(--color-sage-bg)] p-3 text-center">
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  {t("foodLog.calculatedCalories")}
                </div>
                <div className="mt-0.5 font-serif text-[1.4rem]">{manualCalories} kcal</div>
              </div>
              {manualAdded && (
                <div className="text-center text-[0.8rem] font-bold text-[color:var(--color-sage)]">
                  {t("foodLog.addedToLog")}
                </div>
              )}
              <button
                onClick={handleAddManual}
                disabled={!manualName.trim() || manualSaving}
                className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white disabled:opacity-60"
              >
                {manualSaving ? t("common.saving") : t("foodLog.addToLog")}
              </button>
            </div>
          </Card>
        </>
      )}

      {isLive && foodLogs.todaysFoods.length > 0 && (
        <div>
          <Eyebrow>{t("foodLog.todaysLog")}</Eyebrow>
          <Card className="mt-2.5 p-0">
            {foodLogs.todaysFoods.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i < foodLogs.todaysFoods.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                }`}
              >
                <div>
                  <div className="text-[0.86rem] font-bold">{entry.name}</div>
                  <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                    {t("foodLog.todaysLogDetail", {
                      portion: entry.portion,
                      kcal: entry.calories_kcal,
                      fiber: entry.fiber_g,
                      protein: entry.protein_g,
                    })}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFood(entry.id)}
                  disabled={removingId === entry.id}
                  aria-label={t("foodLog.removeLabel", { name: entry.name })}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                >
                  {removingId === entry.id ? "…" : t("foodLog.remove")}
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

    </Screen>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
        {label}
      </label>
      <input
        type="number"
        min="0"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="mt-1.5 min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
      />
    </div>
  )
}

function Stat({ label, value, colorVar }: { label: string; value: string; colorVar: string }) {
  return (
    <div className="flex-1 rounded-xl bg-[color:var(--color-surface-2)] p-2.5 text-center">
      <div className="font-serif text-[1.1rem]" style={{ color: `var(${colorVar})` }}>
        {value}
      </div>
      <div className="mt-0.5 text-[0.66rem] font-bold uppercase tracking-[0.04em] text-[color:var(--color-ink-faint)]">
        {label}
      </div>
    </div>
  )
}
