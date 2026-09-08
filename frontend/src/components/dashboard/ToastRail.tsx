import { useEffect, useState } from 'react';
import { Siren, X } from 'lucide-react';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

/**
 * Critical alerts surface as toasts so they're seen even when the user is on another page.
 * The container is aria-live="assertive" — a screen reader user gets the same urgency.
 * Toasts auto-dismiss after 9s; the alert itself stays in the rail until acknowledged.
 */
export function ToastRail() {
  const alerts = useLiveStore((s) => s.alerts);
  const cameras = useLiveStore((s) => s.cameras);
  const ackAlert = useLiveStore((s) => s.ackAlert);
  const toastsEnabled = useUiStore((s) => s.toastsEnabled);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!alerts.length) return;
    const ids = alerts.filter((a) => a.severity === 'critical').map((a) => a.id);
    const t = window.setTimeout(() => setDismissed((d) => new Set([...d, ...ids])), 9000);
    return () => window.clearTimeout(t);
  }, [alerts]);

  const visible = toastsEnabled
    ? alerts.filter((a) => a.severity === 'critical' && !a.acked && !dismissed.has(a.id)).slice(0, 3)
    : [];

  return (
    <div aria-live="assertive" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[330px] flex-col gap-2">
      {visible.map((a) => (
        <div
          key={a.id}
          role="alert"
          className="card animate-slide-in pointer-events-auto border-critical/50 bg-elevated p-3"
        >
          <div className="flex items-start gap-2">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-critical/15 text-critical">
              <Siren size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-critical">
                Critical density — {cameras.find((c) => c.id === a.cameraId)?.name ?? a.cameraId}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted">{a.message}</p>
            </div>
            <button
              aria-label="Dismiss alert"
              className="rounded p-1 text-faint hover:text-ink"
              onClick={() => {
                setDismissed((d) => new Set([...d, a.id]));
                ackAlert(a.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
