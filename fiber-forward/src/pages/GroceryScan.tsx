import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useAppStore } from "../store/useAppStore"
import { mockGroceryItems } from "../lib/mockData"

export function GroceryScan() {
  const navigate = useNavigate()
  const groceryIndex = useAppStore((s) => s.groceryIndex)
  const cycleGroceryItem = useAppStore((s) => s.cycleGroceryItem)
  const item = mockGroceryItems[groceryIndex]

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <Eyebrow>Scanned</Eyebrow>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          <Card>
            <div className="text-[0.72rem] font-bold text-[color:var(--color-ink-faint)]">{item.brand}</div>
            <h2 className="mt-1 text-[1.2rem] font-semibold">{item.name}</h2>
            <div className="mt-1.5 text-[0.78rem] text-[color:var(--color-ink-soft)]">{item.blurb}</div>

            <div className="relative my-4 h-2.5 rounded-md bg-gradient-to-r from-[color:var(--color-berry)] via-[color:var(--color-honey-bg)] to-[color:var(--color-sage)]">
              <div
                className="absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
                style={{ left: `${item.scoreFraction * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[0.66rem] font-bold text-[color:var(--color-ink-faint)]">
              <span>More refined carbs</span>
              <span>More fiber &amp; protein</span>
            </div>

            <div className="mt-3.5 flex gap-2">
              <MiniStat label="Fiber" value={`${item.fiberG}g`} colorVar="--color-sage" />
              <MiniStat label="Protein" value={`${item.proteinG}g`} colorVar="--color-honey" />
              <MiniStat label="Net carbs" value={`${item.netCarbG}g`} colorVar="--color-berry" />
            </div>
          </Card>

          <Card>
            <Eyebrow>Pair it with</Eyebrow>
            <div className="mt-2 text-[0.85rem] leading-relaxed">{item.pairSuggestion}</div>
          </Card>

          <Card>
            <Eyebrow>Try instead</Eyebrow>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-sage-bg)]">
                <svg width={22} height={22} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-sage)]">
                  <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-[0.86rem] font-bold">{item.swap.name}</div>
                <div className="mt-0.5 text-[0.72rem] text-[color:var(--color-ink-faint)]">
                  Fiber {item.swap.fiberG}g · Protein {item.swap.proteinG}g · Net carbs {item.swap.netCarbG}g
                </div>
              </div>
              <button className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.84rem] font-bold text-white">
                Add
              </button>
            </div>
          </Card>

          <button
            onClick={cycleGroceryItem}
            className="min-h-11 rounded-xl bg-[color:var(--color-surface-2)] px-4 py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
          >
            Scan another item
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, colorVar }: { label: string; value: string; colorVar: string }) {
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
