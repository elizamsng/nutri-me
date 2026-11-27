import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Flame,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { fetchWgerExercises, fetchWgerMeta } from '../services/api';
import type {
  DailyTargets,
  ExerciseItem,
  LogEntry,
  WgerCategoryOption,
  WgerEquipmentOption,
} from '../types';
import { computeDailyBalance } from '../utils/nutrition';

interface ExercisePlannerProps {
  logs: LogEntry[];
  targets: DailyTargets;
  initialCategoryId?: number | null;
  onLogExercise: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onOpenCustomModal: (initialTitle?: string) => void;
}

const FALLBACK_CATEGORIES: WgerCategoryOption[] = [
  { id: 15, name: 'Cardio' },
  { id: 10, name: 'Abs' },
  { id: 9, name: 'Legs' },
  { id: 11, name: 'Chest' },
  { id: 12, name: 'Back' },
  { id: 8, name: 'Arms' },
  { id: 13, name: 'Shoulders' },
  { id: 14, name: 'Calves' },
];

const FALLBACK_EQUIPMENT: WgerEquipmentOption[] = [
  { id: 7, name: 'none (bodyweight exercise)' },
  { id: 3, name: 'Dumbbell' },
  { id: 1, name: 'Barbell' },
  { id: 10, name: 'Kettlebell' },
  { id: 11, name: 'Resistance band' },
  { id: 6, name: 'Pull-up bar' },
  { id: 8, name: 'Bench' },
  { id: 4, name: 'Gym mat' },
];

const QUICK_EXERCISE_PROMPTS = [
  'Squat',
  'Push-up',
  'Kettlebell Swing',
  'Cycling',
  'Plank',
  'Dumbbell Row',
  'Lunges',
  'Pull-up',
];

function formatEquipmentLabel(name: string): string {
  if (name.toLowerCase().includes('none')) return 'Bodyweight';
  return name;
}

