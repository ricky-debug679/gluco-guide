import type { GroceryListSummary } from "../hooks/useGroceryList"

const CHART_W = 310
const CHART_H = 150
const BASE_Y = CHART_H - 20
const BAR_W = 14
const BAR_GAP = 3 // gap between the good/caution bars within one trip
const MAX_BAR_H = CHART_H - 40

export interface GroceryTrendBar {
  label: string
  good: number
  caution: number
  goodX: number
  cautionX: number
  goodY: number
  cautionY: number
  goodH: number
  cautionH: number
  groupX: number
}

export interface GroceryTrendChart {
  bars: GroceryTrendBar[]
  baseY: number
}

/** Healthy-vs-caution counts per past trip, oldest first, for the trend chart. Only
 *  trips that were actually analyzed (have at least one verdict) are included. */
export function buildGroceryTrendChart(lists: GroceryListSummary[]): GroceryTrendChart {
  const analyzed = [...lists]
    .filter((l) => l.items.some((i) => i.verdict))
    .reverse() // hook returns newest-first; a timeline reads oldest-to-newest left to right

  if (analyzed.length === 0) return { bars: [], baseY: BASE_Y }

  const counts = analyzed.map((l) => ({
    label: new Date(l.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    good: l.items.filter((i) => i.verdict === "good").length,
    caution: l.items.filter((i) => i.verdict === "caution").length,
  }))

  const maxCount = Math.max(1, ...counts.flatMap((c) => [c.good, c.caution]))
  const groupW = (CHART_W - 20) / counts.length
  const scale = (n: number) => (n / maxCount) * MAX_BAR_H

  const bars = counts.map((c, i) => {
    const groupX = 10 + groupW * i + groupW / 2
    const goodH = scale(c.good)
    const cautionH = scale(c.caution)
    return {
      ...c,
      groupX,
      goodX: groupX - BAR_W - BAR_GAP / 2,
      cautionX: groupX + BAR_GAP / 2,
      goodY: BASE_Y - goodH,
      cautionY: BASE_Y - cautionH,
      goodH,
      cautionH,
    }
  })

  return { bars, baseY: BASE_Y }
}
