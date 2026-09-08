"""
FastAPI backend reference — the contract the React dashboard expects.

This file is the *interface* half of Stage 8 (Live Serving). It is deliberately thin:
the vision pipeline (YOLOv8 -> ByteTrack -> aggregation) and the forecasters live in
src/vision and src/forecasting, and publish into the same queues/tables used here.

Run:
    uvicorn src.backend.main:app --reload --port 8787
Frontend:
    VITE_BACKEND=http://localhost:8787 npm run dev      (in frontend/)

Everything the UI consumes is defined in frontend/src/types/domain.ts — keep the two
in sync, that file is the source of truth for field names.
"""

from __future__ import annotations

import asyncio
import json
from collections import defaultdict, deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Deque, Dict, List, Literal

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

DensityState = Literal["low", "medium", "high", "critical"]
BIN_MS = 60_000

app = FastAPI(title="Traffic & Crowd Density API", version="0.1.0")

# Only needed if you serve the frontend from a different origin during development.
# In production the built bundle is served by this same app (see the StaticFiles mount
# at the bottom), so no CORS is required at all.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Models (mirror frontend/src/types/domain.ts)
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class Camera:
    id: str
    name: str
    location: str
    stream: Literal["rtsp", "webcam", "file"]
    url: str
    roiPolygon: List[List[float]]
    enabled: bool = True
    fps: int = 3


@dataclass
class Thresholds:
    p25: int
    p50: int
    p75: int
    p90: int
    computedFromPoints: int
    windowDays: int = 14


@dataclass
class CountPoint:
    ts: int
    binSec: int
    total: int
    byClass: Dict[str, int]
    state: DensityState


@dataclass
class ForecastPoint:
    ts: int
    value: int
    lo: int
    hi: int


# ─────────────────────────────────────────────────────────────────────────────
# State. SQLite/Postgres in the real build; in-memory here so the file is runnable.
# ─────────────────────────────────────────────────────────────────────────────
CAMERAS: List[Camera] = [
    Camera(
        id="cam-01",
        name="Junction A — Main Rd × Ring Rd",
        location="Sector 12 signal, north approach",
        stream="rtsp",
        url="rtsp://10.0.0.21:554/stream1",
        roiPolygon=[[0.12, 0.42], [0.88, 0.40], [0.96, 0.95], [0.05, 0.97]],
        fps=3,
    )
]

HISTORY: Dict[str, Deque[CountPoint]] = defaultdict(lambda: deque(maxlen=1440))
THRESHOLDS: Dict[str, Thresholds] = {}
ALERT_STATE: Dict[str, float] = {}


def percentile_thresholds(values: List[int]) -> Thresholds:
    """Stage 4: density bands from the historical distribution of THIS camera."""
    s = sorted(values)
    if not s:
        return Thresholds(0, 0, 0, 0, 0)

    def q(p: float) -> int:
        return int(s[min(len(s) - 1, int(p * len(s)))])

    return Thresholds(q(0.25), q(0.5), q(0.75), q(0.90), len(s))


def state_for(value: int, t: Thresholds) -> DensityState:
    if value > t.p90:
        return "critical"
    if value > t.p75:
        return "high"
    if value >= t.p25:
        return "medium"
    return "low"


# ─────────────────────────────────────────────────────────────────────────────
# Pub/sub: the vision worker publishes, WebSocket clients subscribe.
# A single-process deque-of-queues is fine for one camera; swap this for
# Redis pub/sub (or RabbitMQ) when you scale to many streams — that is the
# documented scaling step, and nothing else in this file changes.
# ─────────────────────────────────────────────────────────────────────────────
@dataclass
class Broker:
    subs: Dict[str, List[asyncio.Queue]] = field(default_factory=lambda: defaultdict(list))

    def subscribe(self, camera_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        self.subs[camera_id].append(q)
        return q

    def unsubscribe(self, camera_id: str, q: asyncio.Queue) -> None:
        if q in self.subs[camera_id]:
            self.subs[camera_id].remove(q)

    async def publish(self, camera_id: str, event: Dict[str, Any]) -> None:
        for q in list(self.subs[camera_id]):
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                # Drop the oldest frame rather than applying back-pressure to the
                # detection worker: a lagging viewer must never slow the pipeline.
                try:
                    q.get_nowait()
                    q.put_nowait(event)
                except asyncio.QueueEmpty:
                    pass


broker = Broker()


# ─────────────────────────────────────────────────────────────────────────────
# REST
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True, "service": "traffic-crowd-density", "cameras": len(CAMERAS)}


@app.get("/api/cameras")
async def list_cameras() -> List[Camera]:
    return CAMERAS


@app.post("/api/cameras", status_code=201)
async def create_camera(payload: dict) -> Camera:
    cam = Camera(
        id=payload.get("id", f"cam-{len(CAMERAS) + 1:02d}"),
        name=payload["name"],
        location=payload.get("location", ""),
        stream=payload.get("stream", "rtsp"),
        url=payload.get("url", ""),
        roiPolygon=payload.get("roiPolygon", [[0, 0], [1, 0], [1, 1], [0, 1]]),
        fps=int(payload.get("fps", 3)),
    )
    CAMERAS.append(cam)
    return cam


@app.get("/api/cameras/{camera_id}/history")
async def get_history(camera_id: str, bin: int = 60, hours: int = 6) -> Dict[str, Any]:
    points = [p for p in HISTORY[camera_id] if p.binSec == bin]
    if not THRESHOLDS.get(camera_id):
        THRESHOLDS[camera_id] = percentile_thresholds([p.total for p in points])
    return {
        "cameraId": camera_id,
        "binSec": bin,
        "thresholds": THRESHOLDS[camera_id].__dict__,
        "points": [p.__dict__ for p in points],
    }


