import { fmtInt } from '@/lib/utils';
import type { DensityState, Thresholds } from '@/types/domain';

const STOPS: { state: DensityState; varName: string; label: string }[] = [
  { state: 'low', varName: '--low', label: 'Low' },
  { state: 'medium', varName: '--medium', label: 'Medium' },
  { state: 'high', varName: '--high', label: 'High' },
  { state: 'critical', varName: '--critical', label: 'Critical' },
];

/**
 * Where the current count sits relative to the percentile bands that define the states.
 * This is the visual explanation of "Low / Medium / High / Critical" — a marker on the
 * p25 → p90 scale, so the classification is legible instead of arbitrary.
 */
export function ThresholdBar({ value, thresholds }: { value: number; thresholds?: Thresholds }) {
  if (!thresholds) return <p className="text-xs text-faint">Building percentile thresholds from history…</p>;

  const max = Math.max(thresholds.p90 * 1.25, value * 1.1, 10);
  const pct = (v: number) => Math.min(100, (v / max) * 100);
  const marks = [
    { at: thresholds.p25, label: `p25 · ${thresholds.p25}`, color: 'rgb(var(--medium))' },
    { at: thresholds.p75, label: `p75 · ${thresholds.p75}`, color: 'rgb(var(--high))' },
    { at: thresholds.p90, label: `p90 · ${thresholds.p90}`, color: 'rgb(var(--critical))' },
  ];

  return (
    <div className="space-y-4 pt-1">
      <div className="relative h-2.5 w-full overflow-visible rounded-pill bg-bg">
        <div className="flex h-full w-full overflow-hidden rounded-pill">
          {STOPS.map((s, i) => (
            <span
              key={s.state}
              style={{
                background: `rgb(var(${s.varName}) / 0.55)`,
                width: `${i === 0 ? pct(thresholds.p25) : i === 1 ? pct(thresholds.p75) - pct(thresholds.p25) : i === 2 ? pct(thresholds.p90) - pct(thresholds.p75) : 100 - pct(thresholds.p90)}%`,
              }}
            />
          ))}
        </div>
        {/* current value marker */}
        <span
          className="absolute top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow"
          style={{ left: `${pct(value)}%` }}
          aria-hidden
        />
      </div>

      <div className="flex justify-between font-mono text-[10px] text-faint">
        {marks.map((m) => (
          <span key={m.label} style={{ color: m.color }}>
            {m.label}
          </span>
        ))}
        <span>max {fmtInt(Math.round(max))}</span>
      </div>

      <p className="text-[11px] leading-snug text-muted">
        Bands are computed from the rolling {thresholds.windowDays}-day window (
        {fmtInt(thresholds.computedFromPoints)} bins), so each camera is judged against its own
        history rather than a universal threshold.
      </p>
    </div>
  );
}
