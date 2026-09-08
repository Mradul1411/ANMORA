import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ToastRail } from '@/components/dashboard/ToastRail';
import { useLiveStream } from '@/hooks/useLiveStream';

/**
 * Shell = rail + top bar + routed page + alert toasts.
 * The live socket is mounted here (once) so it survives page navigation: switching to
 * Analytics must not drop the stream and lose the rolling history.
 */
export function AppShell() {
  useLiveStream();

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg text-ink">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {/* Suspense sits around the Outlet, not the whole app: navigating to a
              lazy-loaded page must not blank the rail, top bar or live stream. */}
          <Suspense
            fallback={
              <div className="grid h-64 place-items-center text-sm text-muted" role="status">
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ToastRail />
    </div>
  );
}
