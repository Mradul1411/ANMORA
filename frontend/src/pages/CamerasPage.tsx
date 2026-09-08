import { useState } from 'react';
import clsx from 'clsx';
import { Link2, Pause, Plus, Radar, Trash2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/common/Card';
import { LiveTile } from '@/components/dashboard/LiveTile';
import { fmtClock, fmtInt } from '@/lib/utils';
import { useLiveStore } from '@/store/liveStore';
import type { Camera } from '@/types/domain';

/**
 * Camera inventory + ROI configuration.
 *
 * The ROI polygon is the one piece of "setup" the project genuinely needs: it is what
 * turns a whole frame into a countable region. It's rendered here as normalised
 * coordinates (0..1) over a still frame, so the same numbers work at any resolution.
 */
export function CamerasPage() {
  const cameras = useLiveStore((s) => s.cameras);
  const runtimes = useLiveStore((s) => s.runtimes);
  const selectedId = useLiveStore((s) => s.selectedCameraId);
  const selectCamera = useLiveStore((s) => s.selectCamera);
  const [draft, setDraft] = useState<string>('');

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Cameras</h1>
          <p className="text-xs text-muted">Ingest sources, ROI masks and stream health. Frames are processed at 1–3 fps, not full video rate.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) {
              alert(`POST /api/cameras { "name": "${draft.trim()}", "stream": "rtsp" }\n\nWire this to FastAPI to persist.`);
              setDraft('');
            }
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="New camera name"
            aria-label="New camera name"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-primary"
          />
          <button className="btn btn-primary" type="submit">
            <Plus size={14} /> Add feed
          </button>
        </form>
      </header>

      {cameras.length === 0 ? (
        <EmptyState title="No feeds configured" hint="Add an RTSP URL or point the backend at a stored video file to begin." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {cameras.map((c) => (
            <CameraCard
              key={c.id}
              camera={c}
              runtime={runtimes[c.id]}
              active={c.id === selectedId}
              onSelect={() => selectCamera(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CameraCard({
  camera,
  runtime,
  active,
  onSelect,
}: {
  camera: Camera;
  runtime: ReturnType<typeof useLiveStore.getState>['runtimes'][string] | undefined;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <Card
      className={clsx(active && 'border-primary/50')}
      bodyClassName="p-0"
      action={
        <div className="flex gap-1">
          <IconBtn label="Pause stream">
            <Pause size={13} />
          </IconBtn>
          <IconBtn label="Test connection">
            <Link2 size={13} />
          </IconBtn>
          <IconBtn label="Remove camera">
            <Trash2 size={13} />
          </IconBtn>
        </div>
      }
    >
      <button onClick={onSelect} className="block w-full text-left">
        <LiveTile camera={camera} runtime={runtime as never} compact />
      </button>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="truncate text-sm font-semibold">{camera.name}</h3>
          <p className="truncate text-[11px] text-muted">{camera.location}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[11px]">
          <Row k="stream" v={camera.stream.toUpperCase()} />
          <Row k="proc fps" v={String(camera.fps)} />
          <Row k="url" v={camera.url} mono />
          <Row k="tracks" v={fmtInt(runtime?.trackCount ?? 0)} />
          <Row k="id swaps" v={fmtInt(runtime?.idSwitches ?? 0)} />
          <Row k="last tick" v={runtime?.lastTick ? fmtClock(runtime.lastTick) : '—'} />
        </dl>

        <div className="rounded-lg border border-line bg-bg p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-faint">ROI polygon</span>
            <span className="font-mono text-[10px] text-faint">{camera.roiPolygon.length} pts · normalised</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
            {camera.roiPolygon.map(([x, y], i) => (
              <span key={i} className="rounded bg-elevated px-1.5 py-0.5">
                {x.toFixed(2)},{y.toFixed(2)}
              </span>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-snug text-faint">
            <Radar size={11} className="mt-0.5 shrink-0" aria-hidden />
            Only pixels inside the polygon are counted — edit by clicking the frame in the pipeline
            config, not here.
          </p>
        </div>
      </div>
    </Card>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className={clsx('col-span-2 flex justify-between gap-2', mono && 'col-span-2')}>
      <dt className="shrink-0 text-faint">{k}</dt>
      <dd className="truncate text-right text-ink">{v}</dd>
    </div>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button className="rounded p-1 text-faint transition-colors hover:bg-elevated hover:text-ink" aria-label={label} title={label}>
      {children}
    </button>
  );
}
