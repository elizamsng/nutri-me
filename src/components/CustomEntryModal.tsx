import { useState } from 'react';
import { Dumbbell, Utensils, X } from 'lucide-react';
import type { LogEntry } from '../types';

interface CustomEntryModalProps {
  initialTab: 'exercise' | 'meal';
  initialTitle?: string;
  onAddLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  onClose: () => void;
}

export function CustomEntryModal({
  initialTab,
  initialTitle = '',
  onAddLog,
  onClose,
}: CustomEntryModalProps) {
  const [tab, setTab] = useState<'exercise' | 'meal'>(initialTab);
  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialTab === 'exercise' ? 'Cardio' : 'Balanced Meal');
  const [amount, setAmount] = useState(initialTab === 'exercise' ? '30' : '1');
  const [unit, setUnit] = useState(initialTab === 'exercise' ? 'min' : 'serving');
  const [calories, setCalories] = useState(initialTab === 'exercise' ? '220' : '450');
  const [proteinG, setProteinG] = useState('');
  const [error, setError] = useState('');

  const handleSwitchTab = (next: 'exercise' | 'meal') => {
    setTab(next);
    setError('');
    if (next === 'exercise') {
      setCategory('Cardio');
      setAmount('30');
      setUnit('min');
      setCalories('220');
    } else {
      setCategory('Balanced Meal');
      setAmount('1');
      setUnit('serving');
      setCalories('450');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const numAmount = Number(amount);
    const numCalories = Number(calories);
    const numProtein = proteinG.trim() ? Number(proteinG) : undefined;

    if (!trimmedTitle) {
      setError('Please enter a descriptive name.');
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0 || numAmount > 5000) {
      setError('Amount/duration must be a positive number.');
      return;
    }
    if (!Number.isFinite(numCalories) || numCalories <= 0 || numCalories > 5000) {
      setError('Calories must be a valid number between 1 and 5,000 kcal.');
      return;
    }
    if (numProtein !== undefined && (!Number.isFinite(numProtein) || numProtein < 0 || numProtein > 500)) {
      setError('Protein must be between 0 and 500 grams.');
      return;
    }

    onAddLog({
      type: tab,
      source: 'custom',
      title: trimmedTitle,
      category: category.trim() || (tab === 'exercise' ? 'Custom Exercise' : 'Custom Food'),
      calories: Math.round(numCalories),
      amount: Number(numAmount.toFixed(1)),
      unit: unit.trim() || (tab === 'exercise' ? 'min' : 'serving'),
      proteinG: numProtein !== undefined ? Math.round(numProtein) : undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-entry-title"
    >
      <div className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="custom-entry-title" className="text-lg font-semibold text-slate-900">
            Log Custom Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close custom entry dialog"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Segmented Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleSwitchTab('exercise')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                tab === 'exercise'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Custom Exercise</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab('meal')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                tab === 'meal'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Custom Meal / Food</span>
            </button>
          </div>

          <div>
            <label htmlFor="custom-title" className="block text-sm font-medium text-slate-700 mb-1">
              {tab === 'exercise' ? 'Exercise Name' : 'Food or Meal Name'}
            </label>
            <input
              id="custom-title"
              type="text"
              placeholder={tab === 'exercise' ? 'e.g. Brisk Outdoor Cycling' : 'e.g. Homemade Turkey Wrap'}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="custom-category" className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <input
                id="custom-category"
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={tab === 'exercise' ? 'Cardio / Strength' : 'Lunch / Snack'}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="custom-calories" className="block text-sm font-medium text-slate-700 mb-1">
                {tab === 'exercise' ? 'Calories Burned (kcal)' : 'Calories (kcal)'}
              </label>
              <input
                id="custom-calories"
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                value={calories}
                onChange={(e) => {
                  setCalories(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="custom-amount" className="block text-sm font-medium text-slate-700 mb-1">
                {tab === 'exercise' ? 'Duration' : 'Amount'}
              </label>
              <input
                id="custom-amount"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0.5}
                max={5000}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label htmlFor="custom-unit" className="block text-sm font-medium text-slate-700 mb-1">
                Unit
              </label>
              <select
                id="custom-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:border-emerald-600"
              >
                {tab === 'exercise' ? (
                  <>
                    <option value="min">min</option>
                    <option value="sets">sets</option>
                    <option value="km">km</option>
                  </>
                ) : (
                  <>
                    <option value="serving">serving</option>
                    <option value="g">grams (g)</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                  </>
                )}
              </select>
            </div>

            {tab === 'meal' && (
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="custom-protein" className="block text-sm font-medium text-slate-700 mb-1">
                  Protein (g, opt.)
                </label>
                <input
                  id="custom-protein"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={500}
                  placeholder="e.g. 24"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-sm text-slate-900 tabular-nums focus:outline-none focus:border-emerald-600"
                />
              </div>
            )}
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
              Add to Daily Log
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
