import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  Alert,
  Camera,
  CocoClass,
  ConnState,
  CountPoint,
  DensityState,
  Forecast,
  ModelId,
  ServerEvent,
  Thresholds,
} from '@/types/domain';
import { computeThresholds, stateForValue } from '@/lib/utils';

const HISTORY_LIMIT = 720; // 12h of 1-minute bins held in memory
const MAX_ALERTS = 40;

interface CameraRuntime {
  points: CountPoint[]; // observed interval counts (ring buffer)
  forecast: Forecast | null;
  latestTotal: number;
  byClass: Record<CocoClass, number>;
  state: DensityState;
  fps: number;
  latencyMs: number;
  trackCount: number;
  idSwitches: number;
  lastTick: number | null;
  frame?: string; // data URL of latest annotated frame
  frameMeta?: { ts: number; trackCount: number; idSwitches: number };
  online: boolean;
}

const emptyByClass = (): Record<CocoClass, number> => ({
  person: 0,
  car: 0,
  bus: 0,
  truck: 0,
  motorcycle: 0,
});

const emptyRuntime = (): CameraRuntime => ({
  points: [],
  forecast: null,
  latestTotal: 0,
  byClass: emptyByClass(),
  state: 'low',
  fps: 0,
  latencyMs: 0,
  trackCount: 0,
  idSwitches: 0,
  lastTick: null,
  online: true,
});

interface LiveState {
  cameras: Camera[];
  selectedCameraId: string;
  runtimes: Record<string, CameraRuntime>;
  thresholds: Record<string, Thresholds>;
  alerts: Alert[];
  conn: ConnState;
  msgRate: number;
  demoMode: boolean;
  apiOnline: boolean;

  setCameras: (cams: Camera[]) => void;
  selectCamera: (id: string) => void;
  seedHistory: (cameraId: string, points: CountPoint[], thresholds: Thresholds) => void;
  applyEvent: (event: ServerEvent) => void;
  ackAlert: (id: string) => void;
  ackAll: () => void;
  setConn: (c: ConnState) => void;
  setMsgRate: (n: number) => void;
  setDemoMode: (v: boolean) => void;
  setApiOnline: (v: boolean) => void;
  reset: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  cameras: [],
  selectedCameraId: '',
  runtimes: {},
  thresholds: {},
  alerts: [],
  conn: 'connecting',
  msgRate: 0,
  demoMode: true,
  apiOnline: false,

  setCameras: (cams) =>
    set((s) => {
      const runtimes = { ...s.runtimes };
      cams.forEach((c) => {
        if (!runtimes[c.id]) runtimes[c.id] = emptyRuntime();
      });
      const selected = s.selectedCameraId && cams.some((c) => c.id === s.selectedCameraId) ? s.selectedCameraId : (cams[0]?.id ?? '');
      return { cameras: cams, runtimes, selectedCameraId: selected };
    }),

  selectCamera: (id) => set({ selectedCameraId: id }),

  seedHistory: (cameraId, points, thresholds) =>
    set((s) => ({
      thresholds: { ...s.thresholds, [cameraId]: thresholds },
      runtimes: {
        ...s.runtimes,
        [cameraId]: {
          ...(s.runtimes[cameraId] ?? emptyRuntime()),
          points,
          latestTotal: points.at(-1)?.total ?? 0,
          byClass: points.at(-1)?.byClass ?? emptyByClass(),
          state: points.at(-1)?.state ?? 'low',
        },
      },
    })),

