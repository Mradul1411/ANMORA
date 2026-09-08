/* ============================================================================
   Domain types — these mirror the FastAPI / WebSocket payloads exactly.
   Keep this file in sync with src/backend/main.py.
   ========================================================================== */

export type DensityState = 'low' | 'medium' | 'high' | 'critical';

export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'closed' | 'demo';

export type CocoClass = 'person' | 'car' | 'bus' | 'truck' | 'motorcycle';

export const COCO_CLASSES: CocoClass[] = ['person', 'car', 'bus', 'truck', 'motorcycle'];

export interface Camera {
  id: string;
  name: string;
  location: string;
  stream: 'rtsp' | 'webcam' | 'file';
  url: string;
  roiPolygon: [number, number][];
  enabled: boolean;
  fps: number; // processing FPS (1–3 per the report)
}

/** One aggregated interval count — the atomic time-series unit of the system. */
export interface CountPoint {
  ts: number; // epoch ms, start of the bin
  binSec: 30 | 60;
  total: number;
  byClass: Record<CocoClass, number>;
  state: DensityState;
}

export interface Thresholds {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  computedFromPoints: number;
  windowDays: number;
}

/** A 15-minute-ahead forecast from one candidate model. */
export interface ForecastPoint {
  ts: number; // future epoch ms
  value: number;
  lo: number; // 80% lower band
  hi: number; // 80% upper band
}

export type ModelId = 'ma' | 'sarima' | 'prophet' | 'lstm';

export interface Forecast {
  cameraId: string;
  horizonMin: number;
  generatedAt: number;
  model: ModelId; // model currently selected for display
  points: ForecastPoint[];
}

/** Detection metadata rendered as an overlay (not pixels) — optional, low bandwidth. */
export interface BoxMeta {
  id: number; // ByteTrack track id
  cls: CocoClass;
  conf: number;
  xyxy: [number, number, number, number]; // normalised 0..1
}

export interface FrameMeta {
  ts: number;
  cameraId: string;
  width: number;
  height: number;
  boxes: BoxMeta[];
  trackCount: number;
  idSwitches: number;
  /** base64 JPEG of the annotated frame, present when the client asked for frames */
  jpegB64?: string;
}

export interface LiveTick {
  type: 'live';
  cameraId: string;
  ts: number;
  counts: Record<CocoClass, number>;
  total: number;
  state: DensityState;
  fps: number; // pipeline throughput actually achieved
  latencyMs: number;
  trackCount: number;
  idSwitches: number;
  frame?: FrameMeta;
}

export interface ForecastEvent {
  type: 'forecast';
  cameraId: string;
  generatedAt: number;
  horizonMin: number;
  model: ModelId;
  points: ForecastPoint[];
}

export interface Alert {
  id: string;
  cameraId: string;
  ts: number;
  severity: 'critical' | 'warning';
  state: DensityState;
  count: number;
  message: string;
  acked: boolean;
}

export interface AlertEvent {
  type: 'alert';
  alert: Alert;
}

export interface StatusEvent {
  type: 'status';
  cameraId: string;
  online: boolean;
  reason?: string;
}

export interface ModelMetrics {
  id: ModelId;
  label: string;
  family: 'baseline' | 'statistical' | 'additive-ml' | 'deep';
  mae: number;
  rmse: number;
  mape: number;
  inferMs: number;
  note: string;
}

export type ServerEvent = LiveTick | ForecastEvent | AlertEvent | StatusEvent;

export interface HistoryResponse {
  cameraId: string;
  binSec: 30 | 60;
  thresholds: Thresholds;
  points: CountPoint[];
}

export interface ModelsResponse {
  metrics: ModelMetrics[];
  detection: { mAP50: number; precision: number; recall: number; fps: number };
  tracking: { hota: number; idSwitchesPerMin: number };
}
