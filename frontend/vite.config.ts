import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the Traffic & Crowd Density dashboard.
 *
 * Key points for this project:
 *  - `allowedHosts: true` so the dev server answers requests from any preview/proxy host
 *    (a plain `npm run dev` will otherwise reject non-localhost Host headers).
 *  - `host: '0.0.0.0'` so the server is reachable from outside the container.
 *  - `/api` and `/ws` are proxied to the backend, so the browser NEVER needs to know the
 *    backend's origin — no CORS, no hard-coded URL in the bundle.
 *  - The proxy target defaults to http://localhost:8787, the port your FastAPI backend
 *    should use (see src/backend/main.py). With nothing listening, `npm run dev` still
 *    works: the single health probe fails and the app runs the in-browser simulator.
 *    To override the target, set VITE_BACKEND (PowerShell: `$env:VITE_BACKEND="..."`).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND ?? 'http://localhost:8787';

  return {
    plugins: [react()],
    resolve: {
      // Must mirror the "paths" entry in tsconfig.json — TS resolves @/* for
      // typechecking, Vite needs the same alias to bundle it.
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/ws': { target: backend.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
    },
    build: {
      // No custom manualChunks: every split of React away from recharts' internals
      // (react-smooth, react-transition-group) produces a circular chunk that Rollup
      // warns about. Route-level code splitting in src/App.tsx is enough — it keeps
      // the three secondary views out of the initial download, which is the part
      // that actually matters for first paint.
      chunkSizeWarningLimit: 700,
    },
  };
});
