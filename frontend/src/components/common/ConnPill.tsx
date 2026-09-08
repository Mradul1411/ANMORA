import clsx from 'clsx';
import type { ConnState } from '@/types/domain';

const MAP: Record<ConnState, { label: string; cls: string; dot: string }> = {
  open: { label: 'Live', cls: 'text-low', dot: 'bg-low' },
  connecting: { label: 'Connecting', cls: 'text-muted', dot: 'bg-muted' },
  reconnecting: { label: 'Reconnecting', cls: 'text-medium', dot: 'bg-medium' },
  closed: { label: 'Disconnected', cls: 'text-critical', dot: 'bg-critical' },
  demo: { label: 'Demo data', cls: 'text-forecast', dot: 'bg-forecast' },
};

/**
 * Stream health is always visible. A dashboard showing frozen numbers with no
 * indication that the socket died is the worst failure mode for a live demo.
 */
export function ConnPill({ state, msgRate, latencyMs }: { state: ConnState; msgRate?: number; latencyMs?: number }) {
  const m = MAP[state];
  return (
    <div
      className="flex items-center gap-2 rounded-pill border border-line bg-surface px-2.5 py-1 text-[11px] font-medium"
      title={msgRate !== undefined ? `${msgRate} msgs/min · ${latencyMs ?? 0} ms pipeline latency` : undefined}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {state === 'open' && <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', m.dot)} />}
        <span className={clsx('relative inline-flex h-2 w-2 rounded-full', m.dot)} />
      </span>
      <span className={m.cls}>{m.label}</span>
      {msgRate !== undefined && state === 'open' && (
        <span className="font-mono text-faint">
          {msgRate}/min · {latencyMs ?? 0}ms
        </span>
      )}
    </div>
  );
}
