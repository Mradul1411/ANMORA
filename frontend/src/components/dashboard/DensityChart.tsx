import { useMemo } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { downsampleLTTB, fmtHM, fmtInt, rgbTriple } from '@/lib/utils';
import type { CountPoint, Forecast, Thresholds } from '@/types/domain';

interface Row {
  ts: number;
  actual?: number;
  forecast?: number;
  lo?: number;
  band?: number; // hi - lo, rendered as a stacked band from `lo`
  hi?: number;
}

/**
 * The core visual argument of the project: observed counts (solid cyan) and the
 * model's 15-minute forecast (dashed violet with an 80% band) on one time axis, with
 * the p75/p90 percentile lines that define High/Critical drawn as context.
 *
 * Performance choices:
 *  - LTTB downsample to <=400 points so a 24h view doesn't re-render 1440 nodes
 *  - isAnimationActive=false — animating a chart that updates every 2s is unreadable
 *  - band drawn as Area(lo) + Area(band) stack, which Recharts handles far better
 *    than a custom polygon
 */
export function DensityChart({
  points,
  forecast,
  thresholds,
  rangeMs,
  showForecast,
  showBands,
  height = 300,
}: {
  points: CountPoint[];
  forecast: Forecast | null;
  thresholds: Thresholds | undefined;
  rangeMs: number;
  showForecast: boolean;
  showBands: boolean;
  height?: number;
}) {
  const data = useMemo<Row[]>(() => {
    const now = Date.now();
    const from = now - rangeMs;
    const observed = downsampleLTTB(points.filter((p) => p.ts >= from), 400).map<Row>((p) => ({
      ts: p.ts,
      actual: p.total,
    }));

    if (!observed.length) return [];
    if (!showForecast || !forecast?.points.length) return observed;

    const bridge: Row = {
      ts: observed[observed.length - 1].ts,
      forecast: observed[observed.length - 1].actual,
      lo: undefined,
      band: undefined,
      hi: undefined,
    };
    const future: Row[] = forecast.points.map((p) => ({
      ts: p.ts,
      forecast: p.value,
      lo: p.lo,
      band: Math.max(0, p.hi - p.lo),
      hi: p.hi,
    }));
    return [...observed, bridge, ...future];
  }, [points, forecast, rangeMs, showForecast]);

  const now = Date.now();
  const yMax = useMemo(() => {
    const vals = data.map((d) => Math.max(d.actual ?? 0, d.hi ?? 0));
    return Math.max(10, ...(thresholds ? [thresholds.p90] : []), ...vals) * 1.12;
  }, [data, thresholds]);

  const primary = `rgb(${rgbTriple('--primary')})`;
  const violet = `rgb(${rgbTriple('--forecast')})`;
  const faint = `rgb(${rgbTriple('--faint')})`;
  const line = `rgb(${rgbTriple('--line')})`;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={line} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={fmtHM}
            stroke={faint}
            tick={{ fontSize: 10, fill: faint }}
            minTickGap={36}
            axisLine={{ stroke: line }}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.ceil(yMax)]}
            stroke={faint}
            tick={{ fontSize: 10, fill: faint }}
            axisLine={false}
            tickLine={false}
            width={44}
          />

          {/* Forecast horizon shading */}
          {showForecast && forecast && (
            <ReferenceArea x1={now} fill={violet} fillOpacity={0.05} strokeOpacity={0} />
          )}

          {showBands && (
            <>
              <Area dataKey="lo" stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
              <Area
                dataKey="band"
                stackId="band"
                stroke="none"
                fill={violet}
                fillOpacity={0.16}
                isAnimationActive={false}
                activeDot={false}
              />
            </>
          )}

          {/* Percentile context lines */}
          {thresholds && (
            <>
              <ReferenceLine
                y={thresholds.p90}
                stroke={`rgb(${rgbTriple('--critical')})`}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: `p90 · ${thresholds.p90}`, position: 'insideTopRight', fill: `rgb(${rgbTriple('--critical')})`, fontSize: 10 }}
              />
              <ReferenceLine
                y={thresholds.p75}
                stroke={`rgb(${rgbTriple('--high')})`}
                strokeDasharray="4 4"
                strokeOpacity={0.55}
                label={{ value: `p75 · ${thresholds.p75}`, position: 'insideBottomRight', fill: `rgb(${rgbTriple('--high')})`, fontSize: 10 }}
              />
            </>
          )}

          <ReferenceLine x={now} stroke={faint} strokeDasharray="2 3" label={{ value: 'now', position: 'top', fill: faint, fontSize: 10 }} />

          <Line
            type="monotone"
            dataKey="actual"
            stroke={primary}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
            name="Observed"
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke={violet}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
            name="Forecast"
          />

          <Tooltip content={<ChartTip />} cursor={{ stroke: line }} />

          {data.length > 240 && (
            <Brush
              dataKey="ts"
              height={18}
              travellerWidth={8}
              stroke={line}
              fill="rgb(var(--surface))"
              tickFormatter={fmtHM}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* Custom tooltip: keeps the units and the actual-vs-forecast distinction explicit. */
function ChartTip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload?.length || label === undefined) return null;
  const row = payload[0]?.payload as Row | undefined;
  if (!row) return null;
  const isFuture = row.forecast !== undefined && row.actual === undefined;

  return (
    <div className="rounded-lg border border-line bg-elevated/95 px-3 py-2 text-[11px] shadow-card backdrop-blur">
      <div className="font-mono text-faint">{new Date(label).toLocaleString('en-IN', { hour12: false })}</div>
      {row.actual !== undefined && (
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--primary))` }} />
          <span className="text-muted">Observed</span>
          <span className="ml-auto font-mono font-semibold text-ink">{fmtInt(row.actual)}</span>
        </div>
      )}
      {row.forecast !== undefined && !isFuture && <div className="mt-1 text-[10px] text-faint">forecast origin</div>}
      {row.forecast !== undefined && isFuture && (
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: `rgb(var(--forecast))` }} />
          <span className="text-muted">Forecast</span>
          <span className="ml-auto font-mono font-semibold text-forecast">{fmtInt(row.forecast)}</span>
        </div>
      )}
      {row.hi !== undefined && row.lo !== undefined && (
        <div className="mt-0.5 flex items-center gap-2 text-faint">
          <span>80% band</span>
          <span className="ml-auto font-mono">
            {fmtInt(row.lo)}–{fmtInt(row.hi)}
          </span>
        </div>
      )}
    </div>
  );
}