  applyEvent: (event) =>
    set((s) => {
      switch (event.type) {
        case 'live': {
          const rt = s.runtimes[event.cameraId] ?? emptyRuntime();
          const prev = rt.points.at(-1);
          // Aggregate into a new bin only when the server's bin timestamp advances;
          // otherwise fold the tick into the current bin (server may tick faster than bins).
          const binTs = Math.floor(event.ts / 60000) * 60000;
          let points = rt.points;
          if (!prev || prev.ts < binTs) {
            const point: CountPoint = {
              ts: binTs,
              binSec: 60,
              total: event.total,
              byClass: event.counts,
              state: event.state,
            };
            points = [...rt.points, point].slice(-HISTORY_LIMIT);
          } else {
            points = rt.points.slice(0, -1).concat({ ...prev, total: event.total, byClass: event.counts, state: event.state });
          }

          // Thresholds recompute on a rolling window so a new camera converges from
          // its own history instead of a hard-coded global number.
          const existing = s.thresholds[event.cameraId];
          const thresholds =
            existing && existing.computedFromPoints > 240
              ? existing
              : computeThresholds(points.map((p) => p.total));

          return {
            msgRate: s.msgRate + 1,
            runtimes: {
              ...s.runtimes,
              [event.cameraId]: {
                ...rt,
                points,
                latestTotal: event.total,
                byClass: event.counts,
                state: stateForValue(event.total, thresholds),
                fps: event.fps,
                latencyMs: event.latencyMs,
                trackCount: event.trackCount,
                idSwitches: event.idSwitches,
                lastTick: event.ts,
                online: true,
                frame: event.frame?.jpegB64 ? `data:image/jpeg;base64,${event.frame.jpegB64}` : rt.frame,
                frameMeta: event.frame ? { ts: event.frame.ts, trackCount: event.frame.trackCount, idSwitches: event.frame.idSwitches } : rt.frameMeta,
              },
            },
            thresholds: { ...s.thresholds, [event.cameraId]: thresholds },
          };
        }

        case 'forecast':
          return {
            runtimes: {
              ...s.runtimes,
              [event.cameraId]: {
                ...(s.runtimes[event.cameraId] ?? emptyRuntime()),
                forecast: {
                  cameraId: event.cameraId,
                  horizonMin: event.horizonMin,
                  generatedAt: event.generatedAt,
                  model: event.model,
                  points: event.points,
                },
              },
            },
          };

        case 'alert': {
          if (s.alerts.some((a) => a.id === event.alert.id)) return s;
          return { alerts: [event.alert, ...s.alerts].slice(0, MAX_ALERTS) };
        }

        case 'status':
          return {
            runtimes: {
              ...s.runtimes,
              [event.cameraId]: { ...(s.runtimes[event.cameraId] ?? emptyRuntime()), online: event.online },
            },
          };

        default: {
          // Never drop an unknown event silently — a backend that forgets `type`
          // would otherwise look like a dead stream.
          console.warn('[liveStore] unhandled socket event', (event as { type?: string })?.type, event);
          return s;
        }
      }
    }),

  ackAlert: (id) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acked: true } : a)) })),
  ackAll: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acked: true })) })),
  setConn: (c) => set({ conn: c }),
  setMsgRate: (n) => set({ msgRate: n }),
  setDemoMode: (v) => set({ demoMode: v }),
  setApiOnline: (v) => set({ apiOnline: v }),
  reset: () => set({ runtimes: {}, alerts: [], thresholds: {}, msgRate: 0 }),
}));

/* ---------- derived selectors --------------------------------------------- */

// React 18's useSyncExternalStore (used by zustand v5) requires the selected value
// to be referentially stable between store updates: a selector that builds a fresh
// array/object on every call makes the component re-render forever. Selectors below
// therefore either return store references directly, compare with useShallow, or
// fall back to a module-level constant — never a freshly-built value.

const EMPTY_RUNTIME = emptyRuntime();

export const useSelectedCamera = () =>
  useLiveStore((s) => s.cameras.find((c) => c.id === s.selectedCameraId) ?? null);

export const useSelectedRuntime = () =>
  useLiveStore((s) => s.runtimes[s.selectedCameraId] ?? EMPTY_RUNTIME);

export const useActiveAlerts = () =>
  useLiveStore(useShallow((s) => s.alerts.filter((a) => !a.acked)));

/** Global worst state across online cameras — drives the top-bar status chip. */
export const useWorstState = (): DensityState => {
  const order: DensityState[] = ['low', 'medium', 'high', 'critical'];
  const states = useLiveStore(useShallow((s) => Object.values(s.runtimes).map((r) => r.state)));
  if (!states.length) return 'low';
  return order[Math.max(...states.map((st) => order.indexOf(st)))] as DensityState;
};

export type { ModelId };
