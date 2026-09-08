import { useEffect, useMemo, useState } from 'react';

/**
 * Tiny sparkline drawn as an SVG polyline (no chart library on the hot path).
 * Used in KPI cards and camera tiles where 10–20 points is all the context needed.
 */
export function Sparkline({
  values,
  color = 'rgb(var(--primary))',
  height = 34,
  fill = true,
}: {
  values: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    // Recharts and SVG both read CSS vars; force one paint after theme switch.
    const t = setTimeout(() => force((n) => n + 1), 0);
    return () => clearTimeout(t);
  }, []);

  const { line, area } = useMemo(() => {
    const w = 100;
    const h = height;
    if (values.length < 2) return { line: '', area: '' };
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return { line: `M${pts.join(' L')}`, area: `M${pts.join(' L')} L${w},${h} L0,${h} Z` };
  }, [values, height]);

  if (!line) return <div style={{ height }} className="w-full" />;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      {fill && <path d={area} fill={color} opacity={0.14} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}
