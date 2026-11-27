import type { DailyTargets, LogEntry, MealDetail, MealIngredient, MealSummary } from '../types';

const CATEGORY_NUTRITION_BASE: Record<
  string,
  { kcal: number; protein: number; carbs: number; fat: number }
> = {
  Chicken: { kcal: 460, protein: 42, carbs: 28, fat: 18 },
  Seafood: { kcal: 390, protein: 36, carbs: 24, fat: 15 },
  Vegetarian: { kcal: 380, protein: 16, carbs: 48, fat: 14 },
  Vegan: { kcal: 350, protein: 15, carbs: 50, fat: 11 },
  Beef: { kcal: 590, protein: 44, carbs: 32, fat: 30 },
  Pork: { kcal: 560, protein: 38, carbs: 30, fat: 29 },
  Lamb: { kcal: 610, protein: 40, carbs: 28, fat: 34 },
  Pasta: { kcal: 540, protein: 22, carbs: 68, fat: 18 },
  Breakfast: { kcal: 410, protein: 20, carbs: 46, fat: 16 },
  Starter: { kcal: 290, protein: 12, carbs: 32, fat: 12 },
  Side: { kcal: 250, protein: 8, carbs: 34, fat: 9 },
  Dessert: { kcal: 440, protein: 6, carbs: 58, fat: 20 },
  Miscellaneous: { kcal: 470, protein: 26, carbs: 44, fat: 19 },
};

export function estimateMealNutrition(
  mealId: string,
  category: string = 'Chicken',
  ingredientCount: number = 8
): { kcal: number; proteinG: number; carbsG: number; fatG: number } {
  const base = CATEGORY_NUTRITION_BASE[category] || CATEGORY_NUTRITION_BASE.Miscellaneous;
  // Deterministic subtle variance per meal ID so estimates remain consistent across sessions
  const numericHash = mealId
    .split('')
    .reduce((acc, ch) => acc + ch.charCodeAt(0) * 7, 0);
  const variance = ((numericHash % 17) - 8) * 10; // -80 to +80 kcal
  const richnessAdjustment = Math.min(Math.max(ingredientCount - 7, -3), 5) * 15;
  const kcal = Math.max(220, Math.round((base.kcal + variance + richnessAdjustment) / 5) * 5);
  const scale = kcal / base.kcal;

  return {
    kcal,
    proteinG: Math.round(base.protein * scale),
    carbsG: Math.round(base.carbs * scale),
    fatG: Math.round(base.fat * scale),
  };
}

export function extractMealIngredients(rawMeal: Record<string, unknown>): MealIngredient[] {
  const list: MealIngredient[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = rawMeal[`strIngredient${i}`];
    const measure = rawMeal[`strMeasure${i}`];
    if (typeof ing === 'string' && ing.trim().length > 0) {
      list.push({
        ingredient: ing.trim(),
        measure: typeof measure === 'string' ? measure.trim() : '',
      });
    }
  }
  return list;
}

export function hydrateMealSummary(raw: Record<string, unknown>, fallbackCategory = 'Chicken'): MealSummary {
  const idMeal = String(raw.idMeal || '');
  const category = typeof raw.strCategory === 'string' && raw.strCategory ? raw.strCategory : fallbackCategory;
  const est = estimateMealNutrition(idMeal, category, 8);
  return {
    idMeal,
    strMeal: String(raw.strMeal || 'Untitled Meal'),
    strMealThumb: String(raw.strMealThumb || ''),
    strCategory: category,
    strArea: typeof raw.strArea === 'string' ? raw.strArea : undefined,
    strInstructions: typeof raw.strInstructions === 'string' ? raw.strInstructions : undefined,
    estimatedKcal: est.kcal,
    estimatedProteinG: est.proteinG,
    estimatedCarbsG: est.carbsG,
    estimatedFatG: est.fatG,
  };
}

