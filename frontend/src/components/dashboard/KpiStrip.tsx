import { Sparkline } from '@/components/common/Sparkline';
import { STATE_META, fmtInt, stateColor } from '@/lib/utils';
import type { CountPoint, DensityState } from '@/types/domain';

/**
 * Four numbers that answer "what is happening right now, and is it getting worse?"
 * Everything else on the page is supporting detail.
 */
export function KpiStrip({
  total,
  state,
  points,
  forecastValue,
  fps,
  latencyMs,
}: {
  total: number;
  state: DensityState;
  points: CountPoint[];
  forecastValue: number | null;
  fps: number;
  latencyMs: number;
}) {
  const spark = points.slice(-40).map((p) => p.total);
  const peak = spark.length ? Math.max(...spark) : 0;
  const delta = forecastValue === null ? null : forecastValue - total;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Objects in ROI now" accent={stateColor(state)}>
        <div className="flex items-end justify-between gap-2">
          <span className="metric-value" style={{ color: stateColor(state) }}>
            {fmtInt(total)}
          </span>
          <span className="text-[11px] font-medium" style={{ color: stateColor(state) }}>
            {STATE_META[state].label}
          </span>
        </div>
        <Sparkline values={spark.length ? spark : [0, 0]} color={stateColor(state)} />
      </Tile>

      <Tile label="15-min forecast">
        <div className="flex items-end justify-between gap-2">
          <span className="metric-value text-forecast">{forecastValue === null ? '—' : fmtInt(forecastValue)}</span>
          {delta !== null && (
            <span className={`text-[11px] font-medium ${delta >= 0 ? 'text-critical' : 'text-low'}`}>
              {delta >= 0 ? '▲' : '▼'} {fmtInt(Math.abs(delta))}
            </span>
          )}
        </div>
        <p className="text-[11px] text-faint">next interval, {delta !== null && delta > 0 ? 'worsening' : 'easing'}</p>
      </Tile>

      <Tile label="Window peak">
        <div className="flex items-end justify-between gap-2">
          <span className="metric-value">{fmtInt(peak)}</span>
          <span className="font-mono text-[11px] text-faint">objs/min</span>
        </div>
        <p className="text-[11px] text-faint">rolling 40 bins</p>
      </Tile>

      <Tile label="Pipeline health">
        <div className="flex items-baseline gap-2">
          <span className="metric-value">{fps.toFixed(1)}</span>
          <span className="font-mono text-xs text-faint">fps</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-faint">
          latency {Math.round(latencyMs)} ms · target 1–3 fps
        </p>
      </Tile>
    </div>
  );
}

function Tile({ label, children, accent }: { label: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      {accent && <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} />}
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}
