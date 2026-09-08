import { useMemo } from 'react';
import clsx from 'clsx';
import { Download } from 'lucide-react';
import { Card, EmptyState } from '@/components/common/Card';
import { AlertRail } from '@/components/dashboard/AlertRail';
import { ClassBreakdown } from '@/components/dashboard/ClassBreakdown';
import { DensityChart } from '@/components/dashboard/DensityChart';
import { ForecastPanel } from '@/components/dashboard/ForecastPanel';
import { KpiStrip } from '@/components/dashboard/KpiStrip';
import { LiveTile } from '@/components/dashboard/LiveTile';
import { ThresholdBar } from '@/components/dashboard/ThresholdBar';
import { binLabel, downloadText, toCsv } from '@/lib/utils';
import { RANGE_MS, useUiStore } from '@/store/uiStore';
import { useLiveStore } from '@/store/liveStore';

const RANGES = ['15m', '1h', '6h', '24h'] as const;

/**
 * Live monitoring — the page that carries the demo.
 *
 * Reading order is deliberate: state and magnitude first (KPIs), then the evidence
 * (annotated frame), then the trend + forecast (chart), then the supporting detail
 * (composition, thresholds, alerts).
 *
 * Layout note: the left column is a camera rail, not a single hard-coded feed. One
 * camera today; add feeds and this becomes a multi-camera wall without touching the
 * centre column.
 */
export function LivePage() {
  const cameras = useLiveStore((s) => s.cameras);
  const runtimes = useLiveStore((s) => s.runtimes);
  const thresholds = useLiveStore((s) => s.thresholds);
  const selectedId = useLiveStore((s) => s.selectedCameraId);
  const selectCamera = useLiveStore((s) => s.selectCamera);
  const { range, setRange, showForecast, showBands } = useUiStore();

  const camera = cameras.find((c) => c.id === selectedId);
  const rt = runtimes[selectedId];
  const th = thresholds[selectedId];

  const rangeMs = RANGE_MS[range];
  const chartPoints = useMemo(() => rt?.points ?? [], [rt?.points]);
  const nextValue = rt?.forecast?.points[0]?.value ?? null;

  if (!camera || !rt) {
    return (
      <div className="p-6">
        <EmptyState title="No camera stream yet" hint="Start the FastAPI backend or the mock stream server; the dashboard picks the first feed automatically." />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
      {/* ── Camera rail ─────────────────────────────────────────────── */}
      <aside className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="card-title">Feeds</h2>
          <span className="font-mono text-[10px] text-faint">{cameras.length}</span>
        </div>
        <ul className="flex flex-col gap-2">
          {cameras.map((c) => {
            const r = runtimes[c.id];
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  onClick={() => selectCamera(c.id)}
                  aria-current={active}
                  className={clsx(
                    'w-full rounded-card border p-3 text-left transition-colors',
                    active ? 'border-primary/60 bg-primary/8' : 'border-line bg-surface hover:border-primary/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx('h-2 w-2 shrink-0 rounded-full', r?.online ? 'bg-low' : 'bg-critical')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                  </div>
                  <div className="mt-1.5 flex items-baseline justify-between font-mono">
                    <span className="text-lg font-semibold leading-none">{r?.latestTotal ?? 0}</span>
                    <span
                      className={clsx('text-[10px] font-semibold uppercase', {
                        'text-low': r?.state === 'low',
                        'text-medium': r?.state === 'medium',
                        'text-high': r?.state === 'high',
                        'text-critical': r?.state === 'critical',
                      })}
                    >
                      {r?.state ?? '—'}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-col gap-4">
        <KpiStrip
          total={rt.latestTotal}
          state={rt.state}
          points={chartPoints}
          forecastValue={nextValue}
          fps={rt.fps}
          latencyMs={rt.latencyMs}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <LiveTile camera={camera} runtime={rt} />

          <Card title="Composition" bodyClassName="p-4">
            <ClassBreakdown byClass={rt.byClass} />
          </Card>
        </div>

        <Card
          title={`Density & 15-minute forecast · ${binLabel(60)}`}
          bodyClassName="p-2"
          action={
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-line bg-bg p-0.5" role="group" aria-label="Time range">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    aria-pressed={range === r}
                    className={clsx(
                      'rounded-md px-2 py-1 font-mono text-[11px] transition-colors',
                      range === r ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                className="btn px-2 py-1 text-[11px]"
                onClick={() =>
                  downloadText(
                    `counts-${camera.id}-${Date.now()}.csv`,
                    toCsv(
                      chartPoints.map((p) => ({
                        ts_iso: new Date(p.ts).toISOString(),
                        total: p.total,
                        person: p.byClass.person,
                        car: p.byClass.car,
                        bus: p.byClass.bus,
                        truck: p.byClass.truck,
                        motorcycle: p.byClass.motorcycle,
                        state: p.state,
                      })),
                    ),
                  )
                }
              >
                <Download size={13} /> CSV
              </button>
            </div>
          }
        >
          {chartPoints.length < 2 ? (
            <EmptyState title="Waiting for the first interval bins" hint="Counts aggregate every 60 s, so the series appears within a minute of the pipeline starting." />
          ) : (
            <DensityChart
              points={chartPoints}
              forecast={rt.forecast}
              thresholds={th}
              rangeMs={rangeMs}
              showForecast={showForecast}
              showBands={showBands}
            />
          )}
        </Card>
      </section>

      {/* ── Right rail ──────────────────────────────────────────────── */}
      <aside className="flex min-w-0 flex-col gap-4">
        <Card title="Forecast">
          <ForecastPanel forecast={rt.forecast} />
        </Card>

        <Card title="Density thresholds">
          <ThresholdBar value={rt.latestTotal} thresholds={th} />
        </Card>

        <Card className="min-h-[280px] flex-1" bodyClassName="p-0">
          <AlertRail />
        </Card>
      </aside>
    </div>
  );
}
