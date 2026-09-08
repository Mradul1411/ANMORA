import type { Camera, HistoryResponse, ModelsResponse } from '@/types/domain';
import { mockCameras, mockHistory, mockModels } from '@/mock/fixtures';

/**
 * REST client.
 *
 * Everything is called through the Vite proxy (`/api`), so the browser only ever
 * talks to its own origin — no CORS config, no hard-coded backend URL in the bundle.
 *
 * `useLiveStream` probes `/api/health` once. If nothing answers, the app runs the
 * in-browser simulator (fixtures + demoStream) and makes no further network calls.
 * If a backend answers, these getters become live and the simulator stays off.
 */

const timeout = <T>(p: Promise<T>, ms = 2500): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);

async function get<T>(path: string): Promise<T> {
  const res = await timeout(
    fetch(path, { headers: { accept: 'application/json' } }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json() as Promise<T>;
    }),
  );
  return res;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await timeout(
    fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.json() as Promise<T>;
    }),
  );
  return res;
}

export const api = {
  async health(): Promise<boolean> {
    try {
      await get<{ ok: boolean }>('/api/health');
      return true;
    } catch {
      return false;
    }
  },

  async cameras(): Promise<Camera[]> {
    try {
      return await get<Camera[]>('/api/cameras');
    } catch {
      return mockCameras;
    }
  },

  async createCamera(payload: Partial<Camera>): Promise<Camera> {
    return post<Camera>('/api/cameras', payload);
  },

  async history(cameraId: string, fromTs?: number, binSec: 30 | 60 = 60): Promise<HistoryResponse> {
    try {
      const qs = new URLSearchParams({ bin: String(binSec) });
      if (fromTs) qs.set('from', String(fromTs));
      return await get<HistoryResponse>(`/api/cameras/${cameraId}/history?${qs}`);
    } catch {
      return mockHistory(cameraId, binSec);
    }
  },

  async forecast(cameraId: string, model: string, horizonMin = 15): Promise<unknown> {
    return get<unknown>(`/api/cameras/${cameraId}/forecast?model=${model}&horizon=${horizonMin}`);
  },

  async alertThreshold(cameraId: string, state: string): Promise<{ ok: boolean }> {
    return post<{ ok: boolean }>(`/api/cameras/${cameraId}/threshold`, { state });
  },

  async models(): Promise<ModelsResponse> {
    try {
      return await get<ModelsResponse>('/api/models/metrics');
    } catch {
      return mockModels();
    }
  },
};

/** WebSocket URL — always same-origin so the Vite/Nginx proxy handles it. */
export function wsUrl(cameraId: string, opts: { frames?: boolean; frameRateHz?: number; binSec?: 30 | 60 } = {}): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const qs = new URLSearchParams({ camera_id: cameraId });
  if (opts.frames) qs.set('frames', '1');
  if (opts.frameRateHz) qs.set('frame_rate_hz', String(opts.frameRateHz));
  if (opts.binSec) qs.set('bin', String(opts.binSec));
  return `${proto}://${window.location.host}/ws/live?${qs.toString()}`;
}
