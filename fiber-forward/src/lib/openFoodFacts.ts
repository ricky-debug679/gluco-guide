export interface GroceryResult {
  id: string
  brand: string
  name: string
  fiberG: number
  proteinG: number
  netCarbG: number
  /** 0 = mostly refined carbs, 1 = mostly fiber & protein. A simple, explainable
   *  heuristic — not a clinical score — weighted toward fiber and protein
   *  relative to net carbs. */
  scoreFraction: number
  blurb: string
  pairSuggestion: string
}

interface OffProduct {
  code: string
  product_name?: string
  brands?: string
  nutriments?: {
    fiber_100g?: number
    proteins_100g?: number
    carbohydrates_100g?: number
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function toResult(p: OffProduct): GroceryResult | null {
  const name = p.product_name?.trim()
  if (!name) return null
  const n = p.nutriments ?? {}
  const fiberG = round1(n.fiber_100g ?? 0)
  const proteinG = round1(n.proteins_100g ?? 0)
  const carbG = n.carbohydrates_100g ?? 0
  const netCarbG = round1(Math.max(0, carbG - fiberG))

  const score = (fiberG * 4 + proteinG * 2) / (fiberG * 4 + proteinG * 2 + netCarbG + 5)
  const scoreFraction = Math.min(1, Math.max(0, score))

  const blurb =
    scoreFraction < 0.35
      ? "Leans carb-heavy — pairing it with fiber or protein would help."
      : scoreFraction < 0.6
        ? "A middle-of-the-road pick — fine on its own, better paired."
        : "A strong pick — good fiber and protein relative to its carbs."

  const pairSuggestion =
    scoreFraction < 0.5
      ? "Add a source of protein or fiber alongside this — it slows how fast the carbs hit your bloodstream."
      : "Already brings solid fiber and protein — a good choice as is."

  return {
    id: p.code,
    brand: p.brands?.split(",")[0]?.trim() ?? "",
    name,
    fiberG,
    proteinG,
    netCarbG,
    scoreFraction,
    blurb,
    pairSuggestion,
  }
}

export async function searchGroceries(query: string): Promise<GroceryResult[]> {
  if (!query.trim()) return []
  const url = new URL("https://world.openfoodfacts.net/cgi/search.pl")
  url.searchParams.set("search_terms", query)
  url.searchParams.set("search_simple", "1")
  url.searchParams.set("action", "process")
  url.searchParams.set("json", "1")
  url.searchParams.set("page_size", "10")

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open Food Facts search failed: ${res.status}`)
  const data = (await res.json()) as { products: OffProduct[] }
  return data.products.map(toResult).filter((r): r is GroceryResult => r !== null)
}
