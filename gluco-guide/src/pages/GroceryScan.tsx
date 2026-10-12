import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Card, Eyebrow } from "../components/Screen"
import { useOptionalHousehold } from "../context/HouseholdContext"
import {
  useGroceryLists,
  useGroceryListItems,
  useGroceryFavorites,
  type GroceryListAnalysis,
} from "../hooks/useGroceryList"
import { useFoodPhotoAnalysis, type FoodPhotoItem } from "../hooks/useFoodPhotoAnalysis"
import { buildGroceryTrendChart } from "../lib/groceryTrend"
import { round1 } from "../lib/format"
import { PhotoCaptureButton } from "../components/PhotoCapture"
import { useKeyboardTip } from "../components/KeyboardTip"

function computeScoreFraction(fiberG: number, proteinG: number, netCarbG: number) {
  const score = (fiberG * 4 + proteinG * 2) / (fiberG * 4 + proteinG * 2 + netCarbG + 5)
  return Math.min(1, Math.max(0, score))
}

// Built deterministically from the item name rather than trusting any URL
// the AI might suggest — an AI-generated link to a specific recipe page is
// exactly the kind of fact it could plausibly hallucinate (a URL that looks
// real but doesn't exist or goes nowhere useful). A search link is always
// valid and still gets the user to real recipes.
function recipeSearchUrl(itemName: string) {
  const query = `high protein naturally sweetened homemade ${itemName} recipe`
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

export function GroceryScan() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const householdCtx = useOptionalHousehold()
  const isLive = !!householdCtx
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
  // The language the photo results were written in; saved notes are stamped
  // with it so they get translated later if it differs from the user's.
  const [photoLanguage, setPhotoLanguage] = useState(i18n.language)
  const itemKeyboardTip = useKeyboardTip()
  const favoriteKeyboardTip = useKeyboardTip()

  const activeList = groceryLists.activeList
  const activeItems = activeList?.items ?? []
  const trend = buildGroceryTrendChart(groceryLists.lists, i18n.language)

  const [photoAnalyzing, setPhotoAnalyzing] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const [photoItems, setPhotoItems] = useState<FoodPhotoItem[] | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoAdding, setPhotoAdding] = useState(false)

  const photoAnalysis = useFoodPhotoAnalysis()

  async function handlePhotoCaptured(dataUrl: string) {
    setPhotoItems(null)
    setPhotoError(null)
    setCapturedPhoto(dataUrl)
    setPhotoAnalyzing(true)
    try {
      const result = await photoAnalysis.analyze(dataUrl)
      if (!Array.isArray(result.items) || result.items.length === 0) {
        setPhotoError(t("groceryScan.noFoodFound"))
        return
      }
      setPhotoItems(result.items)
      setPhotoLanguage(i18n.language)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("groceryScan.photoAnalyzeFailed"))
    } finally {
      setPhotoAnalyzing(false)
      setCapturedPhoto(null)
    }
  }

  async function handlePhotoAddAll() {
    if (!photoItems) return
    setPhotoAdding(true)
    try {
      const listId = await ensureActiveList()
      if (listId) {
        await groceryItems.addManyItemsWithVerdicts(
          listId,
          photoItems.map((i) => ({ name: i.name, verdict: i.verdict, note: i.insight })),
          photoLanguage,
        )
      }
      setPhotoItems(null)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t("groceryScan.saveFailed"))
    } finally {
      setPhotoAdding(false)
    }
  }

  function handlePhotoSkip() {
    setPhotoItems(null)
    setPhotoError(null)
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
      setListError(err instanceof Error ? err.message : t("common.genericError"))
    }
  }

  async function handleStartNewList() {
    setListError(null)
    try {
      if (isLive) await groceryLists.createList()
      setAnalysis(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("groceryScan.startListFailed"))
    }
  }

  async function handleToggleItem(id: string, checked: boolean) {
    setListError(null)
    try {
      if (isLive && activeList) await groceryItems.toggleChecked(activeList.id, id, checked)
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("common.genericError"))
    }
  }

  async function handleRemoveItem(id: string) {
    setListError(null)
    try {
      if (isLive && activeList) await groceryItems.removeMany(activeList.id, [id])
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("groceryScan.removeItemFailed"))
    }
  }

  async function handleClearAll() {
    setListError(null)
    try {
      if (isLive && activeList) await groceryItems.removeMany(activeList.id, activeItems.map((i) => i.id))
      setAnalysis(null)
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("groceryScan.clearListFailed"))
    }
  }

  async function handleAnalyzeList() {
    setListError(null)
    setAnalysis(null)
    try {
      const result = await groceryItems.analyze(activeItems.map((i) => i.name))
      setAnalysis(result)
      if (activeList) await groceryItems.saveVerdicts(activeList.id, activeItems, result.itemFlags)
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("groceryScan.analyzeFailed"))
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
      setListError(err instanceof Error ? err.message : t("groceryScan.updateFavoritesFailed"))
    }
  }

  async function handleAddFavorite() {
    if (!newFavoriteName.trim()) return
    setListError(null)
    try {
      if (isLive) await favorites.addFavorite(newFavoriteName.trim())
      setNewFavoriteName("")
    } catch (err) {
      setListError(err instanceof Error ? err.message : t("common.genericError"))
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
      setListError(err instanceof Error ? err.message : t("groceryScan.addFavoritesFailed"))
    }
  }

  return (
    <div className="flex h-screen w-full justify-center bg-[color:var(--color-bg)]">
      <div className="flex h-screen w-full max-w-md flex-col">
        <div className="flex items-center gap-2.5 px-5 pt-6">
          <button onClick={() => navigate(-1)} aria-label={t("common.back")} className="text-[color:var(--color-ink-faint)]">
            <svg width={20} height={20} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <Eyebrow>{t("groceryScan.eyebrow")}</Eyebrow>
        </div>

        <div className="px-5 pt-4">
          <div className="flex gap-1.5 rounded-xl bg-[color:var(--color-surface-2)] p-1">
            {(["scan", "list"] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={`min-h-[38px] flex-1 rounded-lg text-center text-[0.86rem] font-bold ${
                  tab === tabKey
                    ? "bg-[color:var(--color-surface)] text-[color:var(--color-sage)] shadow-sm"
                    : "text-[color:var(--color-ink-faint)]"
                }`}
              >
                {t(`groceryScan.tabs.${tabKey}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-8 pt-4">
          {tab === "scan" ? (
          <>
          {isLive ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <PhotoCaptureButton
                onCapture={(dataUrl) => void handlePhotoCaptured(dataUrl)}
                ariaLabel={t("groceryScan.cameraLabel")}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-sage)] text-white shadow-sm"
              >
                <svg width={32} height={32} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 8a2 2 0 0 1 2-2h1.2a1 1 0 0 0 .83-.45l.94-1.4a1 1 0 0 1 .83-.45h4.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                  <circle cx="12" cy="13" r="3.2" />
                </svg>
              </PhotoCaptureButton>
              <div className="text-center text-[0.8rem] text-[color:var(--color-ink-soft)]">
                {t("groceryScan.cameraCaption")}
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
              {t("groceryScan.setupAccountCamera")}
            </div>
          )}

          {photoAnalyzing && (
            <Card className="flex items-center gap-3">
              {capturedPhoto && (
                <img src={capturedPhoto} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
              )}
              <div className="flex flex-col gap-0.5">
                <div className="text-[0.88rem] font-bold text-[color:var(--color-ink)]">
                  {t("groceryScan.photoCaptured")}
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
                  {t("groceryScan.analyzingPhoto")}
                </div>
              </div>
            </Card>
          )}

          {photoError && (
            <div className="rounded-xl bg-[color:var(--color-berry-bg)] p-3 text-[0.82rem]">{photoError}</div>
          )}

          {photoItems && (
            <Card>
              <Eyebrow>
                {t("groceryScan.foundItems", { count: photoItems.length })}
              </Eyebrow>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {photoItems.map((item, i) => {
                  const macros = item.estimatedMacros
                  const fiberG = macros?.fiberG ?? 0
                  const proteinG = macros?.proteinG ?? 0
                  const netCarbG = Math.max(0, (macros?.carbG ?? 0) - fiberG)
                  return (
                    <div key={i} className="rounded-xl border border-[color:var(--color-line)] p-3">
                      <div className="text-[0.88rem] font-bold">{item.name}</div>

                      <div className="relative my-3.5 h-2.5 rounded-md bg-gradient-to-r from-[color:var(--color-berry)] via-[color:var(--color-honey-bg)] to-[color:var(--color-sage)]">
                        <div
                          className="absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-[3px] border-[color:var(--color-ink)] bg-[color:var(--color-surface)]"
                          style={{ left: `${computeScoreFraction(fiberG, proteinG, netCarbG) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[0.62rem] font-bold text-[color:var(--color-ink-faint)]">
                        <span>{t("groceryScan.moreRefinedCarbs")}</span>
                        <span>{t("groceryScan.moreFiberProtein")}</span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <MiniStat label={t("groceryScan.stats.fiber")} value={`${round1(fiberG)}g`} colorVar="--color-sage" />
                        <MiniStat label={t("groceryScan.stats.protein")} value={`${round1(proteinG)}g`} colorVar="--color-honey" />
                        <MiniStat label={t("groceryScan.stats.netCarbs")} value={`${round1(netCarbG)}g`} colorVar="--color-berry" />
                        <MiniStat label={t("groceryScan.stats.fat")} value={`${round1(macros?.fatG ?? 0)}g`} colorVar="--color-fat" />
                      </div>
                      <div className="mt-1.5 text-[0.62rem] text-[color:var(--color-ink-faint)]">
                        {t("common.aiEstimateDisclaimer")}
                      </div>

                      <div
                        className={`mt-2.5 text-[0.78rem] leading-relaxed ${
                          item.verdict === "caution"
                            ? "text-[color:var(--color-berry)]"
                            : item.verdict === "good"
                              ? "text-[color:var(--color-sage)]"
                              : "text-[color:var(--color-ink-soft)]"
                        }`}
                      >
                        {item.verdict === "caution" ? "⚠ " : item.verdict === "good" ? "✓ " : ""}
                        {item.insight}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3.5 flex gap-2.5">
                <button
                  onClick={handlePhotoSkip}
                  disabled={photoAdding}
                  className="min-h-11 flex-1 rounded-xl bg-[color:var(--color-surface-2)] px-4 text-[0.85rem] font-bold text-[color:var(--color-ink-soft)] disabled:opacity-50"
                >
                  {t("groceryScan.skip")}
                </button>
                <button
                  onClick={() => void handlePhotoAddAll()}
                  disabled={photoAdding}
                  className="min-h-11 flex-[2] rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                >
                  {photoAdding ? t("groceryScan.adding") : t("groceryScan.addToListCount", { count: photoItems.length })}
                </button>
              </div>
            </Card>
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
                  {t(`groceryScan.${v}View`)}
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
                        ? t("groceryScan.startedOn", {
                            date: new Date(activeList.created_at).toLocaleDateString(i18n.language, { month: "short", day: "numeric" }),
                          })
                        : t("groceryScan.buildListPrompt")}
                    </div>
                    <button
                      onClick={handleStartNewList}
                      className="shrink-0 text-[0.76rem] font-bold text-[color:var(--color-sage)]"
                    >
                      {t("groceryScan.startNewList")}
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      {...itemKeyboardTip.inputProps}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddListItem()}
                      placeholder={t("groceryScan.itemPlaceholder")}
                      className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                    />
                    <button
                      onClick={handleAddListItem}
                      disabled={!newItemName.trim()}
                      className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                    >
                      {t("common.add")}
                    </button>
                  </div>
                  {itemKeyboardTip.tip && <div className="mt-2.5">{itemKeyboardTip.tip}</div>}
                </Card>

                {activeItems.length > 0 && (
                  <div className="flex items-center justify-end px-1">
                    <button
                      onClick={handleClearAll}
                      className="text-[0.78rem] font-bold text-[color:var(--color-berry)]"
                    >
                      {t("groceryScan.clearAll")}
                    </button>
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
                            onClick={() => handleToggleFavorite(item.name)}
                            aria-label={isFavorite(item.name) ? t("groceryScan.removeFromFavorites") : t("groceryScan.saveAsFavorite")}
                            className={`shrink-0 text-[0.9rem] ${
                              isFavorite(item.name) ? "text-[color:var(--color-honey)]" : "text-[color:var(--color-ink-faint)]"
                            }`}
                          >
                            {isFavorite(item.name) ? "★" : "☆"}
                          </button>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            aria-label={t("groceryScan.removeItemLabel", { name: item.name })}
                            className="shrink-0 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                          >
                            {t("groceryScan.remove")}
                          </button>
                        </div>
                        {item.verdict && item.note?.trim() && (
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
                        {item.verdict === "caution" && (
                          <a
                            href={recipeSearchUrl(item.name)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 ml-8 inline-block text-[0.74rem] font-bold text-[color:var(--color-sage)] underline"
                          >
                            {t("groceryScan.findHealthierRecipe")}
                          </a>
                        )}
                      </div>
                    ))}
                  </Card>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    {t("groceryScan.emptyListPrefix")}{" "}
                    <button onClick={() => setListView("favorites")} className="font-bold text-[color:var(--color-sage)]">
                      {t("groceryScan.favoritesLink")}
                    </button>
                    .
                  </div>
                )}

                {activeItems.length > 0 && (
                  <button
                    onClick={handleAnalyzeList}
                    disabled={groceryItems.analyzing}
                    className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white disabled:opacity-60"
                  >
                    {groceryItems.analyzing ? t("groceryScan.analyzing") : t("groceryScan.analyzeMyList")}
                  </button>
                )}

                {analysis && analysis.combinationTips.length > 0 && (
                  <Card className="border-transparent bg-[color:var(--color-honey-bg)]">
                    <Eyebrow>{t("groceryScan.suggestions")}</Eyebrow>
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
                    <Eyebrow>{t("groceryScan.healthyVsCaution")}</Eyebrow>
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
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-sage)]" /> {t("groceryScan.healthy")}
                      </span>
                      <span className="flex items-center gap-1.5 text-[color:var(--color-berry)]">
                        <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--color-berry)]" /> {t("groceryScan.caution")}
                      </span>
                    </div>
                  </Card>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    {t("groceryScan.needTwoLists")}
                  </div>
                )}

                {groceryLists.lists.length === 0 && (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    {t("groceryScan.noPastLists")}
                  </div>
                )}

                {groceryLists.lists.map((list) => (
                  <Card key={list.id} className="p-0">
                    <div className="flex items-baseline justify-between px-4 pt-3">
                      <div className="text-[0.82rem] font-bold">
                        {new Date(list.created_at).toLocaleDateString(i18n.language, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {list.id === activeList?.id && (
                          <span className="ml-1.5 font-normal text-[color:var(--color-sage)]">{t("groceryScan.currentSuffix")}</span>
                        )}
                      </div>
                      <div className="text-[0.72rem] text-[color:var(--color-ink-faint)]">
                        {t("groceryScan.itemsCount", { count: list.items.length })}
                      </div>
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
                    {t("groceryScan.favoritesIntro")}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      {...favoriteKeyboardTip.inputProps}
                      value={newFavoriteName}
                      onChange={(e) => setNewFavoriteName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddFavorite()}
                      placeholder={t("groceryScan.favoritePlaceholder")}
                      className="min-h-11 flex-1 rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-3 text-[0.9rem]"
                    />
                    <button
                      onClick={handleAddFavorite}
                      disabled={!newFavoriteName.trim()}
                      className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 text-[0.85rem] font-bold text-white disabled:opacity-60"
                    >
                      {t("common.add")}
                    </button>
                  </div>
                  {favoriteKeyboardTip.tip && <div className="mt-2.5">{favoriteKeyboardTip.tip}</div>}
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
                            aria-label={t("groceryScan.removeFromFavoritesLabel", { name: f.name })}
                            className="shrink-0 text-[0.78rem] font-bold text-[color:var(--color-ink-faint)]"
                          >
                            {t("groceryScan.remove")}
                          </button>
                        </div>
                      ))}
                    </Card>
                    <button
                      onClick={handleAddFavoritesToList}
                      className="min-h-11 rounded-xl bg-[color:var(--color-sage)] px-4 py-3.5 text-[0.9rem] font-bold text-white"
                    >
                      {t("groceryScan.addAllToList")}
                    </button>
                  </>
                ) : (
                  <div className="p-4 text-center text-[0.85rem] text-[color:var(--color-ink-faint)]">
                    {t("groceryScan.noFavoritesYet")}
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
