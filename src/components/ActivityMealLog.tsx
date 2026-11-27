import { useMemo, useState } from 'react';
import {
  ClipboardList,
  Dumbbell,
  Plus,
  Trash2,
  Undo2,
  Utensils,
} from 'lucide-react';
import type { DailyTargets, LogEntry, UndoAction } from '../types';
import { computeDailyBalance, formatTime } from '../utils/nutrition';

interface ActivityMealLogProps {
  logs: LogEntry[];
  targets: DailyTargets;
  undoStack: UndoAction[];
  onDeleteLog: (id: string) => void;
  onUndo: () => void;
  onOpenCustomModal: (initialTab: 'exercise' | 'meal') => void;
}

export function ActivityMealLog({
  logs,
  targets,
  undoStack,
  onDeleteLog,
  onUndo,
  onOpenCustomModal,
}: ActivityMealLogProps) {
  const [filter, setFilter] = useState<'all' | 'meal' | 'exercise'>('all');

  const balance = computeDailyBalance(logs, targets);
  const latestUndo = undoStack[0];

  const visibleLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((entry) => entry.type === filter);
  }, [logs, filter]);

  const sourceLabel = (source: LogEntry['source']) => {
    switch (source) {
      case 'wger':
        return 'Wger';
      case 'mealdb':
        return 'TheMealDB';
      case 'openfoodfacts':
        return 'Open Food Facts';
      default:
        return 'Custom';
    }
  };

  return (
    <section
      id="section-log"
      className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5 scroll-mt-28"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <ClipboardList className="w-4 h-4" />
            <span>Today&apos;s Intake &amp; Activity Ledger</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Activity &amp; Meal Log
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-mono tabular-nums">
            Intake +{balance.consumedKcal.toLocaleString()} kcal · Burned -
            {balance.burnedKcal.toLocaleString()} kcal · Net {balance.netKcal.toLocaleString()} kcal
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
            {[
              { id: 'all' as const, label: `All (${logs.length})` },
              {
                id: 'meal' as const,
                label: `Meals (${logs.filter((l) => l.type === 'meal').length})`,
              },
              {
                id: 'exercise' as const,
                label: `Exercises (${logs.filter((l) => l.type === 'exercise').length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onUndo}
            disabled={!latestUndo}
            title={latestUndo ? `Undo: ${latestUndo.description}` : 'Nothing to undo'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo Last</span>
          </button>
        </div>
      </div>

      {visibleLogs.length === 0 ? (
        <div className="p-8 rounded-lg border border-slate-200 bg-slate-50 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            {filter === 'all'
              ? 'No meals or exercises logged yet today'
              : `No ${filter === 'meal' ? 'meals' : 'exercises'} logged yet`}
          </p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Log an exercise or recipe above, or add a custom entry directly.
          </p>
          <div className="flex items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => onOpenCustomModal('exercise')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Custom Exercise</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCustomModal('meal')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Custom Meal</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Activity / Food</th>
                <th className="py-2.5 px-4">Category &amp; Source</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Calories</th>
                <th className="py-2.5 px-4 text-right">Time</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {visibleLogs.map((entry) => {
                const isExercise = entry.type === 'exercise';
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {isExercise ? (
                          <Dumbbell className="w-4 h-4 text-amber-700 shrink-0" />
                        ) : (
                          <Utensils className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                        <span className="font-medium text-slate-900">{entry.title}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {entry.category} · {sourceLabel(entry.source)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {entry.amount} {entry.unit}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                        isExercise ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {isExercise ? `-${entry.calories}` : `+${entry.calories}`} kcal
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                      {formatTime(entry.timestamp)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteLog(entry.id)}
                        aria-label={`Remove ${entry.title}`}
                        title="Remove entry (can be undone)"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
