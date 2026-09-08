import type { Alert, CocoClass, DensityState, ServerEvent } from '@/types/domain';
import { stateForValue } from '@/lib/utils';
import { demoForecast, sampleCount } from './signal';
import { mockHistory } from './fixtures';
import { useLiveStore } from '@/store/liveStore';

/**
 * In-browser demo stream.
 *
 * Emits exactly the same `ServerEvent` objects as the real FastAPI `/ws/live`, so the
 * whole UI is exercised identically with no backend at all (laptop demo, viva fallback).
 * It is the default mode: `npm run dev` with nothing listening simply runs this.
 */
export function startDemoStream(cameraIds: string[], onEvent: (e: ServerEvent) => void): () => void {
  const binMs = 60_000;
  const tickMs = 2000;
  let lastAlertAt: Record<string, number> = {};
  const timers: number[] = [];

  // Seed rolling history + percentile thresholds so charts are meaningful at t=0.
  cameraIds.forEach((id) => {
    const h = mockHistory(id, 60, 6);
    useLiveStore.getState().seedHistory(id, h.points, h.thresholds);
  });

  const emitForecast = (id: string) => {
    const rt = useLiveStore.getState().runtimes[id];
    if (!rt) return;
    onEvent({
      type: 'forecast',
      cameraId: id,
      generatedAt: Date.now(),
      horizonMin: 15,
      model: 'prophet',
      points: demoForecast(
        rt.points.slice(-20).map((p) => ({ ts: p.ts, total: p.total })),
        id,
        15,
      ),
    });
  };

  cameraIds.forEach((id) => emitForecast(id));
  timers.push(window.setInterval(() => cameraIds.forEach(emitForecast), 30_000));

  const tick = () => {
    const now = Math.floor(Date.now() / binMs) * binMs;
    const offsetSec = Math.floor((Date.now() - now) / 1000);
    cameraIds.forEach((id, idx) => {
      const scale = idx === 0 ? 1 : 0.7;
      const { total, byClass } = sampleCount(now, id, scale, { offsetSec });
      const thresholds = useLiveStore.getState().thresholds[id];
      const state: DensityState = thresholds ? stateForValue(total, thresholds) : 'low';

      onEvent({
        type: 'live',
        cameraId: id,
        ts: Date.now(),
        counts: byClass as Record<CocoClass, number>,
        total,
        state,
        fps: 2 + ((Date.now() / 1000) % 1),
        latencyMs: 38 + Math.round((Math.sin(Date.now() / 3000) + 1) * 9),
        trackCount: total,
        idSwitches: Math.random() > 0.9 ? 1 : 0,
      });

      // Alert on the p90 rule, debounced to one per camera per 2 minutes.
      if (state === 'critical' && Date.now() - (lastAlertAt[id] ?? 0) > 120_000) {
        lastAlertAt[id] = Date.now();
        const alert: Alert = {
          id: `${id}-${now}`,
          cameraId: id,
          ts: Date.now(),
          severity: 'critical',
          state,
          count: total,
          message: `${total} objects in ROI exceeds p90 (${thresholds?.p90 ?? '?'}). Alert threshold triggered.`,
          acked: false,
        };
        onEvent({ type: 'alert', alert });
      }
    });
  };

  tick();
  timers.push(window.setInterval(tick, tickMs));

  return () => timers.forEach((t) => window.clearInterval(t));
}
