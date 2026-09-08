import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { BarChart3, Boxes, LayoutGrid, Radar, Waves } from 'lucide-react';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

const NAV = [
  { to: '/', label: 'Live', icon: Waves, hint: 'Real-time monitoring' },
  { to: '/cameras', label: 'Cameras', icon: Boxes, hint: 'Feeds, ROI, health' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, hint: 'History & peaks' },
  { to: '/models', label: 'Models', icon: LayoutGrid, hint: 'Evaluation metrics' },
];

/**
 * Left rail. Deliberately only four destinations: the project's story is
 * observe → configure → analyse → prove. Anything else lives inside those pages.
 */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const cameras = useLiveStore((s) => s.cameras);
  const worst = useLiveStore((s) => s.runtimes);

  const criticalCount = Object.values(worst).filter((r) => r.state === 'critical').length;

  return (
    <nav
      aria-label="Primary"
      className={clsx(
        'z-20 flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[220px]',
      )}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
          <Radar size={18} aria-hidden />
        </span>
        {!collapsed && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">Density Ops</span>
            <span className="block truncate text-[10px] uppercase tracking-wider text-faint">Traffic &amp; Crowd</span>
          </span>
        )}
      </div>

      <ul className="flex flex-col gap-1 p-2">
        {NAV.map(({ to, label, icon: Icon, hint }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/12 text-primary' : 'text-muted hover:bg-elevated hover:text-ink',
                )
              }
            >
              <Icon size={18} className="shrink-0" aria-hidden />
              {!collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{label}</span>
                  <span className="block truncate text-[10px] text-faint">{hint}</span>
                </span>
              )}
              {!collapsed && to === '/' && criticalCount > 0 && (
                <span className="rounded-pill bg-critical/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-critical">
                  {criticalCount}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="mt-auto space-y-2 p-2">
        {!collapsed && (
          <div className="rounded-lg border border-line bg-bg p-3">
            <div className="text-[10px] uppercase tracking-wider text-faint">Pipeline</div>
            <dl className="mt-1.5 space-y-1 font-mono text-[11px] text-muted">
              <div className="flex justify-between">
                <dt>detect</dt>
                <dd className="text-ink">YOLOv8s</dd>
              </div>
              <div className="flex justify-between">
                <dt>track</dt>
                <dd className="text-ink">ByteTrack</dd>
              </div>
              <div className="flex justify-between">
                <dt>bin</dt>
                <dd className="text-ink">60s</dd>
              </div>
              <div className="flex justify-between">
                <dt>feeds</dt>
                <dd className="text-ink">{cameras.length}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </nav>
  );
}
