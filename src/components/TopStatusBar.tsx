import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  HelpCircle,
  LayoutDashboard,
  Menu,
  PackageSearch,
  Plus,
  SlidersHorizontal,
  Undo2,
  Utensils,
  X,
} from 'lucide-react';
import type { ActiveSection, DailyTargets, LogEntry, UndoAction } from '../types';
import { computeDailyBalance } from '../utils/nutrition';

interface TopStatusBarProps {
  logs: LogEntry[];
  targets: DailyTargets;
  undoStack: UndoAction[];
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  onUndo: () => void;
  onOpenGoalModal: () => void;
  onOpenCustomModal: (initialTab: 'exercise' | 'meal') => void;
  onOpenHelpModal: () => void;
}

const NAV_ITEMS: {
  id: ActiveSection;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'exercises', label: 'Exercises', icon: Dumbbell },
  { id: 'meals', label: 'Meal Finder', icon: Utensils },
  { id: 'food', label: 'Packaged Food', icon: PackageSearch },
  { id: 'log', label: 'Activity Log', icon: ClipboardList },
];

export function TopStatusBar({
  logs,
  targets,
  undoStack,
  activeSection,
  onSelectSection,
  onUndo,
  onOpenGoalModal,
  onOpenCustomModal,
  onOpenHelpModal,
}: TopStatusBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openQuickMenu, setOpenQuickMenu] = useState<'exercise' | 'food' | null>(null);

  const quickActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setOpenQuickMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const balance = computeDailyBalance(logs, targets);
  const progressPct = Math.min(
    100,
    Math.max(0, Math.round((balance.netKcal / Math.max(1, targets.intakeTargetKcal)) * 100))
  );
  const isOverTarget = balance.remainingKcal < 0;
  const latestUndo = undoStack[0];

  const handleNavClick = (section: ActiveSection) => {
    onSelectSection(section);
    setDrawerOpen(false);
    setOpenQuickMenu(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        {/* Row 1: Hamburger Tab + Brand + Locked Daily Target Status Bar + Quick Action Icons + Undo/Help */}
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-5">
          {/* Zone 1: Hamburger Tab + Single-line Brand */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-emerald-600 transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('overview')}
              className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              nutri-me
            </button>
          </div>

          {/* Zone 2: Locked Daily Target Status Bar + Quick Exercise/Food Dropdown Icons */}
          <div className="flex-1 max-w-3xl flex items-center justify-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onOpenGoalModal}
              title="Click to adjust daily calorie target and burn goal"
              className="flex-1 flex items-center justify-between gap-3 sm:gap-5 px-3 sm:px-4 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 min-w-0"
            >
              <div className="flex items-center gap-3 sm:gap-5 min-w-0 overflow-x-auto no-scrollbar">
                <div className="shrink-0">
                  <span className="block text-[11px] font-medium text-slate-500 leading-none">
                    Daily Target
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 tabular-nums">
                    {targets.intakeTargetKcal.toLocaleString()} kcal
                  </span>
                </div>

                <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                  /
                </span>

                <div className="shrink-0 hidden sm:block">
                  <span className="block text-[11px] font-medium text-slate-500 leading-none">
                    Food In
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-semibold text-slate-800 tabular-nums">
                    +{balance.consumedKcal.toLocaleString()}
                  </span>
                </div>

                <div className="shrink-0 hidden md:block">
                  <span className="block text-[11px] font-medium text-slate-500 leading-none">
                    Exercise Out
                  </span>
                  <span className="font-mono text-xs sm:text-sm font-semibold text-amber-700 tabular-nums">
                    -{balance.burnedKcal.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-slate-200">
                {isOverTarget ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 leading-none">
                    {isOverTarget ? 'Over Target' : 'Remaining'}
                  </span>
                  <span
                    className={`font-mono text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ${
                      isOverTarget ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {Math.abs(balance.remainingKcal).toLocaleString()} kcal
                  </span>
                </div>
              </div>
            </button>

            {/* Quick Actions Next to Daily Target: Exercise & Food Icons with Hover Help + API/Custom Dropdown */}
            <div ref={quickActionsRef} className="flex items-center gap-1.5 shrink-0">
              {/* Quick Exercise Icon + Hover Help + Dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() =>
                    setOpenQuickMenu((prev) => (prev === 'exercise' ? null : 'exercise'))
                  }
                  aria-label="Quick add exercise from API or custom entry"
                  aria-expanded={openQuickMenu === 'exercise'}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                    openQuickMenu === 'exercise'
                      ? 'bg-amber-50 border-amber-400 text-amber-900'
                      : 'bg-white border-slate-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <Dumbbell className="w-4 h-4" />
                </button>

                {/* Hover Help Tooltip */}
                {openQuickMenu !== 'exercise' && (
                  <div
                    role="tooltip"
                    className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-1.5 z-50 w-52 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-[11px] leading-snug shadow-md"
                  >
                    Quick log exercise: click to pick from Wger API or enter a custom workout.
                  </div>
                )}

                {openQuickMenu === 'exercise' && (
                  <div
                    role="menu"
                    aria-label="Exercise quick actions"
                    className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5"
                  >
                    <p className="px-3 py-1 text-[11px] font-semibold text-slate-500">
                      Quick Log Exercise
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavClick('exercises')}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Dumbbell className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Choose from Wger API</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenQuickMenu(null);
                        onOpenCustomModal('exercise');
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>Log Custom Exercise</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Quick Food Icon + Hover Help + Dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => setOpenQuickMenu((prev) => (prev === 'food' ? null : 'food'))}
                  aria-label="Quick add food from API or custom entry"
                  aria-expanded={openQuickMenu === 'food'}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600 ${
                    openQuickMenu === 'food'
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900'
                      : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <Utensils className="w-4 h-4" />
                </button>

                {/* Hover Help Tooltip */}
                {openQuickMenu !== 'food' && (
                  <div
                    role="tooltip"
                    className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute right-0 top-full mt-1.5 z-50 w-56 px-2.5 py-1.5 rounded-md bg-slate-900 text-white text-[11px] leading-snug shadow-md"
                  >
                    Quick log food: click to pick from Recipe/Food APIs or enter a custom meal.
                  </div>
                )}

                {openQuickMenu === 'food' && (
                  <div
                    role="menu"
                    aria-label="Food quick actions"
                    className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5"
                  >
                    <p className="px-3 py-1 text-[11px] font-semibold text-slate-500">
                      Quick Log Food / Meal
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavClick('meals')}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Browse Recipes (TheMealDB API)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleNavClick('food')}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <PackageSearch className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Lookup Packaged Food (Open Food Facts)</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenQuickMenu(null);
                        onOpenCustomModal('meal');
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                      <span>Log Custom Meal / Food</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Zone 3: Undo & Help Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              disabled={!latestUndo}
              title={latestUndo ? `Undo: ${latestUndo.description}` : 'Nothing to undo'}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            <button
              type="button"
              onClick={onOpenHelpModal}
              aria-label="Help, user guide, and API status"
              title="Help & API Connection Status"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Locked Target Progress Hairline Bar */}
        <div className="h-1 w-full bg-slate-100" aria-hidden="true">
          <div
            className={`h-full transition-all duration-200 ${
              isOverTarget ? 'bg-rose-600' : 'bg-emerald-600'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Row 2: Locked Page Navigation Bar below Daily Target (no numbering, clean tabs) */}
        <div className="bg-slate-50/95 border-t border-slate-200/80">
          <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-10 flex items-center justify-between gap-4">
            <nav
              aria-label="Page navigation"
              className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1"
            >
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Slide-out Hamburger Navigation Drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative z-10 w-80 max-w-[85vw] bg-white h-full border-r border-slate-200 flex flex-col justify-between p-5 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  nutri-me Menu
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* At-a-glance status inside menu too */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Daily Calorie Target</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {targets.intakeTargetKcal.toLocaleString()} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Consumed Today</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    +{balance.consumedKcal.toLocaleString()} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Burned via Exercise</span>
                  <span className="font-mono font-semibold text-amber-700 tabular-nums">
                    -{balance.burnedKcal.toLocaleString()} kcal
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">
                    {isOverTarget ? 'Over Target By' : 'Remaining Budget'}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      isOverTarget ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {Math.abs(balance.remainingKcal).toLocaleString()} kcal
                  </span>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                <p className="px-2 pb-1 text-xs font-semibold text-slate-500">Pages</p>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Actions */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <p className="px-2 pb-1 text-xs font-semibold text-slate-500">Quick Actions</p>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenGoalModal();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  <span>Edit Calorie &amp; Burn Targets</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenCustomModal('exercise');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Log Custom Exercise</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenCustomModal('meal');
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Log Custom Food or Meal</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onOpenHelpModal();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>Help Guide &amp; API Diagnostics</span>
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
