/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Flame,
  PackageSearch,
  Plus,
  SlidersHorizontal,
  Undo2,
  Utensils,
} from 'lucide-react';
import { ActivityMealLog } from './components/ActivityMealLog';
import { CalorieDonutInfographic } from './components/CalorieDonutInfographic';
import { CustomEntryModal } from './components/CustomEntryModal';
import { ExercisePlanner } from './components/ExercisePlanner';
import { HelpModal } from './components/HelpModal';
import { MealFinder } from './components/MealFinder';
import { TargetGoalModal } from './components/TargetGoalModal';
import { TopStatusBar } from './components/TopStatusBar';
import type { ActiveSection, DailyTargets, LogEntry, UndoAction } from './types';
import { computeDailyBalance } from './utils/nutrition';

const STORAGE_LOGS_KEY = 'nutrime_daily_logs_v1';
const STORAGE_TARGETS_KEY = 'nutrime_daily_targets_v1';

const DEFAULT_TARGETS: DailyTargets = {
  intakeTargetKcal: 2100,
  burnTargetKcal: 300,
  goalPreset: 'maintenance',
};

function loadInitialLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInitialTargets(): DailyTargets {
  try {
    const raw = localStorage.getItem(STORAGE_TARGETS_KEY);
    if (!raw) return DEFAULT_TARGETS;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.intakeTargetKcal === 'number' &&
      typeof parsed.burnTargetKcal === 'number'
    ) {
      return parsed as DailyTargets;
    }
    return DEFAULT_TARGETS;
  } catch {
    return DEFAULT_TARGETS;
  }
}

const OVERVIEW_EXERCISE_BLOCKS = [
  { id: 15, label: 'Cardio', subtitle: 'High calorie burn' },
  { id: 10, label: 'Abs & Core', subtitle: 'Core stability' },
  { id: 9, label: 'Legs', subtitle: 'Lower body strength' },
  { id: 12, label: 'Back & Posture', subtitle: 'Upper back focus' },
];