export function hydrateMealDetail(raw: Record<string, unknown>): MealDetail {
  const idMeal = String(raw.idMeal || '');
  const category = typeof raw.strCategory === 'string' && raw.strCategory ? raw.strCategory : 'Miscellaneous';
  const ingredients = extractMealIngredients(raw);
  const est = estimateMealNutrition(idMeal, category, ingredients.length);

  return {
    idMeal,
    strMeal: String(raw.strMeal || 'Untitled Meal'),
    strMealThumb: String(raw.strMealThumb || ''),
    strCategory: category,
    strArea: typeof raw.strArea === 'string' && raw.strArea ? raw.strArea : 'International',
    strInstructions:
      typeof raw.strInstructions === 'string' && raw.strInstructions.trim()
        ? raw.strInstructions.trim()
        : 'Prepare ingredients and cook until tender.',
    strYoutube: typeof raw.strYoutube === 'string' ? raw.strYoutube : undefined,
    strTags: typeof raw.strTags === 'string' ? raw.strTags : undefined,
    ingredients,
    estimatedKcal: est.kcal,
    estimatedProteinG: est.proteinG,
    estimatedCarbsG: est.carbsG,
    estimatedFatG: est.fatG,
  };
}

export function formatInstructionSteps(instructions: string): string[] {
  return instructions
    .split(/\r?\n+/)
    .map((step) => step.replace(/^step\s*\d+[:.)]?\s*/i, '').trim())
    .filter((step) => step.length > 2);
}

export function computeDailyBalance(logs: LogEntry[], targets: DailyTargets) {
  const consumedKcal = logs
    .filter((l) => l.type === 'meal')
    .reduce((sum, l) => sum + l.calories, 0);
  const burnedKcal = logs
    .filter((l) => l.type === 'exercise')
    .reduce((sum, l) => sum + l.calories, 0);

  // Net intake = food eaten - exercise burned; Remaining = intakeTarget - net
  const netKcal = consumedKcal - burnedKcal;
  const remainingKcal = targets.intakeTargetKcal - netKcal;
  const effectiveBudgetKcal = targets.intakeTargetKcal + burnedKcal;
  const burnRemainingKcal = Math.max(0, targets.burnTargetKcal - burnedKcal);

  const recommendedMealWindow =
    remainingKcal <= 350
      ? { min: 180, max: 350, suggestedCategory: 'Side', label: 'Light & Low-Calorie' }
      : burnedKcal >= 200
      ? { min: 420, max: Math.min(720, remainingKcal), suggestedCategory: 'Chicken', label: 'High-Protein Recovery' }
      : remainingKcal <= 550
      ? { min: 280, max: 500, suggestedCategory: 'Seafood', label: 'Lean & Balanced' }
      : { min: 380, max: 650, suggestedCategory: 'Vegetarian', label: 'Balanced Nutrition' };

  return {
    consumedKcal,
    burnedKcal,
    netKcal,
    remainingKcal,
    effectiveBudgetKcal,
    burnRemainingKcal,
    recommendedMealWindow,
  };
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function getNutriScoreMeta(grade?: string): {
  label: string;
  badgeClass: string;
  description: string;
} {
  const normalized = (grade || '').trim().toUpperCase();
  switch (normalized) {
    case 'A':
      return {
        label: 'Nutri-Score A',
        badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        description: 'Highest nutritional quality',
      };
    case 'B':
      return {
        label: 'Nutri-Score B',
        badgeClass: 'text-teal-700 bg-teal-50 border-teal-200',
        description: 'Good nutritional quality',
      };
    case 'C':
      return {
        label: 'Nutri-Score C',
        badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
        description: 'Moderate nutritional balance',
      };
    case 'D':
      return {
        label: 'Nutri-Score D',
        badgeClass: 'text-orange-700 bg-orange-50 border-orange-200',
        description: 'Higher sugar, salt, or saturated fat',
      };
    case 'E':
      return {
        label: 'Nutri-Score E',
        badgeClass: 'text-rose-700 bg-rose-50 border-rose-200',
        description: 'Consume in small portions',
      };
    default:
      return {
        label: 'Nutri-Score N/A',
        badgeClass: 'text-slate-600 bg-slate-100 border-slate-200',
        description: 'Score not rated',
      };
  }
}
