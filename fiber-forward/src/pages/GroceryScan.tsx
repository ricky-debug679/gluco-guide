import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import { useLogGroceryScan } from "../hooks/useGroceryScans"
import {
  useGroceryLists,
  useGroceryListItems,
  useGroceryFavorites,
  type GroceryListAnalysis,
} from "../hooks/useGroceryList"
import { buildGroceryTrendChart } from "../lib/groceryTrend"
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
  const householdId = householdCtx?.household.householdId
  const groceryLists = useGroceryLists(householdId)
  const groceryItems = useGroceryListItems(householdId)
  const favorites = useGroceryFavorites(householdId)

  const [tab, setTab] = useState<"scan" | "list">("scan")
  const [listView, setListView] = useState<"current" | "history" | "favorites">("current")
  const [newItemName, setNewItemName] = useState("")
  const [newFavoriteName, setNewFavoriteName] = useState("")
  const [listError, setListError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<GroceryListAnalysis | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const activeList = groceryLists.activeList
  const activeItems = activeList?.items ?? []
  const trend = buildGroceryTrendChart(groceryLists.lists)

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

  async function ensureActiveList(): Promise<string | null> {
    if (activeList) return activeList.id
    return (await groceryLists.createList()) ?? null
  }

  async function handleAddListItem() {
    if (!newItemName.trim()) return
    setListError(null)
    try {
      if (isLive) {
        const listId = await ensureActiveList()
        if (listId) await groceryItems.addItem(listId, newItemName.trim())
      }
      setNewItemName("")
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleStartNewList() {
    setListError(null)
    try {
      if (isLive) await groceryLists.createList()
      setAnalysis(null)
      setSelectMode(false)
      setSelectedIds(new Set())
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't start a new list — try again.")
    }
  }

  async function handleToggleItem(id: string, checked: boolean) {
    setListError(null)
    try {
      if (isLive) await groceryItems.toggleChecked(id, checked)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleRemoveItem(id: string) {
    setListError(null)
    try {
      if (isLive) await groceryItems.removeMany([id])
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't remove that — try again.")
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === activeItems.length ? new Set() : new Set(activeItems.map((i) => i.id))))
  }

  async function handleRemoveSelected() {
    setListError(null)
    try {
      if (isLive) await groceryItems.removeMany(Array.from(selectedIds))
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't remove those — try again.")
    }
  }

  async function handleAnalyzeList() {
    setListError(null)
    setAnalysis(null)
    try {
      const result = await groceryItems.analyze(activeItems.map((i) => i.name))
      setAnalysis(result)
      if (activeList) await groceryItems.saveVerdicts(activeItems, result.itemFlags)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't analyze your list — try again.")
    }
  }

  function isFavorite(name: string) {
    return favorites.favorites.some((f) => f.name.toLowerCase() === name.toLowerCase())
  }

  async function handleToggleFavorite(name: string) {
    setListError(null)
    try {
      if (!isLive) return
      const existing = favorites.favorites.find((f) => f.name.toLowerCase() === name.toLowerCase())
      if (existing) await favorites.removeFavorite(existing.id)
      else await favorites.addFavorite(name)
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't update favorites — try again.")
    }
  }

  async function handleAddFavorite() {
    if (!newFavoriteName.trim()) return
    setListError(null)
    try {
      if (isLive) await favorites.addFavorite(newFavoriteName.trim())
      setNewFavoriteName("")
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't save that — try again.")
    }
  }

  async function handleAddFavoritesToList() {
    setListError(null)
    try {
      if (isLive && favorites.favorites.length > 0) {
        const listId = await ensureActiveList()
        if (listId) await groceryItems.addManyItems(listId, favorites.favorites.map((f) => f.name))
      }
      setListView("current")
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Couldn't add those — try again.")
    }
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
            <div className="flex gap-1.5">
              {(["current", "history", "favorites"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setListView(v)}
                  className={`min-h-9 flex-1 rounded-lg text-[0.76rem] font-bold ${
                    listView === v
                      ? "bg-[color:var(--color-sage)] text-white"
                      : "bg-[color:var(--color-surface-2)] text-[color:var(--color-ink-faint)]"
                  }`}
                >
                  {v === "current" ? "Current" : v === "history" ? "History" : "Favorites"}
                </button>
              ))}
            </div>

            {listError && (
              <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{listError}</div>
            )}

            {listView === "current" && (
              <>
                <Card>
                  <div className="flex items-baseline justify-between">
                    <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                      {activeList
                        ? `Started ${new Date(activeList.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                        : "Build your shopping list, then let AI flag anything worth a second look."}
                    </div>
                    <button
                      onClick={handleStartNewList}
                      className="shrink-0 text-[0.76rem] font-bold text-[color:var(--color-sage)]"
                    >
                      + Start new list
                    </button>
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

                {activeItems.length > 0 && (
                  <div className="flex items-center justify-between px-1">
                    {selectMode ? (
                      <>
                        <label className="flex items-center gap-2 text-[0.8rem] font-bold text-[color:var(--color-ink-soft)]">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === activeItems.length}
                            onChange={toggleSelectAll}
                            className="h-5 w-5 accent-[color:var(--color-sage)]"
                          />
                          Select all ({selectedIds.size})
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              setSelectMode(false)
                              setSelectedIds(new Set())
                            }}
                            className="text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleRemoveSelected}
                            disabled={selectedIds.size === 0}
                            className="text-[0.78rem] font-bold text-[color:var(--color-berry)] disabled:opacity-40"
                          >
                            Remove ({selectedIds.size})
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        onClick={() => setSelectMode(true)}
                        className="ml-auto text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                      >
                        Select
                      </button>
                    )}
                  </div>
                )}

                {activeItems.length > 0 ? (
                  <Card className="p-0">
                    {activeItems.map((item, i) => (
                      <div
                        key={item.id}
                        className={`px-4 py-3 ${
                          i < activeItems.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectMode ? selectedIds.has(item.id) : item.checked}
                            onChange={(e) =>
                              selectMode ? toggleSelected(item.id) : handleToggleItem(item.id, e.target.checked)
                            }
                            className="h-5 w-5 shrink-0 accent-[color:var(--color-sage)]"
                          />
                          <div
                            className={`flex-1 text-[0.9rem] font-bold ${
                              item.checked && !selectMode ? "text-[color:var(--color-ink-faint)] line-through" : ""
                            }`}
                          >
                            {item.name}
                          </div>
                          {!selectMode && (
                            <>
                              <button
                                onClick={() => handleToggleFavorite(item.name)}
                                aria-label={isFavorite(item.name) ? "Remove from favorites" : "Save as favorite"}
                                className={`shrink-0 text-[0.9rem] ${
                                  isFavorite(item.name)
                                    ? "text-[color:var(--color-honey)]"
                                    : "text-[color:var(--color-ink-faint)]"
                                }`}
                              >
                                {isFavorite(item.name) ? "★" : "☆"}
                              </button>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                aria-label={`Remove ${item.name}`}
                                className="shrink-0 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                        {item.verdict && (
                          <div
                            className={`mt-1.5 ml-8 text-[0.76rem] ${
                              item.verdict === "caution"
                                ? "text-[color:var(--color-berry)]"
                                : "text-[color:var(--color-sage)]"
                            }`}
                          >
                            {item.verdict === "caution" ? "⚠ " : "✓ "}
                            {item.note}
                          </div>
                        )}
                      </div>
                    ))}
                  </Card>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    Your list is empty — add a few items above, or add your{" "}
                    <button onClick={() => setListView("favorites")} className="font-bold text-[color:var(--color-sage)]">
                      favorites
                    </button>
                    .
                  </div>
                )}

                {activeItems.length > 0 && !selectMode && (
                  <button
                    onClick={handleAnalyzeList}
                    disabled={groceryItems.analyzing}
                    className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white disabled:opacity-60"
                  >
                    {groceryItems.analyzing ? "Analyzing…" : "✨ Analyze my list"}
                  </button>
                )}

                {analysis && analysis.combinationTips.length > 0 && (
                  <Card className="border-transparent bg-[color:var(--color-honey-bg)]">
                    <Eyebrow>Suggestions</Eyebrow>
                    <div className="mt-2 flex flex-col gap-2.5">
                      {analysis.combinationTips.map((tip, i) => (
                        <div key={i} className="text-[0.85rem] leading-relaxed text-[color:var(--color-ink)]">
                          {tip.message}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {listView === "history" && (
              <>
                {trend.bars.length >= 2 ? (
                  <Card>
                    <Eyebrow>Healthy vs. caution over time</Eyebrow>
                    <svg width="100%" viewBox="0 0 310 150" className="mt-2">
                      <line x1={0} y1={trend.baseY} x2={310} y2={trend.baseY} stroke="var(--color-line)" strokeWidth={1} />
                      {trend.bars.map((b, i) => (
                        <g key={i}>
                          <rect x={b.goodX} y={b.goodY} width={14} height={b.goodH} rx={4} fill="var(--color-sage)" />
                          <rect x={b.cautionX} y={b.cautionY} width={14} height={b.cautionH} rx={4} fill="var(--color-berry)" />
                          <text x={b.groupX} y={142} textAnchor="middle" fontSize={9} fill="var(--color-ink-faint)">
                            {b.label}
                          </text>
                        </g>
                      ))}
                    </svg>
                    <div className="mt-2 flex justify-center gap-4 text-[0.72rem] font-bold">
                      <span className="flex items-center gap-1.5 text-[color:var(--color-sage)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-sage)]" /> Healthy
                      </span>
                      <span className="flex items-center gap-1.5 text-[color:var(--color-berry)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-berry)]" /> Caution
                      </span>
                    </div>
                  </Card>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    Analyze at least 2 past lists to see a trend here.
                  </div>
                )}

                {groceryLists.lists.length === 0 && (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    No past lists yet.
                  </div>
                )}

                {groceryLists.lists.map((list) => (
                  <Card key={list.id} className="p-0">
                    <div className="flex items-baseline justify-between px-4 pt-3">
                      <div className="text-[0.82rem] font-bold">
                        {new Date(list.created_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {list.id === activeList?.id && (
                          <span className="ml-1.5 font-normal text-[color:var(--color-sage)]">(current)</span>
                        )}
                      </div>
                      <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">{list.items.length} items</div>
                    </div>
                    <div className="mt-2">
                      {list.items.map((item, i) => (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between px-4 py-2 text-[0.84rem] ${
                            i < list.items.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                          }`}
                        >
                          <span className={item.checked ? "text-[color:var(--color-ink-faint)] line-through" : ""}>
                            {item.name}
                          </span>
                          {item.verdict && (
                            <span
                              className={
                                item.verdict === "caution"
                                  ? "text-[color:var(--color-berry)]"
                                  : "text-[color:var(--color-sage)]"
                              }
                            >
                              {item.verdict === "caution" ? "⚠" : "✓"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}
              </>
            )}

            {listView === "favorites" && (
              <>
                <Card>
                  <div className="text-[0.8rem] text-[color:var(--color-ink-soft)]">
                    Items you buy often — tap the star on any list item to save it here, or add one directly.
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newFavoriteName}
                      onChange={(e) => setNewFavoriteName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddFavorite()}
                      placeholder="e.g. olive oil"
                      className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                    />
                    <button
                      onClick={handleAddFavorite}
                      disabled={!newFavoriteName.trim()}
                      className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </Card>

                {favorites.favorites.length > 0 ? (
                  <>
                    <Card className="p-0">
                      {favorites.favorites.map((f, i) => (
                        <div
                          key={f.id}
                          className={`flex items-center justify-between px-4 py-3 ${
                            i < favorites.favorites.length - 1 ? "border-b border-[color:var(--color-line)]" : ""
                          }`}
                        >
                          <span className="text-[0.9rem] font-bold">{f.name}</span>
                          <button
                            onClick={() => favorites.removeFavorite(f.id)}
                            aria-label={`Remove ${f.name} from favorites`}
                            className="shrink-0 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </Card>
                    <button
                      onClick={handleAddFavoritesToList}
                      className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white"
                    >
                      + Add all to current list
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    No favorites yet.
                  </div>
                )}
              </>
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
