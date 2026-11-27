export interface EquipmentTag {
  id: number;
  name: string;
}

export interface ExerciseItem {
  id: number;
  name: string;
  category: string;
  categoryId: number;
  equipment: EquipmentTag[];
  muscles: string[];
  secondaryMuscles: string[];
  steps: string[];
  image: string | null;
  kcalPerMin: number;
}

export interface WgerCategoryOption {
  id: number;
  name: string;
}

export interface WgerEquipmentOption {
  id: number;
  name: string;
}

export interface MealSummary {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  estimatedKcal?: number;
  estimatedProteinG?: number;
  estimatedCarbsG?: number;
  estimatedFatG?: number;
}

export interface MealIngredient {
  ingredient: string;
  measure: string;
}

export interface MealDetail extends MealSummary {
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strYoutube?: string;
  strTags?: string;
  ingredients: MealIngredient[];
  estimatedKcal: number;
  estimatedProteinG: number;
  estimatedCarbsG: number;
  estimatedFatG: number;
}

export interface MealCategoryInfo {
  idCategory: string;
  strCategory: string;
  strCategoryThumb: string;
  strCategoryDescription: string;
}

export interface OpenFoodNutriments {
  'energy-kcal_100g'?: number;
  'energy-kcal'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  sugars_100g?: number;
  fiber_100g?: number;
}

export interface FoodProduct {
  code: string;
  product_name: string;
  brands?: string;
  nutriscore_grade?: string;
  image_small_url?: string;
  serving_size?: string;
  quantity?: string;
  nutriments?: OpenFoodNutriments;
}

export type LogEntryType = 'exercise' | 'meal';
export type LogSource = 'wger' | 'mealdb' | 'openfoodfacts' | 'custom';

export interface LogEntry {
  id: string;
  type: LogEntryType;
  source: LogSource;
  sourceRefId?: string;
  title: string;
  category: string;
  calories: number;
  amount: number;
  unit: string;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  timestamp: string;
}

export interface DailyTargets {
  intakeTargetKcal: number;
  burnTargetKcal: number;
  goalPreset: 'fat-loss' | 'maintenance' | 'muscle-gain' | 'custom';
}

export interface UndoAction {
  id: string;
  description: string;
  previousLogs: LogEntry[];
  previousTargets: DailyTargets;
}

export interface ApiDiagnosticItem {
  service: string;
  connected: boolean;
  count?: number;
  sample?: string;
  error?: string;
}

export type ActiveSection = 'overview' | 'exercises' | 'meals' | 'food' | 'log';
