import { useRef, useState } from "react"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockFoodSearchResults, mockPhotoRecognizedFood } from "../lib/mockData"
import { searchOpenNutrition } from "../lib/opennutrition"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useFoodLogsToday } from "../hooks/useFoodLogsToday"
import { MicButton } from "../components/MicButton"
import type { FoodItem } from "../lib/types"

// Standard Atwater factors. Carbs here means *total* carbohydrate (the
// way nutrition labels report it), which already includes fiber — so
// fiber isn't added again on top, only counted toward the fiber ring.
function calcCalories(proteinG: number, carbG: number, fatG: number) {
  return Math.round(proteinG * 4 + carbG * 4 + fatG * 9)
}

export function FoodLog() {
  const [tab, setTab] = useState<"photo" | "search" | "manual">("photo")
  const mockAddFoodToLog = useAppStore((s) => s.addFoodToLog)
  const [added, setAdded] = useState(false)

  const householdCtx = useOptionalHousehold()
  const selfMemberId = householdCtx?.household.selfMember.id
  const isLive = !!householdCtx
  const foodLogs = useFoodLogsToday(selfMemberId)

  const [query, setQuery] = useState("lentil")
  const [results, setResults] = useState<FoodItem[]>(mockFoodSearchResults)
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
      setResults(mockFoodSearchResults.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())))
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
      setSearchError(err instanceof Error ? err.message : "Search failed")
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

  async function handleAddFood(food: FoodItem, source: "photo" | "search" | "manual") {
    if (source === "search" && (addingId || justAddedId === food.id)) return
    setAddError(null)
    if (source === "search") setAddingId(food.id)
    try {
      if (isLive) {
        await foodLogs.addFood(food, source)
      } else {
        mockAddFoodToLog(food)
      }
      if (source === "search") setJustAddedId(food.id)
      else setAdded(true)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    } finally {
      if (source === "search") setAddingId(null)
    }
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
        mockAddFoodToLog(food)
      }
      setManualAdded(true)
      setManualName("")
      setManualFiber("")
      setManualProtein("")
      setManualCarb("")
      setManualFat("")
      setTimeout(() => setManualAdded(false), 2000)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't save that — try again.")
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
      setAddError(err instanceof Error ? err.message : "Couldn't remove that — try again.")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <Screen>
      <div>
        <Eyebrow>Log a meal</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">What are you eating?</h1>
      </div>

      <div className="flex gap-1.5 rounded-xl bg-[color:var(--color-surface-2)] p-1">
        {(["photo", "search", "manual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t)
              if (t === "search") void runSearch(query)
            }}
            className={`min-h-[38px] flex-1 rounded-lg text-center text-[0.86rem] font-bold capitalize ${
              tab === t
                ? "bg-[color:var(--color-surface)] text-[color:var(--color-sage)] shadow-sm"
                : "text-[color:var(--color-ink-faint)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {addError && (
        <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{addError}</div>
      )}

      {tab === "photo" ? (
        <>
          <div className="flex h-[190px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-[color:var(--color-line)] bg-gradient-to-br from-[color:var(--color-sage-bg)] to-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]">
            <svg
              width={30}
              height={30}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.6}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[color:var(--color-sage)]"
            >
              <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            <div className="text-[0.82rem] font-bold">Photo captured</div>
            <div className="px-6 text-center text-[0.68rem] text-[color:var(--color-ink-faint)]">
              Demo only for now — on-device food recognition is next on the roadmap
            </div>
          </div>
          <Card>
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-sage)]">
              Looks like
            </div>
            <h2 className="mt-1.5 text-[1.15rem] font-semibold">{mockPhotoRecognizedFood.name}</h2>
            <div className="mt-1 text-[0.8rem] text-[color:var(--color-ink-faint)]">
              {mockPhotoRecognizedFood.portion} · matched via nutrition database
            </div>
            <div className="mt-3.5 font-serif text-[1.5rem]">{mockPhotoRecognizedFood.caloriesKcal} kcal</div>
            <div className="mt-2.5 flex gap-2">
              <Stat label="Fiber" value={`${mockPhotoRecognizedFood.fiberG}g`} colorVar="--color-sage" />
              <Stat label="Protein" value={`${mockPhotoRecognizedFood.proteinG}g`} colorVar="--color-honey" />
              <Stat label="Carbs" value={`${mockPhotoRecognizedFood.carbG}g`} colorVar="--color-berry" />
              <Stat label="Fat" value={`${mockPhotoRecognizedFood.fatG}g`} colorVar="--color-fat" />
            </div>
          </Card>
          <button
            onClick={() => handleAddFood(mockPhotoRecognizedFood, "photo")}
            disabled={added}
            className={`min-h-11 rounded-xl px-4 py-3.5 text-[0.9rem] font-bold ${
              added
                ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                : "bg-[color:var(--color-sage)] text-white"
            }`}
          >
            {added ? "Added to today's log" : "Add to today's log"}
          </button>
        </>
      ) : tab === "search" ? (
        <>
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.92rem]"
              placeholder="Search foods"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
            <MicButton onResult={(text) => handleQueryChange(text)} />
          </div>
          {isLive && (
            <div className="text-[0.7rem] text-[color:var(--color-ink-faint)]">
              Nutrition data from{" "}
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
              <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">Searching…</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                No results yet
              </div>
            ) : (
              results.map((food, i) => {
                const isAdding = addingId === food.id
                const isAdded = justAddedId === food.id
                return (
                  <button
                    key={food.id}
                    onClick={() => handleAddFood(food, "search")}
                    disabled={isAdding || isAdded}
                    className={`w-full px-4 py-3 text-left ${
                      i < results.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                    } ${isAdded ? "bg-[color:var(--color-sage-bg)]" : ""}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="text-[0.88rem] font-bold">{food.name}</div>
                      {isAdded ? (
                        <div className="text-[0.8rem] font-bold text-[color:var(--color-sage)]">Added ✓</div>
                      ) : (
                        <div className="text-[0.8rem] font-bold text-[color:var(--color-ink-soft)]">
                          {isAdding ? "Adding…" : `${food.caloriesKcal} kcal`}
                        </div>
                      )}
                    </div>
                    <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                      Per {food.portion} — Fiber {food.fiberG}g · Protein {food.proteinG}g · Carbs {food.carbG}g · Fat{" "}
                      {food.fatG}g
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
              Can't find it in search? Enter what's on the label — we'll work out calories for you.
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              <div>
                <label className="text-[0.72rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Food name
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Mom's lentil curry"
                    className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                  />
                  <MicButton onResult={(text) => setManualName(text)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <NumberField label="Fiber (g)" value={manualFiber} onChange={setManualFiber} />
                <NumberField label="Protein (g)" value={manualProtein} onChange={setManualProtein} />
                <NumberField label="Total carbs (g)" value={manualCarb} onChange={setManualCarb} />
                <NumberField label="Fat (g)" value={manualFat} onChange={setManualFat} />
              </div>
              <div className="text-[0.68rem] text-[color:var(--color-ink-faint)]">
                Total carbs means the label's full "Total Carbohydrate" figure — it already includes fiber, so don't
                add fiber on top.
              </div>
              <div className="rounded-xl bg-[color:var(--color-sage-bg)] p-3 text-center">
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.05em] text-[color:var(--color-ink-faint)]">
                  Calculated calories
                </div>
                <div className="mt-0.5 font-serif text-[1.4rem]">{manualCalories} kcal</div>
              </div>
              {manualAdded && (
                <div className="text-center text-[0.8rem] font-bold text-[color:var(--color-sage)]">
                  Added to today's log ✓
                </div>
              )}
              <button
                onClick={handleAddManual}
                disabled={!manualName.trim() || manualSaving}
                className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white disabled:opacity-60"
              >
                {manualSaving ? "Saving…" : "Add to today's log"}
              </button>
            </div>
          </Card>
        </>
      )}

      {isLive && foodLogs.todaysFoods.length > 0 && (
        <div>
          <Eyebrow>Today's log</Eyebrow>
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
                    Per {entry.portion} — {entry.calories_kcal} kcal · Fiber {entry.fiber_g}g · Protein{" "}
                    {entry.protein_g}g
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFood(entry.id)}
                  disabled={removingId === entry.id}
                  aria-label={`Remove ${entry.name}`}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                >
                  {removingId === entry.id ? "…" : "Remove"}
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
