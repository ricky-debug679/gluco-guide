import { supabase } from "./supabase"
import type { FoodItem } from "./types"

interface OpenNutritionRow {
  id: string
  name: string
  calories_kcal: number
  protein_g: number
  carb_g: number
  fat_g: number
  fiber_g: number
}

function toFoodItem(row: OpenNutritionRow): FoodItem {
  return {
    id: row.id,
    name: row.name,
    portion: "100g",
    fiberG: Number(row.fiber_g),
    proteinG: Number(row.protein_g),
    carbG: Number(row.carb_g),
    fatG: Number(row.fat_g),
    caloriesKcal: Number(row.calories_kcal),
  }
}

// The trigram index only narrows searches of 3+ characters; shorter ones
// would scan all ~326k foods and can hit the database's statement timeout.
const MIN_QUERY_LENGTH = 3

export async function searchOpenNutrition(query: string): Promise<FoodItem[]> {
  if (!supabase || query.trim().length < MIN_QUERY_LENGTH) return []
  const { data, error } = await supabase.rpc("search_foods", { q: query.trim(), max_results: 15 })
  if (error) throw error
  return (data as OpenNutritionRow[]).map(toFoodItem)
}
