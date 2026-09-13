import { useState } from "react"
import { Card, Eyebrow, Screen } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockFoodSearchResults, mockPhotoRecognizedFood } from "../lib/mockData"

export function FoodLog() {
  const [tab, setTab] = useState<"photo" | "search">("photo")
  const addFoodToLog = useAppStore((s) => s.addFoodToLog)
  const [added, setAdded] = useState(false)

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
            onClick={() => setTab(t)}
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
            </div>
          </Card>
          <button
            onClick={() => {
              addFoodToLog(mockPhotoRecognizedFood)
              setAdded(true)
            }}
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
            defaultValue="lentil"
          />
          <Card className="p-0">
            {mockFoodSearchResults.map((food, i) => (
              <button
                key={food.id}
                onClick={() => addFoodToLog(food)}
                className={`w-full px-4 py-3 text-left ${
                  i < mockFoodSearchResults.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                }`}
              >
                <div className="text-[0.88rem] font-bold">{food.name}</div>
                <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                  Fiber {food.fiberG}g · Protein {food.proteinG}g · Carbs {food.carbG}g
                </div>
              </button>
            ))}
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