export function ExercisePlanner({
  logs,
  targets,
  initialCategoryId = null,
  onLogExercise,
  onOpenCustomModal,
}: ExercisePlannerProps) {
  const [categories, setCategories] = useState<WgerCategoryOption[]>(FALLBACK_CATEGORIES);
  const [equipmentOptions, setEquipmentOptions] =
    useState<WgerEquipmentOption[]>(FALLBACK_EQUIPMENT);

  // Multi-select state (default [] = All)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
    initialCategoryId ? [initialCategoryId] : []
  );
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [durationById, setDurationById] = useState<Record<number, string>>({});
  const [defaultDuration, setDefaultDuration] = useState<string>('30');
  const [durationErrorId, setDurationErrorId] = useState<number | null>(null);

  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCategoryId) {
      setSelectedCategoryIds([initialCategoryId]);
    }
  }, [initialCategoryId]);

  useEffect(() => {
    let mounted = true;
    fetchWgerMeta()
      .then((meta) => {
        if (!mounted) return;
        if (meta.categories.length > 0) setCategories(meta.categories);
        if (meta.equipment.length > 0) setEquipmentOptions(meta.equipment);
      })
      .catch(() => {
        // Fallback metadata already initialized
      });
    return () => {
      mounted = false;
    };
  }, []);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWgerExercises({
        categoryIds: selectedCategoryIds,
        equipmentIds: selectedEquipmentIds,
        limit: 50,
      });
      setExercises(data.exercises);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load exercises from Wger. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryIds, selectedEquipmentIds]);

  useEffect(() => {
    loadExercises();
  }, [loadExercises]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const balance = computeDailyBalance(logs, targets);

  const toggleCategory = (catId: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const toggleEquipment = (eqId: number) => {
    setSelectedEquipmentIds((prev) =>
      prev.includes(eqId) ? prev.filter((id) => id !== eqId) : [...prev, eqId]
    );
  };

  const clearAllOptions = () => {
    setSelectedCategoryIds([]);
    setSelectedEquipmentIds([]);
    setSearchQuery('');
  };

  const hasFilters =
    selectedCategoryIds.length > 0 ||
    selectedEquipmentIds.length > 0 ||
    searchQuery.trim().length > 0;

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesCat =
        selectedCategoryIds.length === 0 || selectedCategoryIds.includes(ex.categoryId);
      const matchesEq =
        selectedEquipmentIds.length === 0 ||
        ex.equipment.some((eq) => selectedEquipmentIds.includes(eq.id));
      const matchesQuery =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        ex.muscles.some((m) => m.toLowerCase().includes(q)) ||
        ex.equipment.some((eq) => eq.name.toLowerCase().includes(q));
      return matchesCat && matchesEq && matchesQuery;
    });
  }, [exercises, selectedCategoryIds, selectedEquipmentIds, searchQuery]);

  const dropdownSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const exerciseNames = exercises
      .map((e) => e.name)
      .filter((name) => !q || name.toLowerCase().includes(q))
      .slice(0, 6);
    const prompts = QUICK_EXERCISE_PROMPTS.filter(
      (p) => (!q || p.toLowerCase().includes(q)) && !exerciseNames.includes(p)
    );
    return [...exerciseNames, ...prompts].slice(0, 7);
  }, [exercises, searchQuery]);

  const loggedMap = useMemo(() => {
    const map = new Map<string, { count: number; totalMins: number }>();
    logs
      .filter((l) => l.type === 'exercise' && l.sourceRefId)
      .forEach((l) => {
        const key = String(l.sourceRefId);
        const prev = map.get(key) || { count: 0, totalMins: 0 };
        map.set(key, {
          count: prev.count + 1,
          totalMins: prev.totalMins + l.amount,
        });
      });
    return map;
  }, [logs]);

  const getDurationFor = (id: number) => {
    return durationById[id] ?? defaultDuration;
  };

  const handleLogClick = (ex: ExerciseItem) => {
    const rawDuration = getDurationFor(ex.id);
    const mins = Number(rawDuration);
    if (!Number.isFinite(mins) || mins < 1 || mins > 360) {
      setDurationErrorId(ex.id);
      return;
    }
    setDurationErrorId(null);
    const burned = Math.round(ex.kcalPerMin * mins);
    onLogExercise({
      type: 'exercise',
      source: 'wger',
      sourceRefId: String(ex.id),
      title: ex.name,
      category: ex.category,
      calories: burned,
      amount: Math.round(mins),
      unit: 'min',
    });
  };

  const recommendedMinutes = Math.max(
    15,
    Math.min(60, Math.round(balance.burnRemainingKcal / 6.5 / 5) * 5 || 30)
  );

  return (
    <section
      id="section-exercises"
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
            <Dumbbell className="w-4 h-4" />
            <span>Wger Exercise Library · Interest &amp; Equipment Planner</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Exercise Recommendations
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Multi-select workout muscle groups and available equipment to get guided exercises with
            clear instructions and calorie burn estimates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <Clock className="w-4 h-4 text-slate-500" />
            <label htmlFor="default-duration" className="text-xs font-medium text-slate-600">
              Default min
            </label>
            <input
              id="default-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={240}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(e.target.value)}
              className="w-14 px-1.5 py-0.5 rounded border border-slate-300 bg-white font-mono text-xs text-slate-900 tabular-nums text-center focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="button"
            onClick={clearAllOptions}
            disabled={!hasFilters}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear Options</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenCustomModal(searchQuery.trim() || undefined)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Custom Exercise</span>
          </button>
        </div>
      </div>

      {/* Dynamic Recommendation Callout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-amber-50/70 border border-amber-200/80">
        <div className="flex items-start sm:items-center gap-2.5 text-sm text-slate-800">
          <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
          <span>
            {balance.burnRemainingKcal > 0 ? (
              <>
                You have{' '}
                <strong className="font-mono tabular-nums">
                  {balance.burnRemainingKcal.toLocaleString()} kcal
                </strong>{' '}
                remaining toward your daily burn goal — a{' '}
                <strong className="font-mono tabular-nums">{recommendedMinutes}-min</strong> session{' '}
                keeps you on pace.
              </>
            ) : (
              <>
                Daily burn goal reached (
                <strong className="font-mono tabular-nums">
                  {balance.burnedKcal.toLocaleString()} kcal
                </strong>{' '}
                burned today). Try light mobility or stretching, or raise your goal anytime.
              </>
            )}
          </span>
        </div>

        {!selectedCategoryIds.includes(15) && balance.burnRemainingKcal > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedCategoryIds([15]);
              setDefaultDuration(String(recommendedMinutes));
            }}
            className="px-3 py-1.5 rounded-md bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100/60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Suggest Cardio ({recommendedMinutes}m)
          </button>
        )}
      </div>

      {/* Visual Blocks for Interest / Muscle Categories (Multi-Select) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">
            1. Choose Workout Interest / Muscle Group (Multi-Select · Default: All)
          </span>
          {selectedCategoryIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategoryIds([])}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Reset to All
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategoryIds([])}
            aria-pressed={selectedCategoryIds.length === 0}
            className={`px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
              selectedCategoryIds.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4 mb-1 opacity-80" />
            <span className="block text-xs font-semibold truncate">All</span>
          </button>
          {categories.map((cat) => {
            const active = selectedCategoryIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                aria-pressed={active}
                className={`px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Dumbbell className="w-4 h-4 opacity-75" />
                  {active && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                </div>
                <span className="block text-xs font-semibold truncate">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment Availability Filter Blocks (Multi-Select) + Search with Dropdown Prompts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between">
            <span className="block text-xs font-semibold text-slate-700">
              2. Equipment Availability (Multi-Select · Default: All)
            </span>
            {selectedEquipmentIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedEquipmentIds([])}
                className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
              >
                Reset equipment
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedEquipmentIds([])}
              aria-pressed={selectedEquipmentIds.length === 0}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                selectedEquipmentIds.length === 0
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Equipment
            </button>
            {equipmentOptions.slice(0, 8).map((eq) => {
              const active = selectedEquipmentIds.includes(eq.id);
              return (
                <button
                  key={eq.id}
                  type="button"
                  onClick={() => toggleEquipment(eq.id)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {active && <Check className="w-3 h-3 text-emerald-700" />}
                  <span>{formatEquipmentLabel(eq.name)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Bar with Recognition Dropdown */}
        <div ref={searchWrapperRef} className="lg:col-span-5 relative space-y-2">
          <label htmlFor="exercise-search" className="block text-xs font-semibold text-slate-700">
            3. Search Exercises (with Suggestions)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="exercise-search"
              type="text"
              value={searchQuery}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search name, muscle, or equipment..."
              className="w-full pl-9 pr-9 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear exercise search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {showDropdown && dropdownSuggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Exercise suggestions"
              className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-md max-h-56 overflow-y-auto divide-y divide-slate-100"
            >
              {dropdownSuggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      setShowDropdown(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                  >
                    <span>{suggestion}</span>
                    <span className="text-xs text-slate-400">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Loading / Error / Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-lg border border-slate-200 bg-slate-50 animate-pulse p-4 space-y-3"
            >
              <div className="h-4 w-2/3 bg-slate-200 rounded" />
              <div className="h-3 w-1/2 bg-slate-200 rounded" />
              <div className="h-9 w-full bg-slate-200 rounded mt-6" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-5 rounded-lg border border-rose-200 bg-rose-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-rose-900">
                Could not reach the Wger Exercise Server
              </h3>
              <p className="text-xs text-rose-800 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadExercises}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-rose-900 hover:bg-rose-100 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCustomModal(searchQuery.trim() || undefined)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Exercise</span>
            </button>
          </div>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="p-8 rounded-lg border border-slate-200 bg-slate-50 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            No matching exercises found{searchQuery ? ` for "${searchQuery}"` : ''}
          </p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Try clearing your selected options or log this activity directly as a custom exercise
            so your calorie burn stays accurate.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={clearAllOptions}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Clear Options
            </button>
            <button
              type="button"
              onClick={() => onOpenCustomModal(searchQuery.trim() || undefined)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log &ldquo;{searchQuery.trim() || 'Custom Exercise'}&rdquo;</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExercises.slice(0, 15).map((ex) => {
            const durationStr = getDurationFor(ex.id);
            const minsNum = Number(durationStr);
            const estimatedBurn =
              Number.isFinite(minsNum) && minsNum > 0 ? Math.round(ex.kcalPerMin * minsNum) : 0;
            const loggedInfo = loggedMap.get(String(ex.id));
            const isExpanded = expandedId === ex.id;
            const hasDurationError = durationErrorId === ex.id;

            return (
              <article
                key={ex.id}
                className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  loggedInfo
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-slate-900 leading-snug">
                      {ex.name}
                    </h3>
                    <span className="font-mono text-xs font-medium text-amber-700 whitespace-nowrap shrink-0 tabular-nums">
                      ~{ex.kcalPerMin} kcal/m
                    </span>
                  </div>

                  {/* Clean zero-pill metadata */}
                  <p className="text-xs text-slate-600">
                    <span>{ex.category}</span>
                    <span aria-hidden="true"> · </span>
                    <span>
                      {ex.equipment.map((eq) => formatEquipmentLabel(eq.name)).join(', ')}
                    </span>
                    {ex.muscles.length > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{ex.muscles.slice(0, 2).join(', ')}</span>
                      </>
                    )}
                  </p>

                  {loggedInfo && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        Logged today ({loggedInfo.count}× · {loggedInfo.totalMins} min)
                      </span>
                    </div>
                  )}

                  {/* Expandable plain-language steps */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide instructions' : 'How to perform'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {isExpanded && (
                      <ol className="mt-2 space-y-1.5 text-xs text-slate-700 list-decimal list-inside bg-slate-50 p-3 rounded-md border border-slate-200">
                        {ex.steps.slice(0, 5).map((step, idx) => (
                          <li key={idx} className="leading-relaxed">
                            {step}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>

                {/* Duration & Log Bar */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor={`dur-${ex.id}`} className="text-xs text-slate-600">
                        Time:
                      </label>
                      <input
                        id={`dur-${ex.id}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={360}
                        value={durationStr}
                        onChange={(e) => {
                          setDurationById((prev) => ({ ...prev, [ex.id]: e.target.value }));
                          setDurationErrorId(null);
                        }}
                        className="w-16 px-2 py-1.5 rounded-md border border-slate-300 font-mono text-xs text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
                      />
                      <span className="text-xs text-slate-500">min</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLogClick(ex)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        loggedInfo
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>
                        {loggedInfo ? 'Log Again' : 'Log'} ({estimatedBurn} kcal)
                      </span>
                    </button>
                  </div>

                  {hasDurationError && (
                    <p className="text-[11px] text-rose-700">
                      Enter a duration between 1 and 360 minutes.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
