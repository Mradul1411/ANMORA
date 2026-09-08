import type { CocoClass } from '@/types/domain';

/**
 * Synthetic density signal.
 *
 * Used by BOTH the browser fixtures and the Node mock WebSocket server, so the numbers
 * you see in demo mode are the same shape your real pipeline will produce: a diurnal
 * double peak, Poisson-ish noise, and an occasional surge that pushes past p90.
 *
 * Every sample is keyed by (cameraId, binTimestamp, offset). That makes it deterministic,
 * so REST /history and the live socket can never disagree about the same minute — which
 * is exactly how a real backend behaves when both read the same aggregation table.
 *
 * Replace this file with real data by pointing the client at FastAPI — nothing else
 * in the app knows this exists.
 */

/** Mulberry32 — deterministic PRNG so a "day" replays identically. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic pseudo-normal noise via Box–Muller on a seeded PRNG. */
export function gauss(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Expected objects in the ROI for a given wall-clock time.
 * Double peak: 09:00 office rush, 18:30 evening rush; night floor around 04:00.
 */
export function expectedFlow(hourFloat: number, cameraScale = 1): number {
  const g = (mu: number, sigma: number, amp: number) => amp * Math.exp(-((hourFloat - mu) ** 2) / (2 * sigma * sigma));
  const base = 6;
  const morning = g(9, 1.5, 26);
  const evening = g(18.5, 1.8, 34);
  const midday = g(13.5, 2.5, 8);
  return Math.max(1, (base + morning + evening + midday) * cameraScale);
}

/** Random surge (accident / event dispersal) that can drive a Critical alert. */
export function surgeFactor(binTs: number, cameraId: string): number {
  const rand = mulberry32(hash(cameraId) ^ Math.floor(binTs / (10 * 60_000)));
  const r = rand();
  if (r > 0.965) return 2.6;
  if (r > 0.9) return 1.6;
  return 1;
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Expected class mix for a road+footway ROI. */
const MIX: Record<CocoClass, number> = {
  person: 0.26,
  car: 0.42,
  bus: 0.06,
  truck: 0.09,
  motorcycle: 0.17,
};

export function splitClasses(total: number, rand: () => number): Record<CocoClass, number> {
  let remaining = Math.max(0, Math.round(total));
  const out = {} as Record<CocoClass, number>;
  const keys = Object.keys(MIX) as CocoClass[];
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      out[k] = remaining;
      return;
    }
    const consumed = keys.slice(0, i).reduce((a, b) => a + MIX[b], 0);
    const share = MIX[k] / (1 - consumed);
    const n = Math.max(0, Math.round(remaining * share * (0.85 + rand() * 0.3)));
    const take = Math.min(remaining, n);
    out[k] = take;
    remaining -= take;
  });
  return out;
}

export interface SampleOpts {
  /** seconds within the bin, for sub-bin ticks; 0 gives the canonical bin value */
  offsetSec?: number;
}

/** One synthetic observation for the bin containing `binTs`. */
export function sampleCount(binTs: number, cameraId: string, scale = 1, opts: SampleOpts = {}) {
  const d = new Date(binTs);
  const hourFloat = d.getHours() + d.getMinutes() / 60;
  const rand = mulberry32(hash(cameraId) ^ Math.floor(binTs / 60_000) ^ ((opts.offsetSec ?? 0) * 2654435761));
  const mu = expectedFlow(hourFloat, scale) * surgeFactor(binTs, cameraId);
  // Poisson-ish variance around mu, floored at 0.
  const total = Math.max(0, Math.round(mu + gauss(rand) * Math.sqrt(Math.max(mu, 4))));
  return { total, byClass: splitClasses(total, rand) };
}

/**
 * Naive forecaster for demo mode: damped persistence + the diurnal gradient,
 * with a widening 80% band. It exists so the chart shows a forecast shape before
 * SARIMA/Prophet/LSTM are wired in — the UI does not care which produced it.
 */
export function demoForecast(history: { ts: number; total: number }[], cameraId: string, horizonMin = 15) {
  const now = history.at(-1)?.ts ?? Date.now();
  const recent = history.slice(-10).map((p) => p.total);
  const level = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 10;
  const out: { ts: number; value: number; lo: number; hi: number }[] = [];
  for (let m = 1; m <= horizonMin; m++) {
    const ts = now + m * 60_000;
    const d = new Date(ts);
    const hourFloat = d.getHours() + d.getMinutes() / 60;
    const target = expectedFlow(hourFloat, 1) * surgeFactor(ts, cameraId);
    // blend persistence with the seasonal expectation, damping persistence over horizon
    const w = Math.exp(-m / 12);
    const value = Math.max(0, Math.round(w * level + (1 - w) * target));
    const spread = 1.6 * Math.sqrt(Math.max(value, 3)) * (1 + m / 20);
    out.push({ ts, value, lo: Math.max(0, Math.round(value - spread)), hi: Math.round(value + spread) });
  }
  return out;
}
