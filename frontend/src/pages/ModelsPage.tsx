import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { fmtPct } from '@/lib/utils';
import { api } from '@/api/client';
import type { ModelId, ModelsResponse } from '@/types/domain';
import { useUiStore } from '@/store/uiStore';

const FAMILY_LABEL: Record<string, string> = {
  baseline: 'Baseline',
  statistical: 'Statistical',
  'additive-ml': 'Additive ML',
  deep: 'Deep learning',
};

/**
 * Model evaluation — the evidence page.
 *
 * mAP@0.5 / precision / recall for detection, HOTA + ID switches for tracking, and
 * MAE / RMSE / MAPE for forecasting, all on one screen. These are the numbers the
 * viva defence rests on, so they get first-class UI rather than a notebook screenshot.
 */
export function ModelsPage() {
  const [data, setData] = useState<ModelsResponse | null>(null);
  const model = useUiStore((s) => s.model);
  const setModel = useUiStore((s) => s.setModel);

  useEffect(() => {
    let cancelled = false;
    api.models().then((d) => !cancelled && setData(d));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return <div className="p-6 text-sm text-muted">Loading evaluation metrics…</div>;

  const best = data.metrics.reduce((a, b) => (b.mae < a.mae ? b : a), data.metrics[0]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
      <header>
        <h1 className="text-lg font-semibold">Model evaluation</h1>
        <p className="text-xs text-muted">Detection, tracking and forecasting measured on the same held-out window.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="mAP@0.5" value={fmtPct(data.detection.mAP50)} sub="YOLOv8s @ IoU 0.5" />
        <Stat label="Precision / Recall" value={`${fmtPct(data.detection.precision, 0)} / ${fmtPct(data.detection.recall, 0)}`} sub="target classes" />
        <Stat label="HOTA" value={data.tracking.hota.toFixed(2)} sub={`ID switches ${data.tracking.idSwitchesPerMin.toFixed(1)}/min`} />
        <Stat label="Throughput" value={`${data.detection.fps.toFixed(1)} fps`} sub="detect + track, 1080p" />
      </div>

      <Card
        title="Forecasting comparison"
        action={
          <span className="flex items-center gap-1.5 text-[11px] text-low">
            <CheckCircle2 size={13} /> best MAE: {best.label}
          </span>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-2.5 font-medium">Model</th>
                <th className="px-4 py-2.5 font-medium">Class</th>
                <th className="px-4 py-2.5 text-right font-medium">MAE</th>
                <th className="px-4 py-2.5 text-right font-medium">RMSE</th>
                <th className="px-4 py-2.5 text-right font-medium">MAPE</th>
                <th className="px-4 py-2.5 text-right font-medium">Infer</th>
                <th className="px-4 py-2.5 font-medium">Notes</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.metrics.map((m) => {
                const isBest = m.id === best.id;
                const selected = m.id === model;
                return (
                  <tr key={m.id} className={clsx('border-b border-line/60 last:border-0', selected && 'bg-primary/6')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.label}</span>
                        {isBest && (
                          <span className="rounded-pill bg-low/15 px-1.5 py-0.5 text-[10px] font-semibold text-low">best</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{FAMILY_LABEL[m.family] ?? m.family}</td>
                    <NumCell v={m.mae.toFixed(2)} best={isBest} />
                    <NumCell v={m.rmse.toFixed(2)} />
                    <NumCell v={`${m.mape.toFixed(1)}%`} />
                    <NumCell v={`${m.inferMs} ms`} />
                    <td className="max-w-[280px] px-4 py-3 text-xs leading-snug text-muted">{m.note}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className={clsx('btn px-2 py-1 text-[11px]', selected && 'btn-primary')}
                        onClick={() => setModel(m.id as ModelId)}
                        aria-pressed={selected}
                      >
                        {selected ? 'In use' : 'Use on Live'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card title="MAE — mean absolute error">
          <Bars items={data.metrics.map((m) => ({ label: m.label.split(' ')[0], v: m.mae }))} unit="objs" />
        </Card>
        <Card title="RMSE — penalises big misses">
          <Bars items={data.metrics.map((m) => ({ label: m.label.split(' ')[0], v: m.rmse }))} unit="objs" />
        </Card>
        <Card title="MAPE — relative error">
          <Bars items={data.metrics.map((m) => ({ label: m.label.split(' ')[0], v: m.mape }))} unit="%" />
        </Card>
      </div>

      <p className="rounded-card border border-line bg-surface p-4 text-[11px] leading-relaxed text-muted">
        <b className="text-ink">Reading these numbers:</b> MAE and RMSE are in objects per bin, so they are
        directly comparable to the density thresholds. MAPE is percentage error against the observed value
        and is unreliable when the true count is near zero — low-traffic night bins inflate it, which is why
        MAE is the headline metric here.
      </p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="metric-value mt-2">{value}</div>
      <div className="mt-1 text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function NumCell({ v, best }: { v: string; best?: boolean }) {
  return (
    <td className={clsx('px-4 py-3 text-right font-mono', best ? 'font-semibold text-low' : 'text-ink')}>{v}</td>
  );
}

function Bars({ items, unit }: { items: { label: string; v: number }[]; unit: string }) {
  const max = Math.max(...items.map((i) => i.v), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} className="text-xs">
          <div className="flex justify-between">
            <span className="text-muted">{i.label}</span>
            <span className="font-mono text-ink">
              {i.v.toFixed(2)} {unit}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-bg">
            <span className="block h-full rounded-pill bg-forecast/70" style={{ width: `${(i.v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
