import { useCallback, useEffect, useRef } from 'react';
import { api, wsUrl } from '@/api/client';
import { mockCameras } from '@/mock/fixtures';
import { startDemoStream } from '@/mock/demoStream';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';
import { useLiveSocket } from './useLiveSocket';
import type { ServerEvent } from '@/types/domain';

/**
 * Single owner of "where does live data come from".
 *
 *  1. One health probe on startup (module-singleton, so React StrictMode's
 *     double-mount does not probe twice).
 *  2. Backend answers  -> apiOnline=true: cameras + history over REST, live over WS.
 *     Backend silent    -> demoMode=true: fixtures + the in-browser simulator feed the
 *     store with identical ServerEvent objects. No further network attempts are made,
 *     so a backend-less `npm run dev` stays quiet after that one probe.
 *
 * The store never knows which source is feeding it: both paths emit ServerEvent.
 */

let bootstrap: Promise<void> | null = null;

function runBootstrap() {
  if (!bootstrap) bootstrap = doBootstrap();
  return bootstrap;
}

async function doBootstrap() {
  const { setApiOnline, setDemoMode, setConn, setCameras, seedHistory } = useLiveStore.getState();

  const healthy = await api.health();
  setApiOnline(healthy);
  setDemoMode(!healthy);
  if (!healthy) setConn('demo');

  if (healthy) {
    const cams = await api.cameras();
    setCameras(cams);
    // History gives the percentiles + chart context before the first live bin arrives.
    cams.forEach(async (c) => {
      const h = await api.history(c.id, undefined, 60);
      seedHistory(c.id, h.points, h.thresholds);
    });
  } else {
    // No backend: don't touch the network again. Fixtures stand in for REST.
    setCameras(mockCameras);
  }
}

export function useLiveStream() {
  const applyEvent = useLiveStore((s) => s.applyEvent);
  const apiOnline = useLiveStore((s) => s.apiOnline);
  const selectedId = useLiveStore((s) => s.selectedCameraId);
  const cameraCount = useLiveStore((s) => s.cameras.length);
  const { showFrames, frameRateHz } = useUiStore();
  const stopRef = useRef<null | (() => void)>(null);

  // 1. probe + hydrate, exactly once per page load
  useEffect(() => {
    void runBootstrap();
  }, []);

  const onMessage = useCallback((e: ServerEvent) => applyEvent(e), [applyEvent]);

  // 2. real socket — only opened when a backend answered the probe
  const url = selectedId ? wsUrl(selectedId, { frames: showFrames, frameRateHz }) : '';
  useLiveSocket({ url, enabled: Boolean(selectedId) && apiOnline, onMessage, onStateChange: useLiveStore.getState().setConn });

  // 3. in-browser simulator — only when there is no backend
  useEffect(() => {
    if (apiOnline) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }
    const ids = useLiveStore.getState().cameras.map((c) => c.id);
    if (!ids.length) return;
    stopRef.current = startDemoStream(ids, applyEvent);
    return () => {
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [apiOnline, cameraCount, applyEvent]);
}
