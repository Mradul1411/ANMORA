import { useCallback, useEffect, useRef } from 'react';
import type { ServerEvent } from '@/types/domain';

export interface UseLiveOptions {
  /** Full ws:// URL for this camera stream. */
  url: string;
  enabled: boolean;
  onMessage: (event: ServerEvent) => void;
  onStateChange: (state: 'connecting' | 'open' | 'reconnecting' | 'closed') => void;
  /** Exponential backoff with jitter; capped so a dead backend doesn't hammer the box. */
  maxBackoffMs?: number;
}

/**
 * WebSocket subscription with auto-reconnect.
 *
 * Why this lives in a hook: the live stream is the single most failure-prone part of
 * the demo (pipeline restarts, RTSP dropouts). The hook guarantees the UI recovers
 * without a page reload and reports exactly which state it is in so the top bar can
 * show "reconnecting…" instead of silently showing stale data.
 */
export function useLiveSocket({ url, enabled, onMessage, onStateChange, maxBackoffMs = 8000 }: UseLiveOptions) {
  const socketRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(true);

  // Keep the latest callbacks without re-creating the socket on every render.
  const msgRef = useRef(onMessage);
  const stateRef = useRef(onStateChange);
  useEffect(() => {
    msgRef.current = onMessage;
    stateRef.current = onStateChange;
  }, [onMessage, onStateChange]);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const s = socketRef.current;
    socketRef.current = null;
    if (s) {
      s.onopen = s.onmessage = s.onerror = s.onclose = null;
      if (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING) s.close();
    }
  }, []);

  const connect = useCallback(() => {
    if (!aliveRef.current || !enabled) return;
    cleanup();
    stateRef.current(attemptRef.current === 0 ? 'connecting' : 'reconnecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socketRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      stateRef.current('open');
    };

    ws.onmessage = (ev) => {
      // Binary frames (raw JPEG) are possible; the mock/real server sends JSON+base64
      // so the transport stays identical for a Python `websockets` backend.
      if (typeof ev.data !== 'string') return;
      try {
        msgRef.current(JSON.parse(ev.data) as ServerEvent);
      } catch {
        /* ignore malformed frames rather than tearing down the stream */
      }
    };

    ws.onerror = () => {
      /* onclose always follows; handled there */
    };

    ws.onclose = () => {
      socketRef.current = null;
      if (!aliveRef.current || !enabled) return;
      scheduleReconnect();
    };
  }, [cleanup, enabled, url]);

  function scheduleReconnect() {
    const backoff = Math.min(maxBackoffMs, 500 * 2 ** attemptRef.current);
    const jitter = backoff * 0.3 * Math.random();
    attemptRef.current += 1;
    stateRef.current('reconnecting');
    timerRef.current = window.setTimeout(connect, backoff + jitter);
  }

  useEffect(() => {
    aliveRef.current = true;
    if (enabled) connect();
    else {
      cleanup();
      stateRef.current('closed');
    }
    return () => {
      aliveRef.current = false;
      cleanup();
    };
    // `connect` is stable enough here; re-running on url/enabled change is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url, cleanup]);

  const send = useCallback((payload: unknown) => {
    const s = socketRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(JSON.stringify(payload));
  }, []);

  return { send };
}
