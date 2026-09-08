import type { CocoClass, DensityState, Thresholds } from '@/types/domain';

/* ---------- density state (percentile rule from the report) ---------------- */

export function stateForValue(value: number, t: Thresholds): DensityState {
  if (value > t.p90) return 'critical';
  if (value > t.p75) return 'high';
  if (value >= t.p25) return 'medium';
  return 'low';
}

/** Percentile thresholds derived from a historical window, as in Stage 4. */
export function computeThresholds(values: number[]): Thresholds {
  if (values.length === 0) return { p25: 10, p50: 20, p75: 35, p90: 50, computedFromPoints: 0, windowDays: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return Math.round(sorted[idx]);
  };
  return {
    p25: q(0.25),
    p50: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    computedFromPoints: sorted.length,
    windowDays: 14,
  };
}

/* ---------- presentation maps --------------------------------------------- */

export const STATE_META: Record<
  DensityState,
  { label: string; varName: string; token: string; icon: 'gauge' | 'activity' | 'trendingUp' | 'siren'; blurb: string }
> = {
  low: { label: 'Low', varName: '--low', token: 'text-low', icon: 'gauge', blurb: 'Below p25 — normal monitoring' },
  medium: { label: 'Medium', varName: '--medium', token: 'text-medium', icon: 'activity', blurb: 'p25–p75 — moderate activity' },
  high: { label: 'High', varName: '--high', token: 'text-high', icon: 'trendingUp', blurb: 'p75–p90 — heavy activity' },
  critical: { label: 'Critical', varName: '--critical', token: 'text-critical', icon: 'siren', blurb: 'Above p90 — alert threshold' },
};

/** Resolves a token to an rgb() string usable in Recharts (which needs a real colour). */
export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function rgbTriple(name: string): string {
  const v = cssVar(name);
  return v.split(/\s+/).join(', ');
}

export function stateColor(state: DensityState): string {
  return `rgb(${rgbTriple(STATE_META[state].varName)})`;
}

export const CLASS_COLOR: Record<CocoClass, string> = {
  person: 'rgb(var(--person))',
  car: 'rgb(var(--car))',
  bus: 'rgb(var(--bus))',
  truck: 'rgb(var(--truck))',
  motorcycle: 'rgb(var(--moto))',
};

export const CLASS_LABEL: Record<CocoClass, string> = {
  person: 'Pedestrians',
  car: 'Cars',
  bus: 'Buses',
  truck: 'Trucks',
  motorcycle: 'Two-wheelers',
};

/* ---------- formatting ----------------------------------------------------- */

const nf = new Intl.NumberFormat('en-IN');

export const fmtInt = (n: number) => nf.format(Math.round(n));

export const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const fmtHM = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const head = Object.keys(rows[0]);
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(','), ...rows.map((r) => head.map((h) => esc(r[h])).join(','))].join('\n');
}

export function downloadText(filename: string, text: string, mime = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- time series helpers -------------------------------------------- */

/**
 * Largest-Triangle-Three-Buckets downsampling.
 * Charts get at most `bucket` points regardless of how long the session runs,
 * which keeps Recharts re-renders cheap on a 6h+ rolling window.
 */
export function downsampleLTTB<T extends { ts: number; total?: number }>(data: T[], bucket: number): T[] {
  if (data.length <= bucket) return data;
  const out: T[] = [data[0]];
  const every = (data.length - 2) / (bucket - 2);
  let a = 0;
  for (let i = 0; i < bucket - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    let rangeStart = Math.floor((i + 1) * every) + 1;
    let rangeEnd = Math.floor((i + 2) * every) + 1;
    rangeEnd = Math.min(rangeEnd, data.length);
    const rangeLen = rangeEnd - rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += data[j].ts;
      avgY += data[j].total ?? 0;
    }
    avgX /= rangeLen;
    avgY /= rangeLen;

    const start = Math.floor(i * every) + 1;
    const end = Math.floor((i + 1) * every) + 1;
    let maxArea = -1;
    let maxIdx = start;
    const pointAX = data[a].ts;
    const pointAY = data[a].total ?? 0;
    for (let j = start; j < end; j++) {
      const area = Math.abs(
        (pointAX - avgX) * ((data[j].total ?? 0) - pointAY) - (pointAX - data[j].ts) * (avgY - pointAY),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx = j;
      }
    }
    out.push(data[maxIdx]);
    a = maxIdx;
  }
  out.push(data[data.length - 1]);
  return out;
}

export function binLabel(binSec: 30 | 60): string {
  return binSec === 30 ? '30s bins' : '1 min bins';
}
