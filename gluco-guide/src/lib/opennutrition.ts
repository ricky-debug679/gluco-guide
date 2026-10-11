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

export async function searchOpenNutrition(query: string): Promise<FoodItem[]> {
  if (!supabase || !query.trim()) return []
  const { data, error } = await supabase
    .from("opennutrition_foods")
    .select("id, name, calories_kcal, protein_g, carb_g, fat_g, fiber_g")
    .ilike("name", `%${query.trim()}%`)
    .order("name", { ascending: true })
    .limit(15)
  if (error) throw error
  return (data as OpenNutritionRow[]).map(toFoodItem)
}
