import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Barcode,
  BookOpen,
  Check,
  CheckCircle2,
  Loader2,
  PackageSearch,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import {
  fetchFoodByBarcode,
  fetchMealDetail,
  fetchMealsMultiFilter,
  searchFoodProducts,
  searchMealsByName,
} from '../services/api';
import type { DailyTargets, FoodProduct, LogEntry, MealDetail, MealSummary } from '../types';
import {
  computeDailyBalance,
  formatInstructionSteps,
  getNutriScoreMeta,
} from '../utils/nutrition';

interface MealFinderProps {
  logs: LogEntry[];
  targets: DailyTargets;
  mode: 'recipes' | 'packaged';
  preselectedCategory?: string | null;
  onLogMeal: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onOpenCustomModal: (initialTitle?: string) => void;
}

const MEAL_CATEGORIES = [
  { id: 'Chicken', label: 'Chicken', hint: 'High Protein' },
  { id: 'Seafood', label: 'Seafood', hint: 'Lean Omega' },
  { id: 'Vegetarian', label: 'Vegetarian', hint: 'Plant Fiber' },
  { id: 'Beef', label: 'Beef', hint: 'Iron & Protein' },
  { id: 'Breakfast', label: 'Breakfast', hint: 'Morning Fuel' },
  { id: 'Pasta', label: 'Pasta', hint: 'Carb Recovery' },
  { id: 'Vegan', label: 'Vegan', hint: 'Whole Plant' },
  { id: 'Side', label: 'Light & Sides', hint: 'Low Calorie' },
  { id: 'Dessert', label: 'Dessert', hint: 'Sweet Treat' },
];

const INGREDIENT_FILTERS = [
  'Salmon',
  'Rice',
  'Apple',
  'Chicken Breast',
  'Avocado',
  'Egg',
  'Tomato',
  'Garlic',
];

const MEAL_SEARCH_PROMPTS = [
  'Chicken Breast',
  'Salmon',
  'Teriyaki',
  'Arrabiata',
  'Omelette',
  'Apple Pie',
  'Lentil',
  'Tuna',
];

const FOOD_SEARCH_PROMPTS = [
  { label: 'Nutella (Barcode 3017624010701)', value: '3017624010701' },
  { label: 'Oatmeal / Rolled Oats', value: 'oatmeal' },
  { label: 'Greek Yogurt', value: 'greek yogurt' },
  { label: 'Peanut Butter', value: 'peanut butter' },
  { label: 'Almond Milk', value: 'almond milk' },
  { label: 'Protein Bar', value: 'protein bar' },
];

