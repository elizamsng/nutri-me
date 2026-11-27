import type {
  ApiDiagnosticItem,
  ExerciseItem,
  FoodProduct,
  MealCategoryInfo,
  MealDetail,
  MealSummary,
  WgerCategoryOption,
  WgerEquipmentOption,
} from '../types';
import { hydrateMealDetail, hydrateMealSummary } from '../utils/nutrition';

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const message =
      typeof payload?.error === 'string' && payload.error
        ? payload.error
        : `Request failed with status ${response.status}`;
    const err = new Error(message) as Error & { notFound?: boolean; status?: number };
    err.notFound = Boolean(payload?.notFound);
    err.status = response.status;
    throw err;
  }
  return payload as T;
}

export async function fetchWgerMeta(): Promise<{
  categories: WgerCategoryOption[];
  equipment: WgerEquipmentOption[];
}> {
  const data = await requestJson<{
    categories?: WgerCategoryOption[];
    equipment?: WgerEquipmentOption[];
  }>('/api/nutri?action=wger-meta');
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    equipment: Array.isArray(data?.equipment) ? data.equipment : [],
  };
}

export async function fetchWgerExercises(params: {
  categoryIds?: number[];
  equipmentIds?: number[];
  search?: string;
  limit?: number;
}): Promise<{ count: number; exercises: ExerciseItem[] }> {
  const qs = new URLSearchParams({ action: 'wger-exercises' });
  if (params.categoryIds && params.categoryIds.length > 0) {
    qs.set('category', params.categoryIds.join(','));
  }
  if (params.equipmentIds && params.equipmentIds.length > 0) {
    qs.set('equipment', params.equipmentIds.join(','));
  }
  if (params.search?.trim()) qs.set('search', params.search.trim());
  qs.set('limit', String(params.limit || 45));
  const data = await requestJson<{ count?: number; exercises?: ExerciseItem[] }>(
    `/api/nutri?${qs.toString()}`
  );
  const exercises = Array.isArray(data?.exercises) ? data.exercises : [];
  return {
    count: typeof data?.count === 'number' ? data.count : exercises.length,
    exercises,
  };
}

export async function fetchMealCategories(): Promise<MealCategoryInfo[]> {
  const data = await requestJson<{ categories?: MealCategoryInfo[] }>(
    '/api/nutri?action=meals-categories'
  );
  return Array.isArray(data?.categories) ? data.categories : [];
}

export async function fetchMealsByFilter(opts: {
  category?: string;
  ingredient?: string;
}): Promise<MealSummary[]> {
  const qs = new URLSearchParams({ action: 'meals-filter' });
  if (opts.category) qs.set('c', opts.category);
  else if (opts.ingredient) qs.set('i', opts.ingredient);
  const data = await requestJson<{ meals?: Record<string, unknown>[] }>(
    `/api/nutri?${qs.toString()}`
  );
  const catLabel = opts.category || 'Chicken';
  const meals = Array.isArray(data?.meals) ? data.meals : [];
  return meals.map((m) => hydrateMealSummary(m, catLabel));
}

export async function fetchMealsMultiFilter(opts: {
  categories: string[];
  ingredients: string[];
}): Promise<MealSummary[]> {
  const qs = new URLSearchParams({ action: 'meals-multi-filter' });
  if (opts.categories.length > 0) qs.set('categories', opts.categories.join(','));
  if (opts.ingredients.length > 0) qs.set('ingredients', opts.ingredients.join(','));
  const data = await requestJson<{ meals?: Record<string, unknown>[] }>(
    `/api/nutri?${qs.toString()}`
  );
  const fallbackCat = opts.categories[0] || 'Chicken';
  const meals = Array.isArray(data?.meals) ? data.meals : [];
  return meals.map((m) => hydrateMealSummary(m, fallbackCat));
}

export async function searchMealsByName(query: string): Promise<MealSummary[]> {
  if (!query.trim()) return [];
  const qs = new URLSearchParams({ action: 'meals-search', s: query.trim() });
  const data = await requestJson<{ meals?: Record<string, unknown>[] }>(
    `/api/nutri?${qs.toString()}`
  );
  const meals = Array.isArray(data?.meals) ? data.meals : [];
  return meals.map((m) => hydrateMealSummary(m));
}

export async function fetchMealDetail(idMeal: string): Promise<MealDetail> {
  const qs = new URLSearchParams({ action: 'meals-lookup', id: idMeal });
  const data = await requestJson<{ meal?: Record<string, unknown> }>(
    `/api/nutri?${qs.toString()}`
  );
  if (!data?.meal) {
    throw new Error('Recipe details were unavailable');
  }
  return hydrateMealDetail(data.meal);
}

export async function fetchFoodByBarcode(barcode: string): Promise<FoodProduct> {
  const qs = new URLSearchParams({ action: 'food-product', barcode: barcode.trim() });
  const data = await requestJson<{ product?: FoodProduct }>(
    `/api/nutri?${qs.toString()}`
  );
  if (!data?.product) {
    const err = new Error(`Product barcode ${barcode} was not found in Open Food Facts`) as Error & {
      notFound?: boolean;
    };
    err.notFound = true;
    throw err;
  }
  return data.product;
}

export async function searchFoodProducts(query: string): Promise<FoodProduct[]> {
  if (!query.trim()) return [];
  const qs = new URLSearchParams({ action: 'food-search', q: query.trim() });
  const data = await requestJson<{ products?: FoodProduct[] }>(
    `/api/nutri?${qs.toString()}`
  );
  return Array.isArray(data?.products) ? data.products : [];
}

export async function checkApiConnections(): Promise<{
  ok: boolean;
  apis: ApiDiagnosticItem[];
  timestamp: string;
}> {
  const data = await requestJson<{
    ok?: boolean;
    apis?: ApiDiagnosticItem[];
    timestamp?: string;
  }>('/api/health?checkApis=true');
  return {
    ok: Boolean(data?.ok),
    apis: Array.isArray(data?.apis) ? data.apis : [],
    timestamp: data?.timestamp || new Date().toISOString(),
  };
}
