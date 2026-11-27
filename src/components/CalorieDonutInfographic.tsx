import type { DailyTargets, LogEntry } from '../types';
import { computeDailyBalance } from '../utils/nutrition';

interface CalorieDonutInfographicProps {
  logs: LogEntry[];
  targets: DailyTargets;
}

export function CalorieDonutInfographic({ logs, targets }: CalorieDonutInfographicProps) {
  const balance = computeDailyBalance(logs, targets);

  const totalBudget = Math.max(1, targets.intakeTargetKcal + balance.burnedKcal);
  const consumedRatio = Math.min(1, balance.consumedKcal / totalBudget);
  const burnedShareRatio = Math.min(
    1 - consumedRatio,
    balance.burnedKcal / totalBudget
  );
  const remainingRatio = Math.max(0, 1 - consumedRatio - burnedShareRatio);
  const isOver = balance.remainingKcal < 0;

  const pctUsed = Math.round((balance.netKcal / Math.max(1, targets.intakeTargetKcal)) * 100);

  // SVG Donut Geometry
  const size = 196;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const consumedArc = consumedRatio * circumference;
  const burnedArc = burnedShareRatio * circumference;
  const remainingArc = remainingRatio * circumference;

  const mealLogs = logs.filter((l) => l.type === 'meal');
  const totalProtein = mealLogs.reduce((sum, m) => sum + (m.proteinG || 0), 0);
  const totalCarbs = mealLogs.reduce((sum, m) => sum + (m.carbsG || 0), 0);
  const totalFat = mealLogs.reduce((sum, m) => sum + (m.fatG || 0), 0);
  const macroTotal = Math.max(1, totalProtein + totalCarbs + totalFat);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut Ring */}
      <div className="relative w-[196px] h-[196px] shrink-0 flex items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="img"
          aria-label={`Target calorie donut chart: ${Math.abs(balance.remainingKcal)} kcal ${
            isOver ? 'over target' : 'remaining'
          }`}
        >
          {/* Base Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
          />

          {/* Remaining Capacity (subtle light track already covers, explicit segment for visual clarity) */}
          {remainingArc > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth={strokeWidth}
              strokeDasharray={`${remainingArc} ${circumference}`}
              strokeDashoffset={-(consumedArc + burnedArc)}
            />
          )}

          {/* Exercise Burned Offset Segment (Amber) */}
          {burnedArc > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#D97706"
              strokeWidth={strokeWidth}
              strokeDasharray={`${burnedArc} ${circumference}`}
              strokeDashoffset={-consumedArc}
              strokeLinecap="butt"
              className="transition-all duration-300"
            />
          )}

          {/* Food Consumed Segment (Emerald or Crimson if over target) */}
          {consumedArc > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={isOver ? '#DC2626' : '#059669'}
              strokeWidth={strokeWidth}
              strokeDasharray={`${consumedArc} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="butt"
              className="transition-all duration-300"
            />
          )}
        </svg>

        {/* Donut Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-5">
          <span className="text-[11px] font-medium text-slate-500">
            {isOver ? 'Over Target' : 'Remaining'}
          </span>
          <span
            className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
              isOver ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {Math.abs(balance.remainingKcal).toLocaleString()}
          </span>
          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
            kcal · {Math.max(0, pctUsed)}% net
          </span>
        </div>
      </div>

      {/* Donut Legend & Macro Breakdown */}
      <div className="flex-1 w-full space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900">
            Daily Target Calorie Breakdown
          </h2>
          <p className="text-xs text-slate-600 font-mono tabular-nums">
            Effective Budget: {targets.intakeTargetKcal.toLocaleString()} target +{' '}
            {balance.burnedKcal.toLocaleString()} burned ={' '}
            {balance.effectiveBudgetKcal.toLocaleString()} kcal
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <span
              className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                isOver ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <span className="block text-[11px] text-slate-500">Food Intake</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {balance.consumedKcal.toLocaleString()} kcal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-600 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-[11px] text-slate-500">Exercise Burn</span>
              <span className="font-mono font-semibold text-amber-800 tabular-nums">
                {balance.burnedKcal.toLocaleString()} kcal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-[11px] text-slate-500">
                {isOver ? 'Excess' : 'Left to Eat'}
              </span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {Math.abs(balance.remainingKcal).toLocaleString()} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Logged Macros Proportion Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono tabular-nums">
            <span>Protein {totalProtein}g</span>
            <span>Carbs {totalCarbs}g</span>
            <span>Fat {totalFat}g</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden flex">
            {totalProtein + totalCarbs + totalFat > 0 ? (
              <>
                <div
                  className="bg-emerald-600 h-full"
                  style={{ width: `${Math.round((totalProtein / macroTotal) * 100)}%` }}
                  title={`Protein: ${totalProtein}g`}
                />
                <div
                  className="bg-sky-600 h-full"
                  style={{ width: `${Math.round((totalCarbs / macroTotal) * 100)}%` }}
                  title={`Carbs: ${totalCarbs}g`}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${Math.round((totalFat / macroTotal) * 100)}%` }}
                  title={`Fat: ${totalFat}g`}
                />
              </>
            ) : (
              <div className="bg-slate-300 h-full w-full" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
