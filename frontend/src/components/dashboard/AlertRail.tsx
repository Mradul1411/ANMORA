import { CheckCheck, Siren } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { relativeTime } from '@/lib/utils';
import { useLiveStore } from '@/store/liveStore';

/**
 * Alert history. Alerts are created by the p90 rule on the server (or simulator) and
 * are acknowledged, never deleted — the record matters for the report.
 */
export function AlertRail({ limit = 6 }: { limit?: number }) {
  const alerts = useLiveStore((s) => s.alerts);
  const cameras = useLiveStore((s) => s.cameras);
  const ackAlert = useLiveStore((s) => s.ackAlert);
  const ackAll = useLiveStore((s) => s.ackAll);

  const visible = alerts.slice(0, limit);
  const open = alerts.filter((a) => !a.acked).length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="card-title flex items-center gap-2">
          <Siren size={13} className="text-critical" aria-hidden />
          Alerts
          {open > 0 && (
            <span className="rounded-pill bg-critical/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-critical">{open}</span>
          )}
        </h2>
        {alerts.length > 0 && (
          <button className="btn px-2 py-1 text-[11px]" onClick={ackAll}>
            <CheckCheck size={13} /> Ack all
          </button>
        )}
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-xs text-faint">
            No alerts. Threshold is p90 of the rolling 14-day window.
          </li>
        )}
        {visible.map((a) => {
          const cam = cameras.find((c) => c.id === a.cameraId);
          return (
            <li key={a.id} className={`px-4 py-3 ${a.acked ? 'opacity-55' : ''}`}>
              <div className="flex items-start gap-2">
                <StatusBadge state={a.state} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{cam?.name ?? a.cameraId}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{a.message}</p>
                  <p className="mt-1 font-mono text-[10px] text-faint">{relativeTime(a.ts)}</p>
                </div>
                {!a.acked && (
                  <button className="btn px-2 py-1 text-[11px]" onClick={() => ackAlert(a.id)}>
                    Ack
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