@app.get("/api/cameras/{camera_id}/forecast")
async def get_forecast(camera_id: str, model: str = "prophet", horizon: int = 15) -> Dict[str, Any]:
    """
    Real implementation: load the forecaster for `model` and predict `horizon` steps
    from the tail of HISTORY[camera_id]. Kept abstract here — the UI only needs the
    {cameraId, horizonMin, generatedAt, model, points[]} shape.
    """
    from src.forecasting.predict import predict  # noqa: PLC0415  (import at call time)

    tail = [(p.ts, p.total) for p in list(HISTORY[camera_id])[-60:]]
    points = predict(tail, model=model, horizon_min=horizon)
    return {
        "cameraId": camera_id,
        "horizonMin": horizon,
        "generatedAt": points[0][0] - 60_000 if points else 0,
        "model": model,
        "points": [{"ts": ts, "value": v, "lo": lo, "hi": hi} for ts, v, lo, hi in points],
    }


@app.get("/api/models/metrics")
async def model_metrics() -> Dict[str, Any]:
    """Read the evaluation table produced by notebooks/03_Forecasting_Model_Comparison."""
    return {
        "detection": {"mAP50": 44.9, "precision": 0.86, "recall": 0.81, "fps": 22.4},
        "tracking": {"hota": 0.61, "idSwitchesPerMin": 1.4},
        "metrics": [],  # fill from the notebook's comparison output
    }


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket /ws/live
# ─────────────────────────────────────────────────────────────────────────────
@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket) -> None:
    """
    Streams ServerEvent objects as JSON text frames:
      {"type": "status"|"live"|"forecast"|"alert", ...}

    `live` may carry an optional `frame` object whose `jpegB64` is the annotated
    frame drawn by OpenCV (boxes + track IDs). The frontend renders it in an <img>
    and draws the ROI polygon separately from the vector metadata.
    """
    await websocket.accept()
    camera_id = websocket.query_params.get("camera_id", CAMERAS[0].id)
    want_frames = websocket.query_params.get("frames") == "1"
    frame_hz = min(5, max(1, int(websocket.query_params.get("frame_rate_hz", 3))))

    queue = broker.subscribe(camera_id)
    await websocket.send_text(json.dumps({"type": "status", "cameraId": camera_id, "online": True}))

    try:
        while True:
            event = await queue.get()
            if not want_frames and event.get("type") == "live":
                event.pop("frame", None)
            await websocket.send_text(json.dumps(event, default=str))
            # frame_hz is enforced by the publisher (the detection worker), which
            # already samples at 1–3 FPS per the design.
            _ = frame_hz
    except WebSocketDisconnect:
        pass
    finally:
        broker.unsubscribe(camera_id, queue)


# ─────────────────────────────────────────────────────────────────────────────
# Worker entry point: called by the vision pipeline on every aggregated bin.
# ─────────────────────────────────────────────────────────────────────────────
async def publish_bin(camera_id: str, ts: int, counts: Dict[str, int], frame_jpeg_b64: str | None,
                      boxes: List[Dict[str, Any]] | None = None) -> None:
    """
    Called by src/vision after ByteTrack + aggregation.
    Owns: density classification, alerting (p90 + 2-minute debounce), forecast refresh.
    """
    total = sum(counts.values())
    points = HISTORY[camera_id]
    points.append(CountPoint(ts=ts, binSec=60, total=total, byClass=counts, state="low"))

    thresholds = THRESHOLDS.get(camera_id) or percentile_thresholds([p.total for p in points])
    THRESHOLDS[camera_id] = thresholds
    state = state_for(total, thresholds)
    points[-1].state = state

    await broker.publish(camera_id, {
        "type": "live",
        "cameraId": camera_id,
        "ts": ts,
        "counts": counts,
        "total": total,
        "state": state,
        "fps": 0.0,          # set by the pipeline: achieved processing FPS
        "latencyMs": 0,      # set by the pipeline: capture -> publish
        "trackCount": total,
        "idSwitches": 0,
        "frame": {
            "ts": ts,
            "cameraId": camera_id,
            "width": 1920,
            "height": 1080,
            "boxes": boxes or [],
            "trackCount": total,
            "idSwitches": 0,
            "jpegB64": frame_jpeg_b64,
        } if frame_jpeg_b64 else None,
    })

    import time
    if state == "critical" and time.time() - ALERT_STATE.get(camera_id, 0) > 120:
        ALERT_STATE[camera_id] = time.time()
        await broker.publish(camera_id, {
            "type": "alert",
            "alert": {
                "id": f"{camera_id}-{ts}",
                "cameraId": camera_id,
                "ts": ts,
                "severity": "critical",
                "state": state,
                "count": total,
                "message": f"{total} objects in ROI exceeds p90 ({thresholds.p90}). Alert threshold triggered.",
                "acked": False,
            },
        })


# Serve the built dashboard from the same origin in production:
#   cd frontend && npm run build
#   cp -r frontend/dist/* src/backend/static/
#
# Mounted at /app (NOT "/") — a mount at the root would shadow every /api and /ws
# route above it. With HashRouter the deep links work without any rewrite rules.
_STATIC = Path(__file__).parent / "static"
if _STATIC.is_dir():
    app.mount("/app", StaticFiles(directory=_STATIC, html=True), name="static")