export function MealFinder({
  logs,
  targets,
  mode,
  preselectedCategory = null,
  onLogMeal,
  onOpenCustomModal,
}: MealFinderProps) {
  // --- Recipe (TheMealDB) Multi-Select State ---
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    preselectedCategory ? [preselectedCategory] : []
  );
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [customIngredientInput, setCustomIngredientInput] = useState('');
  const [mealSearch, setMealSearch] = useState('');
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [showMealDropdown, setShowMealDropdown] = useState(false);

  const [meals, setMeals] = useState<MealSummary[]>([]);
  const [mealsLoading, setMealsLoading] = useState(true);
  const [mealsError, setMealsError] = useState('');
  const [servingsByMealId, setServingsByMealId] = useState<Record<string, string>>({});
  const [servingErrorId, setServingErrorId] = useState<string | null>(null);

  // Recipe Detail Modal
  const [activeRecipe, setActiveRecipe] = useState<MealDetail | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState('');
  const [modalServings, setModalServings] = useState('1');

  // --- Packaged Food (Open Food Facts) State ---
  const [foodQuery, setFoodQuery] = useState('3017624010701');
  const [showFoodDropdown, setShowFoodDropdown] = useState(false);
  const [foodResults, setFoodResults] = useState<FoodProduct[]>([]);
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState('');
  const [foodNotFound, setFoodNotFound] = useState(false);
  const [gramsByCode, setGramsByCode] = useState<Record<string, string>>({});
  const [gramsErrorCode, setGramsErrorCode] = useState<string | null>(null);

  const mealSearchRef = useRef<HTMLDivElement>(null);
  const foodSearchRef = useRef<HTMLDivElement>(null);

  const balance = computeDailyBalance(logs, targets);

  useEffect(() => {
    if (preselectedCategory) {
      setSelectedCategories([preselectedCategory]);
      setSelectedIngredients([]);
      setActiveSearchQuery('');
      setMealSearch('');
    }
  }, [preselectedCategory]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (mealSearchRef.current && !mealSearchRef.current.contains(e.target as Node)) {
        setShowMealDropdown(false);
      }
      if (foodSearchRef.current && !foodSearchRef.current.contains(e.target as Node)) {
        setShowFoodDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Load TheMealDB meals based on multi-select filters or explicit search
  const loadMeals = useCallback(async () => {
    setMealsLoading(true);
    setMealsError('');
    try {
      if (activeSearchQuery.trim()) {
        const found = await searchMealsByName(activeSearchQuery.trim());
        setMeals(Array.isArray(found) ? found : []);
      } else {
        const found = await fetchMealsMultiFilter({
          categories: selectedCategories,
          ingredients: selectedIngredients,
        });
        setMeals(Array.isArray(found) ? found : []);
      }
    } catch (err) {
      setMealsError(
        err instanceof Error ? err.message : 'Unable to connect to TheMealDB server.'
      );
    } finally {
      setMealsLoading(false);
    }
  }, [activeSearchQuery, selectedCategories, selectedIngredients]);

  useEffect(() => {
    if (mode === 'recipes') {
      loadMeals();
    }
  }, [loadMeals, mode]);

  // Initial Open Food Facts lookup (3017624010701)
  const runFoodLookup = useCallback(async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q) return;
    setFoodLoading(true);
    setFoodError('');
    setFoodNotFound(false);

    try {
      if (/^\d{4,18}$/.test(q)) {
        const product = await fetchFoodByBarcode(q);
        setFoodResults(product ? [product] : []);
        if (!product) setFoodNotFound(true);
      } else {
        const rawProducts = await searchFoodProducts(q);
        const products = Array.isArray(rawProducts) ? rawProducts : [];
        setFoodResults(products);
        if (products.length === 0) {
          setFoodNotFound(true);
        }
      }
    } catch (err) {
      const typedErr = err as Error & { notFound?: boolean };
      if (typedErr.notFound) {
        setFoodResults([]);
        setFoodNotFound(true);
      } else {
        setFoodError(typedErr.message || 'Unable to connect to Open Food Facts.');
      }
    } finally {
      setFoodLoading(false);
    }
  }, []);

  useEffect(() => {
    runFoodLookup('3017624010701');
  }, [runFoodLookup]);

  const toggleCategory = (catId: string) => {
    setActiveSearchQuery('');
    setMealSearch('');
    setSelectedCategories((prev) =>
      prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
    );
  };

  const toggleIngredient = (ing: string) => {
    setActiveSearchQuery('');
    setMealSearch('');
    setSelectedIngredients((prev) =>
      prev.includes(ing) ? prev.filter((item) => item !== ing) : [...prev, ing]
    );
  };

  const handleAddCustomIngredientTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customIngredientInput.trim();
    if (!cleaned) return;
    setActiveSearchQuery('');
    setMealSearch('');
    if (!selectedIngredients.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      setSelectedIngredients((prev) => [...prev, cleaned]);
    }
    setCustomIngredientInput('');
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedIngredients([]);
    setActiveSearchQuery('');
    setMealSearch('');
  };

  const loggedMealRefs = useMemo(() => {
    const map = new Map<string, number>();
    logs
      .filter((l) => l.type === 'meal' && l.sourceRefId)
      .forEach((l) => {
        const key = String(l.sourceRefId);
        map.set(key, (map.get(key) || 0) + 1);
      });
    return map;
  }, [logs]);

  const handleOpenRecipe = async (meal: MealSummary) => {
    setRecipeLoading(true);
    setRecipeError('');
    setModalServings('1');
    setActiveRecipe({
      ...meal,
      strCategory: meal.strCategory || selectedCategories[0] || 'Meal',
      strArea: meal.strArea || 'International',
      strInstructions: meal.strInstructions || 'Loading full instructions...',
      ingredients: [],
      estimatedKcal: meal.estimatedKcal || 450,
      estimatedProteinG: meal.estimatedProteinG || 30,
      estimatedCarbsG: meal.estimatedCarbsG || 40,
      estimatedFatG: meal.estimatedFatG || 15,
    });
    try {
      const detail = await fetchMealDetail(meal.idMeal);
      setActiveRecipe(detail);
    } catch (err) {
      setRecipeError(err instanceof Error ? err.message : 'Unable to load recipe details.');
    } finally {
      setRecipeLoading(false);
    }
  };

  const handleLogMealSummary = (meal: MealSummary, servingsRaw?: string) => {
    const servings = Number(servingsRaw ?? servingsByMealId[meal.idMeal] ?? '1');
    if (!Number.isFinite(servings) || servings <= 0 || servings > 20) {
      setServingErrorId(meal.idMeal);
      return;
    }
    setServingErrorId(null);
    const baseKcal = meal.estimatedKcal || 450;
    onLogMeal({
      type: 'meal',
      source: 'mealdb',
      sourceRefId: meal.idMeal,
      title: meal.strMeal,
      category: meal.strCategory || selectedCategories[0] || 'Meal',
      calories: Math.round(baseKcal * servings),
      amount: Number(servings.toFixed(2)),
      unit: servings === 1 ? 'serving' : 'servings',
      proteinG: meal.estimatedProteinG ? Math.round(meal.estimatedProteinG * servings) : undefined,
      carbsG: meal.estimatedCarbsG ? Math.round(meal.estimatedCarbsG * servings) : undefined,
      fatG: meal.estimatedFatG ? Math.round(meal.estimatedFatG * servings) : undefined,
    });
  };

  const handleLogFoodProduct = (product: FoodProduct) => {
    const rawGrams = gramsByCode[product.code] ?? '100';
    const grams = Number(rawGrams);
    if (!Number.isFinite(grams) || grams < 1 || grams > 3000) {
      setGramsErrorCode(product.code);
      return;
    }
    setGramsErrorCode(null);
    const kcalPer100 =
      product.nutriments?.['energy-kcal_100g'] ?? product.nutriments?.['energy-kcal'] ?? 0;
    const proteinPer100 = product.nutriments?.proteins_100g ?? 0;
    const carbsPer100 = product.nutriments?.carbohydrates_100g ?? 0;
    const fatPer100 = product.nutriments?.fat_100g ?? 0;
    const factor = grams / 100;

    onLogMeal({
      type: 'meal',
      source: 'openfoodfacts',
      sourceRefId: product.code,
      title: product.product_name,
      category: product.brands || 'Packaged Food',
      calories: Math.round(kcalPer100 * factor),
      amount: Math.round(grams),
      unit: 'g',
      proteinG: proteinPer100 ? Math.round(proteinPer100 * factor) : undefined,
      carbsG: carbsPer100 ? Math.round(carbsPer100 * factor) : undefined,
      fatG: fatPer100 ? Math.round(fatPer100 * factor) : undefined,
    });
  };

  const mealDropdownItems = useMemo(() => {
    const q = mealSearch.trim().toLowerCase();
    const titles = meals
      .map((m) => m.strMeal)
      .filter((t) => !q || t.toLowerCase().includes(q))
      .slice(0, 5);
    const presets = MEAL_SEARCH_PROMPTS.filter(
      (p) => (!q || p.toLowerCase().includes(q)) && !titles.includes(p)
    );
    return [...presets.slice(0, 4), ...titles].slice(0, 8);
  }, [meals, mealSearch]);

  const sortedMealsByFit = useMemo(() => {
    const targetMid =
      (balance.recommendedMealWindow.min + balance.recommendedMealWindow.max) / 2;
    return [...meals].sort((a, b) => {
      const diffA = Math.abs((a.estimatedKcal || 450) - targetMid);
      const diffB = Math.abs((b.estimatedKcal || 450) - targetMid);
      return diffA - diffB;
    });
  }, [meals, balance.recommendedMealWindow]);

  const hasActiveFilters =
    selectedCategories.length > 0 || selectedIngredients.length > 0 || Boolean(activeSearchQuery);

  return (
    <section
      id={mode === 'packaged' ? 'section-food' : 'section-meals'}
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
            {mode === 'recipes' ? (
              <>
                <BookOpen className="w-4 h-4" />
                <span>TheMealDB Recipe Finder · Calorie &amp; Nutrition Matched</span>
              </>
            ) : (
              <>
                <PackageSearch className="w-4 h-4" />
                <span>Open Food Facts · Packaged Food &amp; Barcode Lookup</span>
              </>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {mode === 'recipes'
              ? 'Meal & Recipe Recommendations'
              : 'Packaged Food & Barcode Lookup'}
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            {mode === 'recipes'
              ? 'Combine multiple categories or ingredients (e.g. Salmon + Rice, or Apple + Dessert), and click any meal photo to open its full recipe.'
              : 'Look up packaged foods by product name or numeric barcode (e.g. 3017624010701) with Nutri-Score and per-100g macros.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {mode === 'recipes' && (
            <button
              type="button"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Options</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenCustomModal((mode === 'recipes' ? mealSearch : foodQuery).trim() || undefined)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Custom Meal / Food</span>
          </button>
        </div>
      </div>

      {/* Exercise-Aware Nutritional Recommendation Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-emerald-50/70 border border-emerald-200">
        <div className="flex items-start sm:items-center gap-2.5 text-sm text-slate-800">
          <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            Based on your{' '}
            <strong className="font-mono tabular-nums">
              {targets.intakeTargetKcal.toLocaleString()} kcal
            </strong>{' '}
            target and{' '}
            <strong className="font-mono tabular-nums">
              {balance.burnedKcal.toLocaleString()} kcal
            </strong>{' '}
            exercise burn, aim for a{' '}
            <strong className="font-mono tabular-nums">
              {balance.recommendedMealWindow.min}–{balance.recommendedMealWindow.max} kcal
            </strong>{' '}
            meal ({balance.recommendedMealWindow.label}).
          </span>
        </div>

        {mode === 'recipes' &&
          !selectedCategories.includes(balance.recommendedMealWindow.suggestedCategory) && (
            <button
              type="button"
              onClick={() => {
                setActiveSearchQuery('');
                setMealSearch('');
                setSelectedIngredients([]);
                setSelectedCategories([balance.recommendedMealWindow.suggestedCategory]);
              }}
              className="px-3 py-1.5 rounded-md bg-white border border-emerald-300 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/70 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Show {balance.recommendedMealWindow.suggestedCategory} Picks
            </button>
          )}
      </div>

      {mode === 'recipes' ? (
        <div className="space-y-6">
          {/* Multi-Select Meal Categories */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                1. Meal Categories (Multi-Select · Default: All)
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
              {MEAL_CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    aria-pressed={active}
                    className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer relative ${
                      active
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="block text-xs font-semibold truncate">{cat.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                    </div>
                    <span className="block text-[11px] text-slate-500 mt-0.5 truncate">
                      {cat.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Select Key Ingredients */}
          <div className="space-y-2.5">
            <span className="block text-xs font-semibold text-slate-700">
              2. Combine Ingredients (Select multiple to match together, e.g. Salmon + Rice or
              Apple + Dessert)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {INGREDIENT_FILTERS.map((ing) => {
                const active = selectedIngredients.includes(ing);
                return (
                  <button
                    key={ing}
                    type="button"
                    onClick={() => toggleIngredient(ing)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{ing}</span>
                  </button>
                );
              })}

              {selectedIngredients
                .filter((ing) => !INGREDIENT_FILTERS.includes(ing))
                .map((ing) => (
                  <button
                    key={ing}
                    type="button"
                    onClick={() => toggleIngredient(ing)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-900 bg-slate-900 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
                  >
                    <span>{ing}</span>
                    <X className="w-3 h-3" />
                  </button>
                ))}

              <form onSubmit={handleAddCustomIngredientTag} className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={customIngredientInput}
                  onChange={(e) => setCustomIngredientInput(e.target.value)}
                  placeholder="+ Add ingredient..."
                  className="w-36 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                />
                {customIngredientInput.trim() && (
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                  >
                    Add
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Search Bar with Dropdown Prompts */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShowMealDropdown(false);
              setActiveSearchQuery(mealSearch.trim());
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div ref={mealSearchRef} className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={mealSearch}
                onFocus={() => setShowMealDropdown(true)}
                onChange={(e) => {
                  setMealSearch(e.target.value);
                  setShowMealDropdown(true);
                }}
                placeholder="Search recipes by name or ingredient (e.g. Chicken Breast, Salmon, Apple Pie)..."
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
              />
              {mealSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setMealSearch('');
                    setActiveSearchQuery('');
                  }}
                  aria-label="Clear recipe search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {showMealDropdown && mealDropdownItems.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Recipe suggestions"
                  className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-md max-h-56 overflow-y-auto divide-y divide-slate-100"
                >
                  {mealDropdownItems.map((item) => (
                    <li key={item}>
                      <button
                        type="button"
                        onClick={() => {
                          setMealSearch(item);
                          setActiveSearchQuery(item);
                          setShowMealDropdown(false);
                        }}
                        className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                      >
                        <span>{item}</span>
                        <span className="text-xs text-slate-400">Search recipe</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Find Meals
            </button>
          </form>

          {/* Active Multi-Filter Status Summary */}
          {!mealsLoading && !mealsError && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Showing <strong className="font-mono text-slate-900">{sortedMealsByFit.length}</strong>{' '}
                {sortedMealsByFit.length === 1 ? 'recipe' : 'recipes'}
                {activeSearchQuery
                  ? ` matching "${activeSearchQuery}"`
                  : selectedCategories.length > 0 || selectedIngredients.length > 0
                  ? ` matching ${[...selectedCategories, ...selectedIngredients].join(' + ')}`
                  : ' (featured chicken breast picks)'}
              </span>
              <span className="text-slate-500">Click any recipe image to view full recipe</span>
            </div>
          )}

          {/* Meal Results Grid */}
          {mealsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-72 rounded-lg border border-slate-200 bg-slate-50 animate-pulse overflow-hidden"
                >
                  <div className="h-36 bg-slate-200" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : mealsError ? (
            <div className="p-5 rounded-lg border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-900">
                    Could not reach TheMealDB Recipe Server
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5">{mealsError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={loadMeals}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-rose-900 hover:bg-rose-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCustomModal(mealSearch.trim() || undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Meal</span>
                </button>
              </div>
            </div>
          ) : sortedMealsByFit.length === 0 ? (
            <div className="p-8 rounded-lg border border-slate-200 bg-slate-50 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                No recipes found
                {activeSearchQuery
                  ? ` for "${activeSearchQuery}"`
                  : hasActiveFilters
                  ? ` combining ${[...selectedCategories, ...selectedIngredients].join(' + ')}`
                  : ''}
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Try removing one of the combined filters, searching another keyword, or adding a
                custom meal entry.
              </p>
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Clear Options
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenCustomModal(
                      activeSearchQuery || selectedIngredients.join(' ') || undefined
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Meal</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedMealsByFit.slice(0, 12).map((meal) => {
                const loggedCount = loggedMealRefs.get(meal.idMeal) || 0;
                const servingsStr = servingsByMealId[meal.idMeal] ?? '1';
                const servingsNum = Number(servingsStr);
                const estKcal =
                  Number.isFinite(servingsNum) && servingsNum > 0
                    ? Math.round((meal.estimatedKcal || 450) * servingsNum)
                    : meal.estimatedKcal || 450;
                const hasError = servingErrorId === meal.idMeal;

                return (
                  <article
                    key={meal.idMeal}
                    className={`rounded-lg border overflow-hidden flex flex-col justify-between transition-colors ${
                      loggedCount > 0
                        ? 'border-emerald-300 bg-emerald-50/25'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <button
                        type="button"
                        onClick={() => handleOpenRecipe(meal)}
                        aria-label={`Open recipe for ${meal.strMeal}`}
                        className="group relative w-full aspect-[16/10] bg-slate-100 overflow-hidden block text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600"
                      >
                        {meal.strMealThumb ? (
                          <>
                            <img
                              src={meal.strMealThumb}
                              alt={meal.strMeal}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                            />
                            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900/80 text-white text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                              <BookOpen className="w-3 h-3" />
                              <span>View recipe</span>
                            </span>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Utensils className="w-8 h-8" />
                          </div>
                        )}
                      </button>

                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
                          {meal.strMeal}
                        </h3>

                        <p className="text-xs text-slate-600 font-mono tabular-nums">
                          <span>{meal.strCategory || selectedCategories[0] || 'Meal'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>Est. {meal.estimatedKcal} kcal/srv</span>
                          <span aria-hidden="true"> · </span>
                          <span>{meal.estimatedProteinG}g protein</span>
                        </p>

                        {loggedCount > 0 && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Logged today ({loggedCount}×)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`srv-${meal.idMeal}`} className="text-xs text-slate-600">
                            Servings:
                          </label>
                          <input
                            id={`srv-${meal.idMeal}`}
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min={0.25}
                            max={15}
                            value={servingsStr}
                            onChange={(e) => {
                              setServingsByMealId((prev) => ({
                                ...prev,
                                [meal.idMeal]: e.target.value,
                              }));
                              setServingErrorId(null);
                            }}
                            className="w-16 px-2 py-1.5 rounded-md border border-slate-300 font-mono text-xs text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenRecipe(meal)}
                            className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                          >
                            Recipe
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLogMealSummary(meal)}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                              loggedCount > 0
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            }`}
                          >
                            {loggedCount > 0 ? 'Log Again' : 'Log'} ({estKcal})
                          </button>
                        </div>
                      </div>

                      {hasError && (
                        <p className="text-[11px] text-rose-700">
                          Enter a valid serving count between 0.25 and 15.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Packaged Foods & Barcode Lookup (Open Food Facts) */
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setShowFoodDropdown(false);
              runFoodLookup(foodQuery);
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div ref={foodSearchRef} className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={foodQuery}
                onFocus={() => setShowFoodDropdown(true)}
                onChange={(e) => {
                  setFoodQuery(e.target.value);
                  setShowFoodDropdown(true);
                }}
                placeholder="Enter barcode (e.g. 3017624010701) or food name (e.g. oatmeal)..."
                className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
              />
              {foodQuery && (
                <button
                  type="button"
                  onClick={() => setFoodQuery('')}
                  aria-label="Clear Open Food Facts search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {showFoodDropdown && (
                <ul
                  role="listbox"
                  aria-label="Packaged food suggestions"
                  className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-md max-h-56 overflow-y-auto divide-y divide-slate-100"
                >
                  {FOOD_SEARCH_PROMPTS.map((item) => (
                    <li key={item.value}>
                      <button
                        type="button"
                        onClick={() => {
                          setFoodQuery(item.value);
                          setShowFoodDropdown(false);
                          runFoodLookup(item.value);
                        }}
                        className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                      >
                        <span>{item.label}</span>
                        <span className="font-mono text-xs text-slate-400">{item.value}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lookup Nutrition
            </button>
          </form>

          {foodLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-48 rounded-lg border border-slate-200 bg-slate-50 animate-pulse p-4 space-y-3"
                >
                  <div className="h-4 w-2/3 bg-slate-200 rounded" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : foodError ? (
            <div className="p-5 rounded-lg border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-rose-900">
                    Open Food Facts Connection Error
                  </h3>
                  <p className="text-xs text-rose-800 mt-0.5">{foodError}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => runFoodLookup(foodQuery)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-rose-900 hover:bg-rose-100 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCustomModal(foodQuery.trim() || undefined)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Custom Food Entry</span>
                </button>
              </div>
            </div>
          ) : foodNotFound || foodResults.length === 0 ? (
            <div className="p-8 rounded-lg border border-slate-200 bg-slate-50 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                Product not found on Open Food Facts for &ldquo;{foodQuery}&rdquo;
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                If this packaged item isn&apos;t indexed yet, you can enter its nutrition label
                calories manually below.
              </p>
              <button
                type="button"
                onClick={() => onOpenCustomModal(foodQuery.trim() || undefined)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Food Entry</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {foodResults.map((product) => {
                const kcal100 =
                  product.nutriments?.['energy-kcal_100g'] ??
                  product.nutriments?.['energy-kcal'] ??
                  0;
                const protein100 = product.nutriments?.proteins_100g ?? 0;
                const carbs100 = product.nutriments?.carbohydrates_100g ?? 0;
                const fat100 = product.nutriments?.fat_100g ?? 0;
                const nutriMeta = getNutriScoreMeta(product.nutriscore_grade);

                const gramsStr = gramsByCode[product.code] ?? '100';
                const gramsNum = Number(gramsStr);
                const computedKcal =
                  Number.isFinite(gramsNum) && gramsNum > 0
                    ? Math.round((kcal100 * gramsNum) / 100)
                    : 0;
                const loggedCount = loggedMealRefs.get(product.code) || 0;
                const hasError = gramsErrorCode === product.code;

                return (
                  <article
                    key={product.code}
                    className={`rounded-lg border p-4 flex flex-col justify-between gap-3 ${
                      loggedCount > 0
                        ? 'border-emerald-300 bg-emerald-50/25'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex gap-3.5">
                      <div className="w-16 h-16 rounded-md bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        {product.image_small_url ? (
                          <img
                            src={product.image_small_url}
                            alt={product.product_name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <PackageSearch className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                          {product.product_name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">
                          {product.brands || 'Unknown Brand'}
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono">{product.code}</span>
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${nutriMeta.badgeClass}`}
                            title={nutriMeta.description}
                          >
                            {nutriMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nutrition per 100g */}
                    <div className="grid grid-cols-4 gap-2 py-2.5 px-3 rounded-md bg-slate-50 border border-slate-200 text-center font-mono tabular-nums">
                      <div>
                        <span className="block text-[10px] text-slate-500">kcal/100g</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {Math.round(kcal100)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Protein</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {protein100.toFixed(1)}g
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Carbs</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {carbs100.toFixed(1)}g
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Fat</span>
                        <span className="text-xs font-semibold text-slate-900">
                          {fat100.toFixed(1)}g
                        </span>
                      </div>
                    </div>

                    {loggedCount > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Logged today ({loggedCount}×)</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={`grams-${product.code}`} className="text-xs text-slate-600">
                            Amount:
                          </label>
                          <input
                            id={`grams-${product.code}`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={3000}
                            value={gramsStr}
                            onChange={(e) => {
                              setGramsByCode((prev) => ({
                                ...prev,
                                [product.code]: e.target.value,
                              }));
                              setGramsErrorCode(null);
                            }}
                            className="w-16 px-2 py-1.5 rounded-md border border-slate-300 font-mono text-xs text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
                          />
                          <span className="text-xs text-slate-500">g</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLogFoodProduct(product)}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            loggedCount > 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {loggedCount > 0 ? 'Log Again' : 'Log'} ({computedKcal} kcal)
                        </button>
                      </div>

                      {hasError && (
                        <p className="text-[11px] text-rose-700">
                          Enter a weight between 1g and 3,000g.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {activeRecipe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recipe-modal-title"
        >
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="min-w-0 pr-4">
                <p className="text-xs font-medium text-emerald-700">
                  {activeRecipe.strCategory} · {activeRecipe.strArea}
                </p>
                <h3
                  id="recipe-modal-title"
                  className="text-lg font-bold text-slate-900 truncate"
                >
                  {activeRecipe.strMeal}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRecipe(null)}
                aria-label="Close recipe"
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {recipeLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>Loading full recipe and ingredients from TheMealDB...</span>
                </div>
              ) : recipeError ? (
                <div className="p-4 rounded-lg border border-rose-200 bg-rose-50 flex items-center justify-between gap-3">
                  <span className="text-xs text-rose-800">{recipeError}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenRecipe(activeRecipe)}
                    className="px-3 py-1.5 rounded bg-white border border-rose-300 text-xs font-semibold text-rose-900 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                    <div className="sm:col-span-5 aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      {activeRecipe.strMealThumb ? (
                        <img
                          src={activeRecipe.strMealThumb}
                          alt={activeRecipe.strMeal}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Utensils className="w-8 h-8" />
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-7 space-y-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Estimated Nutrition (Per Serving)
                      </p>
                      <div className="grid grid-cols-4 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-center font-mono tabular-nums">
                        <div>
                          <span className="block text-[11px] text-slate-500">Calories</span>
                          <span className="text-sm font-bold text-slate-900">
                            {activeRecipe.estimatedKcal}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Protein</span>
                          <span className="text-sm font-bold text-slate-900">
                            {activeRecipe.estimatedProteinG}g
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Carbs</span>
                          <span className="text-sm font-bold text-slate-900">
                            {activeRecipe.estimatedCarbsG}g
                          </span>
                        </div>
                        <div>
                          <span className="block text-[11px] text-slate-500">Fat</span>
                          <span className="text-sm font-bold text-slate-900">
                            {activeRecipe.estimatedFatG}g
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-700 mb-1.5">
                          Ingredients ({(activeRecipe.ingredients ?? []).length})
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700">
                          {(activeRecipe.ingredients ?? []).map((ing, idx) => (
                            <li
                              key={`${ing.ingredient}-${idx}`}
                              className="px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200/70 flex justify-between gap-2"
                            >
                              <span className="font-medium text-slate-900 truncate">
                                {ing.ingredient}
                              </span>
                              <span className="text-slate-500 shrink-0">{ing.measure}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Preparation Instructions
                    </h4>
                    <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside leading-relaxed">
                      {formatInstructionSteps(activeRecipe.strInstructions).map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <label htmlFor="modal-servings" className="text-xs font-medium text-slate-700">
                  Servings to log:
                </label>
                <input
                  id="modal-servings"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0.25}
                  max={15}
                  value={modalServings}
                  onChange={(e) => setModalServings(e.target.value)}
                  className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveRecipe(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-200/70 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const srv = Number(modalServings);
                    if (!Number.isFinite(srv) || srv <= 0 || srv > 15) return;
                    handleLogMealSummary(activeRecipe, modalServings);
                    setActiveRecipe(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                >
                  Log Meal (
                  {Math.round(
                    (activeRecipe.estimatedKcal || 450) *
                      (Number(modalServings) > 0 ? Number(modalServings) : 1)
                  )}{' '}
                  kcal)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
