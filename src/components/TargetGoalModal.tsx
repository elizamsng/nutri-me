import { useState } from 'react';
import { X } from 'lucide-react';
import type { DailyTargets } from '../types';

interface TargetGoalModalProps {
  targets: DailyTargets;
  onSave: (next: DailyTargets) => void;
  onClose: () => void;
}

const PRESETS: {
  id: DailyTargets['goalPreset'];
  label: string;
  subtitle: string;
  intake: number;
  burn: number;
}[] = [
  {
    id: 'fat-loss',
    label: 'Calorie Deficit',
    subtitle: '1,750 kcal intake · 350 kcal burn',
    intake: 1750,
    burn: 350,
  },
  {
    id: 'maintenance',
    label: 'Balanced Maintenance',
    subtitle: '2,100 kcal intake · 300 kcal burn',
    intake: 2100,
    burn: 300,
  },
  {
    id: 'muscle-gain',
    label: 'Active Surplus',
    subtitle: '2,600 kcal intake · 450 kcal burn',
    intake: 2600,
    burn: 450,
  },
];

export function TargetGoalModal({ targets, onSave, onClose }: TargetGoalModalProps) {
  const [intakeInput, setIntakeInput] = useState(String(targets.intakeTargetKcal));
  const [burnInput, setBurnInput] = useState(String(targets.burnTargetKcal));
  const [preset, setPreset] = useState<DailyTargets['goalPreset']>(targets.goalPreset);
  const [error, setError] = useState('');

  const handleApplyPreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.id);
    setIntakeInput(String(p.intake));
    setBurnInput(String(p.burn));
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const intake = Number(intakeInput);
    const burn = Number(burnInput);

    if (!Number.isFinite(intake) || intake < 900 || intake > 6000) {
      setError('Daily calorie intake target must be a number between 900 and 6,000 kcal.');
      return;
    }
    if (!Number.isFinite(burn) || burn < 50 || burn > 3000) {
      setError('Daily exercise burn target must be a number between 50 and 3,000 kcal.');
      return;
    }

    onSave({
      intakeTargetKcal: Math.round(intake),
      burnTargetKcal: Math.round(burn),
      goalPreset: preset,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
    >
      <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="goal-modal-title" className="text-lg font-semibold text-slate-900">
            Daily Calorie &amp; Exercise Targets
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close goal settings"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Quick Goal Presets</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {PRESETS.map((p) => {
                const selected = preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-emerald-600 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{p.label}</span>
                    <span className="block text-[11px] text-slate-500 mt-1">{p.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="intake-target-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Daily Intake Target (kcal)
              </label>
              <input
                id="intake-target-input"
                type="number"
                inputMode="numeric"
                min={900}
                max={6000}
                step={50}
                value={intakeInput}
                onChange={(e) => {
                  setIntakeInput(e.target.value);
                  setPreset('custom');
                  setError('');
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
              />
              <p className="text-xs text-slate-500 mt-1">Allowed range: 900 – 6,000 kcal</p>
            </div>

            <div>
              <label
                htmlFor="burn-target-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Daily Exercise Burn Goal (kcal)
              </label>
              <input
                id="burn-target-input"
                type="number"
                inputMode="numeric"
                min={50}
                max={3000}
                step={25}
                value={burnInput}
                onChange={(e) => {
                  setBurnInput(e.target.value);
                  setPreset('custom');
                  setError('');
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
              />
              <p className="text-xs text-slate-500 mt-1">Allowed range: 50 – 3,000 kcal</p>
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Save Targets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
