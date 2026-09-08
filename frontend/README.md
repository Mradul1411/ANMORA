# Density Ops — frontend

Live dashboard for the **Real-Time Traffic & Crowd Density Predictor**
(YOLOv8 → ByteTrack → interval counts → percentile density states → 15-minute forecast).

Design rationale, colour tokens, API contract and build order: **`../FRONTEND-PLAN.md`**.

## Run (no backend needed)

```bash
npm install
npm run dev          # → http://localhost:5173
```

On startup the app probes `/api/health` **once**. Nothing listening? It runs the in-browser
synthetic simulator: you get the full UI — live tiles, counts, forecast, alerts — and a violet
**Demo** chip in the top bar so nobody mistakes it for real data. (One red `http proxy error`
line at startup is that probe; it is expected and harmless.)

## Run against your FastAPI backend

Start the backend on port **8787** (the proxy's default target) and just run `npm run dev` —
the health probe answers, the Demo chip disappears, and real data flows. No env var needed.

```bash
pip install fastapi "uvicorn[standard]"
cd frontend
uvicorn src.backend.main:app --reload --port 8787     # terminal 1
npm run dev                                            # terminal 2
```

Backend on a different port? Then set it (PowerShell syntax shown; see note below):

```powershell
$env:VITE_BACKEND="http://localhost:8000"; npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on `0.0.0.0:5173`, proxies `/api` + `/ws` to the backend |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run preview` | serve the production build on `:4173` |

## Where things live

| Path | Purpose |
|---|---|
| `src/theme/tokens.css` | **all colour**, both themes. Change the look here, nowhere else |
| `src/types/domain.ts` | **the backend contract.** Keep in sync with `src/backend/main.py` |
| `src/store/liveStore.ts` | server state: counts, thresholds, forecast, alerts |
| `src/hooks/useLiveSocket.ts` | WebSocket + exponential backoff |
| `src/hooks/useLiveStream.ts` | the one probe that picks backend vs. in-browser simulator |
| `src/mock/` | synthetic signal + fixtures for demo mode |
| `src/backend/main.py` | FastAPI reference implementation to build against |

## Windows / PowerShell notes

- `VITE_BACKEND=... npm run dev` is bash-only syntax and fails in PowerShell with
  `CommandNotFoundException`. Use `$env:VITE_BACKEND="..."; npm run dev` there, or
  `set VITE_BACKEND=... && npm run dev` in cmd.exe. Or nothing at all if the backend is on 8787.
- Pointing `VITE_BACKEND` at a port with nothing listening gives `http proxy error …
  ECONNREFUSED` lines; the page still loads on the simulator.

## Deploy

```bash
npm run build
cp -r dist/* ../src/backend/static/     # then open http://host:8787/app
```

`HashRouter` means no server-side rewrite rules are needed for deep links.
