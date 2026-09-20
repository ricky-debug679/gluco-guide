import { useState } from "react"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockFoodSearchResults, mockPhotoRecognizedFood } from "../lib/mockData"
import { searchFoods, usdaConfigured } from "../lib/usda"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useFoodLogsToday } from "../hooks/useFoodLogsToday"
import type { FoodItem } from "../lib/types"

export function FoodLog() {
  const [tab, setTab] = useState<"photo" | "search">("photo")
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

  async function runSearch(q: string) {
    setQuery(q)
    if (!isLive || !usdaConfigured) {
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
      const found = await searchFoods(q)
      setResults(found)
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  async function handleAddFood(food: FoodItem, source: "photo" | "search") {
    setAddError(null)
    try {
      if (isLive) {
        await foodLogs.addFood(food, source)
      } else {
        mockAddFoodToLog(food)
      }
      setAdded(true)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  return (
    <Screen>
      <div>
        <Eyebrow>Log a meal</Eyebrow>
        <h1 className="mt-1.5 text-[1.4rem] font-semibold">What are you eating?</h1>
      </div>

      <div className="flex gap-1.5 rounded-xl bg-[color:var(--color-surface-2)] p-1">
        {(["photo", "search"] as const).map((t) => (
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
            <div className="mt-3.5 flex gap-2">
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
      ) : (
        <>
          <input
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.92rem]"
            placeholder="Search foods"
            value={query}
            onChange={(e) => void runSearch(e.target.value)}
          />
          {isLive && !usdaConfigured && (
            <div className="text-[0.76rem] text-[color:var(--color-ink-faint)]">
              USDA search isn't configured yet — showing sample results.
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
              results.map((food, i) => (
                <button
                  key={food.id}
                  onClick={() => handleAddFood(food, "search")}
                  className={`w-full px-4 py-3 text-left ${
                    i < results.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                  }`}
                >
                  <div className="text-[0.88rem] font-bold">{food.name}</div>
                  <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                    Fiber {food.fiberG}g · Protein {food.proteinG}g · Carbs {food.carbG}g · Fat {food.fatG}g
                  </div>
                </button>
              ))
            )}
          </Card>
        </>
      )}
    </Screen>
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
