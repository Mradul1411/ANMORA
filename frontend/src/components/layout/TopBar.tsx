import { useEffect, useState } from 'react';
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import { ConnPill } from '@/components/common/ConnPill';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useLiveStore, useWorstState } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

/**
 * Global bar: system state on the left (worst camera), stream health on the right,
 * plus theme toggle. Nothing camera-specific belongs here — that lives in the page.
 */
export function TopBar() {
  const worst = useWorstState();
  const conn = useLiveStore((s) => s.conn);
  const demoMode = useLiveStore((s) => s.demoMode);
  const selected = useLiveStore((s) => s.cameras.find((c) => c.id === s.selectedCameraId));
  const runtimes = useLiveStore((s) => s.runtimes);
  const { theme, toggleTheme, sidebarCollapsed, toggle } = useUiStore();

  const [rate, setRate] = useState(0);
  const [clock, setClock] = useState(() => new Date());

  // msgs/min: sample the store's monotonic counter once a second.
  useEffect(() => {
    let prev = useLiveStore.getState().msgRate;
    const id = window.setInterval(() => {
      const now = useLiveStore.getState().msgRate;
      setRate(Math.max(0, (now - prev) * 60));
      prev = now;
      setClock(new Date());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const latency = selected ? (runtimes[selected.id]?.latencyMs ?? 0) : 0;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <button
        className="btn px-2"
        onClick={() => toggle('sidebarCollapsed')}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <StatusBadge state={worst} size="md" />
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-medium leading-tight">{selected?.name ?? 'No camera selected'}</div>
          <div className="truncate text-[11px] text-faint">{selected?.location}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden font-mono text-[11px] text-faint md:inline">
          {clock.toLocaleTimeString('en-IN', { hour12: false })}
        </span>
        {demoMode && (
          <span
            className="rounded-pill border border-forecast/40 bg-forecast/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-forecast"
            title="Showing synthetic data from the mock stream server — connect FastAPI to switch to live pipeline output"
          >
            Demo
          </span>
        )}
        <ConnPill state={conn} msgRate={rate} latencyMs={latency} />
        <button className="btn px-2" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
