import { lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { LivePage } from '@/pages/LivePage';

/**
 * HashRouter on purpose: the built bundle is static, so it can be served by FastAPI's
 * StaticFiles (or any folder) without needing server-side route rewrites for deep links.
 *
 * The three secondary views are lazy-loaded. Live is the page you demo, so it stays in
 * the main chunk; Analytics/Models/Cameras load on first navigation. The Suspense
 * boundary lives around the <Outlet> inside AppShell so the rail, top bar and the live
 * socket stay mounted while a page chunk loads.
 */
const CamerasPage = lazy(() => import('@/pages/CamerasPage').then((m) => ({ default: m.CamerasPage })));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const ModelsPage = lazy(() => import('@/pages/ModelsPage').then((m) => ({ default: m.ModelsPage })));

export default function App() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<LivePage />} />
          <Route path="cameras" element={<CamerasPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="models" element={<ModelsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
