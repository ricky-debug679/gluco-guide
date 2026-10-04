import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useLogGroceryScan } from "../hooks/useGroceryScans"
import { useGroceryList, type GroceryListAnalysis } from "../hooks/useGroceryList"
import { searchGroceries, type GroceryResult } from "../lib/openFoodFacts"
import { mockGroceryItems } from "../lib/mockData"

function fromMock(item: (typeof mockGroceryItems)[number]): GroceryResult {
  return {
    id: item.id,
    brand: item.brand,
    name: item.name,
    fiberG: item.fiberG,
    proteinG: item.proteinG,
    netCarbG: item.netCarbG,
    scoreFraction: item.scoreFraction,
    blurb: item.blurb,
    pairSuggestion: item.pairSuggestion,
  }
}

export function GroceryScan() {
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
  const selfMemberId = householdCtx?.household.selfMember.id
  const logScan = useLogGroceryScan(selfMemberId)
  const groceryList = useGroceryList(householdCtx?.household.householdId, selfMemberId)

  const [tab, setTab] = useState<"scan" | "list">("scan")
  const [newItemName, setNewItemName] = useState("")
  const [listError, setListError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<GroceryListAnalysis | null>(null)

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GroceryResult[]>(isLive ? [] : mockGroceryItems.map(fromMock))
  const [selected, setSelected] = useState<GroceryResult | null>(isLive ? null : mockGroceryItems.map(fromMock)[0])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function runSearch(q: string) {
    setQuery(q)
    setAdded(false)
    if (!isLive) {
      const filtered = mockGroceryItems.map(fromMock).filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
      setResults(filtered)
      return
    }
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const found = await searchGroceries(q)
      setResults(found)
    } catch (err) {
      setResults([])
      setSearchError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd() {
    if (!selected) return
    setAddError(null)
    try {
      if (isLive) await logScan.mutateAsync(selected)
      setAdded(true)
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleAddListItem() {
    if (!newItemName.trim()) return
    setListError(null)
    try {
      if (isLive) await groceryList.addItem(newItemName.trim())
      setNewItemName("")
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleToggleItem(id: string, checked: boolean) {
    setListError(null)
    try {
      if (isLive) await groceryList.toggleChecked(id, checked)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleRemoveItem(id: string) {
    setListError(null)
    try {
      if (isLive) await groceryList.removeItem(id)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't remove that — try again.")
    }
  }

  async function handleAnalyzeList() {
    setListError(null)
    setAnalysis(null)
    try {
      const result = await groceryList.analyze(groceryList.items.map((i) => i.name))
      setAnalysis(result)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't analyze your list — try again.")
    }
  }

  function flagFor(name: string) {
    return analysis?.itemFlags.find((f) => f.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(f.name.toLowerCase()))
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label="Back" className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <Eyebrow>Grocery check</Eyebrow>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-1.5 rounded-xl bg-[color:var(--color-surface-2)] p-1">
            {(["scan", "list"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`min-h-[38px] flex-1 rounded-lg text-center text-[0.86rem] font-bold ${
                  tab === t
                    ? "bg-[color:var(--color-surface)] text-[color:var(--color-sage)] shadow-sm"
                    : "text-[color:var(--color-ink-faint)]"
                }`}
              >
                {t === "scan" ? "Scan" : "My List"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          {tab === "scan" ? (
          <>
          <input
            className="min-h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.92rem]"
            placeholder="Search a product, e.g. wheat bread"
            value={query}
            onChange={(e) => void runSearch(e.target.value)}
          />

          {searchError && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{searchError}</div>
          )}

          {!selected && (
            <div className="flex flex-col gap-2">
              {searching && (
                <div className="p-2 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">Searching…</div>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setSelected(r)
                    setAdded(false)
                  }}
                  className="rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-left"
                >
                  <div className="text-[0.86rem] font-bold">{r.name}</div>
                  {r.brand && <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">{r.brand}</div>}
                </button>
              ))}
              {!searching && query && results.length === 0 && (
                <div className="p-2 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                  No results yet
                </div>
              )}
            </div>
          )}

          {selected && (
            <>
              <Card>
                {selected.brand && (
                  <div className="text-[0.72rem] font-bold text-[color:var(--color-ink-faint)]">{selected.brand}</div>
                )}
                <h2 className="mt-1 text-[1.2rem] font-semibold">{selected.name}</h2>
                <div className="mt-1.5 text-[0.78rem] text-[color:var(--color-ink-soft)]">{selected.blurb}</div>

                <div className="relative my-4 h-2.5 rounded-md bg-gradient-to-r from-[color:var(--color-berry)] via-[color:var(--color-honey-bg)] to-[color:var(--color-sage)]">
                  <div
                    className="absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
                    style={{ left: `${selected.scoreFraction * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[0.66rem] font-bold text-[color:var(--color-ink-faint)]">
                  <span>More refined carbs</span>
                  <span>More fiber &amp; protein</span>
                </div>

                <div className="mt-3.5 flex gap-2">
                  <MiniStat label="Fiber" value={`${selected.fiberG}g`} colorVar="--color-sage" />
                  <MiniStat label="Protein" value={`${selected.proteinG}g`} colorVar="--color-honey" />
                  <MiniStat label="Net carbs" value={`${selected.netCarbG}g`} colorVar="--color-berry" />
                </div>
                <div className="mt-2 text-[0.66rem] text-[color:var(--color-ink-faint)]">Per 100g</div>
              </Card>

              <Card>
                <Eyebrow>Pair it with</Eyebrow>
                <div className="mt-2 text-[0.85rem] leading-relaxed">{selected.pairSuggestion}</div>
              </Card>

              {addError && (
                <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{addError}</div>
              )}

              <button
                onClick={handleAdd}
                disabled={added}
                className={`min-h-11 rounded-xl px-4 py-3.5 text-[0.9rem] font-bold ${
                  added
                    ? "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-soft)]"
                    : "bg-[color:var(--color-sage)] text-white"
                }`}
              >
                {added ? "Added to your scan history" : "Add to scan history"}
              </button>
              <button
                onClick={() => {
                  setSelected(null)
                  setAdded(false)
                }}
                className="min-h-11 rounded-xl bg-[color:var(--color-surface-2)] px-4 py-3 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)]"
              >
                Search another item
              </button>
            </>
          )}
          </>
          ) : (
          <>
            <Card>
              <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                Build your shopping list, then let AI flag anything worth a second look and suggest healthier ways
                to combine what you've got.
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddListItem()}
                  placeholder="e.g. coke, olive oil, potatoes"
                  className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                />
                <button
                  onClick={handleAddListItem}
                  disabled={!newItemName.trim()}
                  className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            </Card>

            {listError && (
              <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{listError}</div>
            )}

            {groceryList.items.length > 0 ? (
              <Card className="p-0">
                {groceryList.items.map((item, i) => {
                  const flag = flagFor(item.name)
                  return (
                    <div
                      key={item.id}
                      className={`px-4 py-3 ${
                        i < groceryList.items.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                          className="h-5 w-5 shrink-0 accent-[color:var(--color-sage)]"
                        />
                        <div
                          className={`flex-1 text-[0.9rem] font-bold ${
                            item.checked ? "text-[color:var(--color-ink-faint)] line-through" : ""
                          }`}
                        >
                          {item.name}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="shrink-0 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                        >
                          Remove
                        </button>
                      </div>
                      {flag && (
                        <div
                          className={`mt-1.5 ml-8 text-[0.76rem] ${
                            flag.verdict === "caution"
                              ? "text-[color:var(--color-berry)]"
                              : "text-[color:var(--color-sage)]"
                          }`}
                        >
                          {flag.verdict === "caution" ? "⚠ " : "✓ "}
                          {flag.note}
                        </div>
                      )}
                    </div>
                  )
                })}
              </Card>
            ) : (
              <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                Your list is empty — add a few items above.
              </div>
            )}

            {groceryList.items.length > 0 && (
              <button
                onClick={handleAnalyzeList}
                disabled={groceryList.analyzing}
                className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white disabled:opacity-60"
              >
                {groceryList.analyzing ? "Analyzing…" : "✨ Analyze my list"}
              </button>
            )}

            {analysis && analysis.combinationTips.length > 0 && (
              <Card className="border-transparent bg-[color:var(--color-honey-bg)]">
                <Eyebrow>Suggestions</Eyebrow>
                <div className="mt-2 flex flex-col gap-2.5">
                  {analysis.combinationTips.map((tip, i) => (
                    <div key={i} className="text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
                      <span className="font-bold">Looks like you're making {tip.dish} —</span> {tip.tip}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
          )}
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
