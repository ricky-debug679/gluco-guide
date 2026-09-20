import type { FoodItem } from "./types"

const USDA_KEY = import.meta.env.VITE_USDA_FDC_API_KEY as string | undefined

interface UsdaNutrient {
  nutrientName: string
  value: number
}

interface UsdaFood {
  fdcId: number
  description: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: UsdaNutrient[]
}

function pickNutrient(nutrients: UsdaNutrient[], name: string): number {
  const match = nutrients.find((n) => n.nutrientName === name)
  return match ? Math.round(match.value * 10) / 10 : 0
}

function toFoodItem(food: UsdaFood): FoodItem {
  const portion = food.servingSize && food.servingSizeUnit ? `${food.servingSize}${food.servingSizeUnit}` : "100g"
  return {
    id: String(food.fdcId),
    name: food.description,
    portion,
    fiberG: pickNutrient(food.foodNutrients, "Fiber, total dietary"),
    proteinG: pickNutrient(food.foodNutrients, "Protein"),
    carbG: pickNutrient(food.foodNutrients, "Carbohydrate, by difference"),
    fatG: pickNutrient(food.foodNutrients, "Total lipid (fat)"),
  }
}

export const usdaConfigured = !!USDA_KEY

export async function searchFoods(query: string): Promise<FoodItem[]> {
  if (!USDA_KEY || !query.trim()) return []

  const url = new URL("https://api.nal.usda.gov/fdc/v1/foods/search")
  url.searchParams.set("api_key", USDA_KEY)
  url.searchParams.set("query", query)
  url.searchParams.set("pageSize", "8")
  // Foundation + SR Legacy are whole/generic foods with clean nutrient data —
  // a better fit for this app than every branded product variant.
  url.searchParams.set("dataType", "Foundation,SR Legacy")

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`USDA search failed: ${res.status}`)
  const data = (await res.json()) as { foods: UsdaFood[] }
  return data.foods.map(toFoodItem)
}
