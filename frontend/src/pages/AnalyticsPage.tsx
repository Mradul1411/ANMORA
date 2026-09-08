import { useEffect, useMemo } from 'react';
import { Card, EmptyState } from '@/components/common/Card';
import { DensityChart } from '@/components/dashboard/DensityChart';
import { RANGE_MS, useUiStore } from '@/store/uiStore';
import { useLiveStore } from '@/store/liveStore';
import { STATE_META, fmtInt, stateColor } from '@/lib/utils';
import type { DensityState } from '@/types/domain';

/**
 * Analytics — the "prove it with data" page.
 * Peak-hour profile, state distribution and a longer-window trend are the three views
 * that support the EDA notebook's claims without leaving the dashboard.
 */
export function AnalyticsPage() {
  const selectedId = useLiveStore((s) => s.selectedCameraId);
  const rt = useLiveStore((s) => s.runtimes[selectedId]);
  const th = useLiveStore((s) => s.thresholds[selectedId]);
  const setRange = useUiStore((s) => s.setRange);

  const points = rt?.points ?? [];

  const byHour = useMemo(() => {
    const buckets: { hour: number; sum: number; n: number }[] = Array.from({ length: 24 }, (_, h) => ({ hour: h, sum: 0, n: 0 }));
    points.forEach((p) => {
      const h = new Date(p.ts).getHours();
      buckets[h].sum += p.total;
      buckets[h].n += 1;
    });
    return buckets.map((b) => ({ hour: b.hour, avg: b.n ? b.sum / b.n : 0, n: b.n }));
  }, [points]);

  const stateShare = useMemo(() => {
    const counts: Record<DensityState, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    points.forEach((p) => (counts[p.state] += 1));
    const total = points.length || 1;
    return (Object.keys(counts) as DensityState[]).map((s) => ({ state: s, n: counts[s], pct: (counts[s] / total) * 100 }));
  }, [points]);

  if (!points.length) {
    return (
      <div className="p-6">
        <EmptyState title="No aggregated history yet" hint="Analytics needs at least one interval bin per camera; it fills in as the pipeline runs." />
      </div>
    );
  }

  // Analytics is always the long view; done in an effect so the store is never
  // written during render.
  useEffect(() => {
    setRange('24h');
  }, [setRange]);

  const peakHour = byHour.reduce((a, b) => (b.avg > a.avg ? b : a), byHour[0]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
      <header>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-xs text-muted">
          {fmtInt(points.length)} one-minute bins in memory · percentile window {th ? `${fmtInt(th.computedFromPoints)} bins / ${th.windowDays} d` : '—'}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Observed trend (24h)" bodyClassName="p-2">
          <DensityChart points={points} forecast={null} thresholds={th} rangeMs={RANGE_MS['24h']} showForecast={false} showBands={false} height={280} />
        </Card>

        <Card title="Time in each density state">
          <ul className="space-y-3">
            {stateShare.map((s) => (
              <li key={s.state}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: stateColor(s.state) }}>
                    {STATE_META[s.state].label}
                  </span>
                  <span className="font-mono text-muted">
                    {fmtInt(s.n)} bins · {s.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-bg">
                  <span className="block h-full rounded-pill" style={{ width: `${s.pct}%`, background: stateColor(s.state) }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-snug text-faint">
            {STATE_META.critical.blurb}. Sustained time in Critical is the operational signal this
            system exists to surface.
          </p>
        </Card>
      </div>

      <Card
        title="Peak-hour profile"
        action={<span className="font-mono text-[11px] text-muted">peak {String(peakHour.hour).padStart(2, '0')}:00 · avg {peakHour.avg.toFixed(1)} objs</span>}
      >
        <HourBars data={byHour} />
      </Card>
    </div>
  );
}

function HourBars({ data }: { data: { hour: number; avg: number; n: number }[] }) {
  const max = Math.max(...data.map((d) => d.avg), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {data.map((d) => (
        <div key={d.hour} className="group relative flex flex-1 flex-col items-center justify-end gap-1">
          <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-ink group-hover:block">
            {String(d.hour).padStart(2, '0')}:00 · {d.avg.toFixed(1)}
          </span>
          <span
            className="w-full rounded-t transition-all group-hover:opacity-100"
            style={{
              height: `${Math.max(2, (d.avg / max) * 100)}%`,
              background: 'rgb(var(--primary) / 0.55)',
            }}
          />
          <span className="font-mono text-[9px] text-faint">{d.hour % 3 === 0 ? d.hour : ''}</span>
        </div>
      ))}
    </div>
  );
}