const OVERVIEW_MEAL_BLOCKS = [
  { id: 'Chicken', label: 'Chicken', subtitle: 'High-protein meals' },
  { id: 'Seafood', label: 'Seafood', subtitle: 'Lean omega dishes' },
  { id: 'Vegetarian', label: 'Vegetarian', subtitle: 'Plant-forward recipes' },
  { id: 'Dessert', label: 'Dessert', subtitle: 'Portion-tracked treats' },
];

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>(loadInitialLogs);
  const [targets, setTargets] = useState<DailyTargets>(loadInitialTargets);
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);

  // Separate pages: 'overview' | 'exercises' | 'meals' | 'food' | 'log'
  const [activePage, setActivePage] = useState<ActiveSection>('overview');
  const [jumpExerciseCategoryId, setJumpExerciseCategoryId] = useState<number | null>(null);
  const [jumpMealCategory, setJumpMealCategory] = useState<string | null>(null);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [customModalState, setCustomModalState] = useState<{
    open: boolean;
    tab: 'exercise' | 'meal';
    initialTitle?: string;
  }>({ open: false, tab: 'exercise' });

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    canUndo: boolean;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs));
    } catch {
      // Ignore storage quota errors
    }
  }, [logs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TARGETS_KEY, JSON.stringify(targets));
    } catch {
      // Ignore storage quota errors
    }
  }, [targets]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const pushUndo = (description: string, prevLogs: LogEntry[], prevTargets: DailyTargets) => {
    const snapshot: UndoAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      description,
      previousLogs: prevLogs,
      previousTargets: prevTargets,
    };
    setUndoStack((prev) => [snapshot, ...prev].slice(0, 20));
  };

  const handleAddLog = (entryInput: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entryInput,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    pushUndo(`Added ${newEntry.title}`, logs, targets);
    setLogs((prev) => [newEntry, ...prev]);
    setToastMessage({
      text: `Logged ${newEntry.title} (${newEntry.type === 'exercise' ? '-' : '+'}${newEntry.calories} kcal)`,
      canUndo: true,
    });
  };

  const handleDeleteLog = (id: string) => {
    const targetEntry = logs.find((l) => l.id === id);
    if (!targetEntry) return;
    pushUndo(`Removed ${targetEntry.title}`, logs, targets);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setToastMessage({
      text: `Removed ${targetEntry.title} from today's log`,
      canUndo: true,
    });
  };

  const handleUpdateTargets = (next: DailyTargets) => {
    pushUndo('Updated daily calorie targets', logs, targets);
    setTargets(next);
    setToastMessage({
      text: `Daily target updated to ${next.intakeTargetKcal.toLocaleString()} kcal`,
      canUndo: true,
    });
  };

  const handleUndo = () => {
    const latest = undoStack[0];
    if (!latest) return;
    setLogs(latest.previousLogs);
    setTargets(latest.previousTargets);
    setUndoStack((prev) => prev.slice(1));
    setToastMessage({
      text: `Undid: ${latest.description}`,
      canUndo: false,
    });
  };

  const navigateTo = (page: ActiveSection, keepJump = false) => {
    if (!keepJump) {
      setJumpExerciseCategoryId(null);
      setJumpMealCategory(null);
    }
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const balance = computeDailyBalance(logs, targets);
  const isOverTarget = balance.remainingKcal < 0;

  return (
    <div id="top" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Sticky Hamburger Tab + Locked Daily Target Status Bar + Quick Action Icons + Locked Page Navigation */}
      <TopStatusBar
        logs={logs}
        targets={targets}
        undoStack={undoStack}
        activeSection={activePage}
        onSelectSection={navigateTo}
        onUndo={handleUndo}
        onOpenGoalModal={() => setGoalModalOpen(true)}
        onOpenCustomModal={(tab) => setCustomModalState({ open: true, tab })}
        onOpenHelpModal={() => setHelpModalOpen(true)}
      />

      {/* Active Page Workspace */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {activePage === 'overview' && (
          <div id="section-overview" className="space-y-6">
            {/* Overview Hero, Donut Infographic & Clickable KPI Boxes */}
            <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                    nutri-me Daily Health &amp; Calorie Planner
                  </h1>
                  <p className="text-sm text-slate-600 max-w-2xl">
                    Click any visual box below to jump straight to Exercises, Meal Finder, Packaged
                    Foods, or your Activity Log.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGoalModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Set Calorie Targets</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomModalState({ open: true, tab: 'meal' })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Quick Custom Entry</span>
                  </button>
                </div>
              </div>

              {/* Target Calorie Donut Infographic */}
              <CalorieDonutInfographic logs={logs} targets={targets} />

              {/* 4-Column Clickable KPI Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(true)}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-slate-300 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Daily Calorie Target</span>
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {targets.intakeTargetKcal.toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Burn goal: {targets.burnTargetKcal.toLocaleString()} kcal
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('meals')}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-emerald-300 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Food Consumed</span>
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
                    +{balance.consumedKcal.toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
                    <span>Open Meal Finder</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('exercises')}
                  className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 hover:border-amber-300 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Exercise Burned</span>
                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <p className="mt-1 font-mono text-xl font-bold text-amber-700 tabular-nums">
                    -{balance.burnedKcal.toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-amber-800 font-medium mt-0.5 flex items-center gap-1">
                    <span>Open Exercises</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => navigateTo('log')}
                  className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isOverTarget
                      ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                      : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>{isOverTarget ? 'Over Daily Limit' : 'Remaining Meal Budget'}</span>
                    <ClipboardList
                      className={`w-3.5 h-3.5 ${
                        isOverTarget ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    />
                  </div>
                  <p
                    className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                      isOverTarget ? 'text-rose-700' : 'text-emerald-800'
                    }`}
                  >
                    {Math.abs(balance.remainingKcal).toLocaleString()} kcal
                  </p>
                  <p className="text-xs text-slate-700 font-medium mt-0.5 flex items-center gap-1">
                    <span>View Activity Log ({logs.length})</span>
                    <ArrowRight className="w-3 h-3" />
                  </p>
                </button>
              </div>
            </section>

            {/* Clickable Visual Category Boxes -> Jump directly into Exercises or Meal Finder */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Exercise Visual Boxes */}
              <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Jump to Exercise Focus
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any visual block to open Exercise Planner
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setJumpExerciseCategoryId(null);
                      navigateTo('exercises');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    <span>All Exercises</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {OVERVIEW_EXERCISE_BLOCKS.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => {
                        setJumpExerciseCategoryId(block.id);
                        navigateTo('exercises', true);
                      }}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-amber-50/60 hover:border-amber-300 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <Dumbbell className="w-4 h-4 text-amber-700" />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-700 transition-colors" />
                      </div>
                      <span className="block mt-2 text-sm font-semibold text-slate-900">
                        {block.label}
                      </span>
                      <span className="block text-xs text-slate-500">{block.subtitle}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Meal & Packaged Food Visual Boxes */}
              <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Jump to Meal &amp; Food Finder
                    </h2>
                    <p className="text-xs text-slate-500">
                      Click any visual block to browse recipes or packaged foods
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo('food')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    <PackageSearch className="w-3.5 h-3.5" />
                    <span>Packaged Food</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {OVERVIEW_MEAL_BLOCKS.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => {
                        setJumpMealCategory(block.id);
                        navigateTo('meals', true);
                      }}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <Utensils className="w-4 h-4 text-emerald-700" />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
                      </div>
                      <span className="block mt-2 text-sm font-semibold text-slate-900">
                        {block.label}
                      </span>
                      <span className="block text-xs text-slate-500">{block.subtitle}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activePage === 'exercises' && (
          <ExercisePlanner
            logs={logs}
            targets={targets}
            initialCategoryId={jumpExerciseCategoryId}
            onLogExercise={handleAddLog}
            onOpenCustomModal={(initialTitle) =>
              setCustomModalState({ open: true, tab: 'exercise', initialTitle })
            }
          />
        )}

        {activePage === 'meals' && (
          <MealFinder
            logs={logs}
            targets={targets}
            mode="recipes"
            preselectedCategory={jumpMealCategory}
            onLogMeal={handleAddLog}
            onOpenCustomModal={(initialTitle) =>
              setCustomModalState({ open: true, tab: 'meal', initialTitle })
            }
          />
        )}

        {activePage === 'food' && (
          <MealFinder
            logs={logs}
            targets={targets}
            mode="packaged"
            onLogMeal={handleAddLog}
            onOpenCustomModal={(initialTitle) =>
              setCustomModalState({ open: true, tab: 'meal', initialTitle })
            }
          />
        )}

        {activePage === 'log' && (
          <ActivityMealLog
            logs={logs}
            targets={targets}
            undoStack={undoStack}
            onDeleteLog={handleDeleteLog}
            onUndo={handleUndo}
            onOpenCustomModal={(tab) => setCustomModalState({ open: true, tab })}
          />
        )}
      </main>

      {/* Modals */}
      {goalModalOpen && (
        <TargetGoalModal
          targets={targets}
          onSave={handleUpdateTargets}
          onClose={() => setGoalModalOpen(false)}
        />
      )}

      {customModalState.open && (
        <CustomEntryModal
          initialTab={customModalState.tab}
          initialTitle={customModalState.initialTitle}
          onAddLog={handleAddLog}
          onClose={() => setCustomModalState({ open: false, tab: 'exercise' })}
        />
      )}

      {helpModalOpen && <HelpModal onClose={() => setHelpModalOpen(false)} />}

      {/* Confirmation Toast with Instant Undo */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs sm:text-sm shadow-lg border border-slate-700 max-w-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{toastMessage.text}</span>
          {toastMessage.canUndo && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold text-xs shrink-0 cursor-pointer"
            >
              <Undo2 className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
