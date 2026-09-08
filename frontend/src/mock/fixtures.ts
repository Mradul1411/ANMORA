import type { Camera, CountPoint, HistoryResponse, ModelsResponse } from '@/types/domain';
import { computeThresholds, stateForValue } from '@/lib/utils';
import { sampleCount } from './signal';

export const CAMERA_SCALE: Record<string, number> = { 'cam-01': 1, 'cam-02': 0.7 };

export const mockCameras: Camera[] = [
  {
    id: 'cam-01',
    name: 'Junction A — Main Rd × Ring Rd',
    location: 'Sector 12 signal, north approach',
    stream: 'rtsp',
    url: 'rtsp://10.0.0.21:554/stream1',
    roiPolygon: [
      [0.12, 0.42],
      [0.88, 0.4],
      [0.96, 0.95],
      [0.05, 0.97],
    ],
    enabled: true,
    fps: 3,
  },
  {
    id: 'cam-02',
    name: 'Metro Gate 3 — Footway',
    location: 'East exit, pedestrian zone',
    stream: 'rtsp',
    url: 'rtsp://10.0.0.22:554/stream1',
    roiPolygon: [
      [0.05, 0.35],
      [0.95, 0.33],
      [0.95, 0.92],
      [0.05, 0.92],
    ],
    enabled: true,
    fps: 2,
  },
];

/**
 * 6 hours of 1-minute history so the chart and the percentile thresholds are
 * meaningful the moment the page loads.
 */
export function mockHistory(cameraId: string, binSec: 30 | 60 = 60, hours = 6): HistoryResponse {
  const now = Math.floor(Date.now() / 60000) * 60000;
  const binMs = binSec * 1000;
  const n = Math.floor((hours * 3600 * 1000) / binMs);
  const scale = CAMERA_SCALE[cameraId] ?? 1;
  const points: CountPoint[] = [];

  for (let i = n; i > 0; i--) {
    const ts = now - i * binMs;
    const binTs = Math.floor(ts / 60000) * 60000;
    const { total, byClass } = sampleCount(binTs, cameraId, scale);
    const scaled = Math.round((total / 60) * binSec);
    points.push({ ts, binSec, total: scaled, byClass, state: 'low' });
  }

  const thresholds = computeThresholds(points.map((p) => p.total));
  points.forEach((p) => {
    p.state = stateForValue(p.total, thresholds);
  });

  return { cameraId, binSec, thresholds, points };
}

export function mockModels(): ModelsResponse {
  return {
    detection: { mAP50: 44.9, precision: 0.86, recall: 0.81, fps: 22.4 },
    tracking: { hota: 0.61, idSwitchesPerMin: 1.4 },
    metrics: [
      {
        id: 'ma',
        label: 'Moving Average',
        family: 'baseline',
        mae: 6.4,
        rmse: 8.9,
        mape: 21.4,
        inferMs: 0.4,
        note: 'Reference point. Misses the evening surge entirely.',
      },
      {
        id: 'sarima',
        label: 'SARIMA (1,1,1)(1,0,1,24)',
        family: 'statistical',
        mae: 4.1,
        rmse: 5.7,
        mape: 13.8,
        inferMs: 12,
        note: 'Strong on linear trend + 24h seasonality; slow to react to spikes.',
      },
      {
        id: 'prophet',
        label: 'Prophet',
        family: 'additive-ml',
        mae: 3.6,
        rmse: 5.1,
        mape: 11.9,
        inferMs: 48,
        note: 'Best general fit; slight oversmoothing of abrupt shifts.',
      },
      {
        id: 'lstm',
        label: 'LSTM (2×64, seq 30)',
        family: 'deep',
        mae: 3.2,
        rmse: 4.6,
        mape: 10.4,
        inferMs: 21,
        note: 'Best on non-linear surges; needs more history to stay stable.',
      },
    ],
  };
}
