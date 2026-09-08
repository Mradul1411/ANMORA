import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { Maximize2, VideoOff } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { fmtClock } from '@/lib/utils';
import type { Camera } from '@/types/domain';
import type { useLiveStore } from '@/store/liveStore';

type Runtime = ReturnType<typeof useLiveStore.getState>['runtimes'][string];

/**
 * One camera tile.
 *
 * Two layers, deliberately separated:
 *  - <img>: the JPEG frame the pipeline drew boxes on (comes over the WebSocket as base64)
 *  - SVG overlay: ROI polygon + track count, drawn from vector metadata
 *
 * Keeping the overlay in SVG (not baked into the JPEG) means the ROI stays crisp at any
 * size and the same overlay code works in the ROI editor on the Cameras page.
 */
export function LiveTile({
  camera,
  runtime,
  compact = false,
  onOpen,
}: {
  camera: Camera;
  runtime: Runtime;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const [stale, setStale] = useState(false);

  // A frame older than 5s means the pipeline stalled — say so instead of lying.
  useEffect(() => {
    const id = window.setInterval(() => {
      const last = runtime.frameMeta?.ts ?? runtime.lastTick ?? 0;
      setStale(last > 0 && Date.now() - last > 5000);
    }, 1000);
    return () => window.clearInterval(id);
  }, [runtime.frameMeta?.ts, runtime.lastTick]);

  return (
    <div
      className={clsx(
        'group relative aspect-video w-full overflow-hidden rounded-card border bg-bg',
        runtime.state === 'critical' ? 'border-critical/70' : 'border-line',
      )}
    >
      {runtime.frame ? (
        <img
          src={runtime.frame}
          alt={`Annotated frame from ${camera.name}`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="grid-lines absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-1.5 text-faint">
            <VideoOff size={20} />
            <span className="text-[11px]">Waiting for frames…</span>
          </div>
        </div>
      )}

      {/* ROI polygon + scanline overlay */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polygon
          points={camera.roiPolygon.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
          fill="rgb(var(--primary) / 0.06)"
          stroke="rgb(var(--primary) / 0.85)"
          strokeWidth={0.4}
          vectorEffect="non-scaling-stroke"
          strokeDasharray="3 2"
        />
      </svg>

      {/* Top-left identity */}
      <div className="absolute left-2 top-2 flex items-center gap-2">
        <span className="rounded-pill bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {camera.name}
        </span>
        {stale && (
          <span className="rounded-pill bg-critical/85 px-2 py-0.5 text-[10px] font-semibold text-white">STALE</span>
        )}
      </div>

      {/* Top-right state */}
      <div className="absolute right-2 top-2">
        <StatusBadge state={runtime.state} size="sm" />
      </div>

      {/* Bottom telemetry strip */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-6 text-[10px] text-white/90">
        <span className="font-mono">
          <b className="text-sm font-semibold">{runtime.latestTotal}</b> objs
        </span>
        <span className="font-mono opacity-80">{runtime.trackCount} tracks</span>
        <span className="font-mono opacity-80">{runtime.fps.toFixed(1)} fps</span>
        <span className="font-mono opacity-80">{runtime.lastTick ? fmtClock(runtime.lastTick) : '--:--:--'}</span>
        {onOpen && !compact && (
          <button
            onClick={onOpen}
            aria-label={`Open detail for ${camera.name}`}
            className="rounded-md bg-white/10 p-1 opacity-0 transition-opacity hover:bg-white/20 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Maximize2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
