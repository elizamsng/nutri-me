import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { checkApiConnections } from '../services/api';
import type { ApiDiagnosticItem } from '../types';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  const [checking, setChecking] = useState(false);
  const [apis, setApis] = useState<ApiDiagnosticItem[] | null>(null);
  const [checkError, setCheckError] = useState('');

  const runApiDiagnostics = async () => {
    setChecking(true);
    setCheckError('');
    try {
      const res = await checkApiConnections();
      setApis(res.apis);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Unable to run API check');
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    runApiDiagnostics();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-xl border border-slate-200 shadow-lg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 id="help-modal-title" className="text-lg font-semibold text-slate-900">
            nutri-me User Guide &amp; API Connections
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help guide"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              1. Understanding Your Locked Top Status Bar
            </h3>
            <p>
              The top bar stays locked as you scroll so you can always see your Daily Target, Food
              Intake, Exercise Burn, Remaining Calorie Budget, and current Page Navigation section.
              Click the status bar at any time to update your calorie intake or exercise burn goals,
              or open the hamburger menu for shortcuts.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              2. Exercise Planner (Powered by Wger)
            </h3>
            <p>
              Choose a muscle or workout focus block (such as Cardio, Legs, Back, or Abs) and filter
              by the equipment you have available. Set your duration in minutes, review plain-English
              step instructions, and log the workout. Exercises already logged today display a
              confirmation indicator so you never double-log by mistake.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              3. Meal Recommendations &amp; Packaged Foods (TheMealDB &amp; Open Food Facts)
            </h3>
            <p>
              nutri-me automatically suggests a target calorie window and meal category based on
              your remaining calorie budget and how many calories you burned exercising. Combine
              multiple categories and ingredient tags (such as Salmon + Rice or Apple + Dessert),
              click any recipe image to view it full size, or switch to Packaged Food Lookup for
              barcodes (for example, <span className="font-mono">3017624010701</span>).
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900">
              4. Undo, Custom Entries &amp; Error Recovery
            </h3>
            <p>
              Made a mistake? Click <strong>Undo</strong> in the top bar or Activity Log to revert
              your last logged meal, workout, deletion, or goal change. If an item is missing from
              the database or an API is temporarily unreachable, use the <strong>Retry</strong>{' '}
              button or log a <strong>Custom Entry</strong> with your own numbers.
            </p>
          </section>

          <section className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Live API Connection Check</h3>
                <p className="text-xs text-slate-500">
                  Verifies live connectivity to TheMealDB, Wger Exercise, and Open Food Facts.
                </p>
              </div>
              <button
                type="button"
                onClick={runApiDiagnostics}
                disabled={checking}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
                <span>{checking ? 'Checking...' : 'Test Connections'}</span>
              </button>
            </div>

            {checkError && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-2.5">
                {checkError}
              </div>
            )}

            {apis && (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg bg-white">
                {apis.map((item) => (
                  <div
                    key={item.service}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.connected ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="font-medium text-slate-900">{item.service}</span>
                    </div>
                    <span
                      className={`font-mono text-right truncate ${
                        item.connected ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {item.connected
                        ? item.sample
                          ? `Connected (${item.sample})`
                          : `Connected (${item.count} items)`
                        : item.error || 'Disconnected'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end shrink-0 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
