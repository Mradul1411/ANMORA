import { clsx } from 'clsx';
import { LineChart } from 'lucide-react';
import { fmtInt, relativeTime } from '@/lib/utils';
import type { Forecast, ModelId } from '@/types/domain';
import { useUiStore } from '@/store/uiStore';

const MODELS: { id: ModelId; label: string; short: string }[] = [
  { id: 'ma', label: 'Moving Average', short: 'MA' },
  { id: 'sarima', label: 'SARIMA', short: 'SARIMA' },
  { id: 'prophet', label: 'Prophet', short: 'Prophet' },
  { id: 'lstm', label: 'LSTM', short: 'LSTM' },
];

/**
 * Forecast controls + summary. The model selector is here (not buried in settings)
 * because comparing candidates is a core deliverable — the switch must be one click
 * away while the chart is on screen.
 */
export function ForecastPanel({ forecast }: { forecast: Forecast | null }) {
  const { model, setModel, showForecast, showBands, toggle } = useUiStore();

  const last = forecast?.points.at(-1);
  const peak = forecast?.points.reduce((a, p) => Math.max(a, p.value), 0) ?? null;

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Forecast model</span>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-lg border border-line bg-bg p-1" role="group" aria-label="Forecast model">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModel(m.id)}
              aria-pressed={model === m.id}
              title={m.label}
              className={clsx(
                'rounded-md px-1 py-1.5 text-[11px] font-semibold transition-colors',
                model === m.id ? 'bg-forecast/18 text-forecast' : 'text-muted hover:bg-elevated hover:text-ink',
              )}
            >
              {m.short}
            </button>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <Box label="Horizon">
          <dd className="font-mono text-lg font-semibold text-ink">{forecast?.horizonMin ?? 15} min</dd>
        </Box>
        <Box label={`Ends at T+${forecast?.horizonMin ?? 15}`}>
          <dd className="font-mono text-lg font-semibold text-forecast">{last ? fmtInt(last.value) : '—'}</dd>
        </Box>
        <Box label="Forecast peak">
          <dd className="font-mono text-lg font-semibold text-ink">{peak !== null ? fmtInt(peak) : '—'}</dd>
        </Box>
        <Box label="Generated">
          <dd className="font-mono text-xs leading-6 text-muted">
            {forecast ? relativeTime(forecast.generatedAt) : '—'}
          </dd>
        </Box>
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Toggle on={showForecast} onClick={() => toggle('showForecast')} label="Show forecast" />
        <Toggle on={showBands} onClick={() => toggle('showBands')} label="80% band" />
      </div>

      <p className="flex items-start gap-2 text-[11px] leading-snug text-faint">
        <LineChart size={13} className="mt-0.5 shrink-0" aria-hidden />
        Forecast is regenerated every 60 s from the aggregated 1-minute series; the dashed violet
        segment is prediction, never observation.
      </p>
    </div>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-bg p-3">
      <dt className="text-[10px] uppercase tracking-wider text-faint">{label}</dt>
      {children}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        'rounded-pill border px-2.5 py-1 text-[11px] font-medium transition-colors',
        on ? 'border-primary/50 bg-primary/12 text-primary' : 'border-line text-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}
