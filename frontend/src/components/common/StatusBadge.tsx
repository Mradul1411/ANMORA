import clsx from 'clsx';
import { Activity, Gauge, Siren, TrendingUp, type LucideIcon } from 'lucide-react';
import type { DensityState } from '@/types/domain';
import { STATE_META } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = { gauge: Gauge, activity: Activity, trendingUp: TrendingUp, siren: Siren };

/**
 * The single most important element in the app: the Low / Medium / High / Critical
 * state. Colour is always paired with an icon and a word, so the meaning survives
 * greyscale printing, colour-vision deficiency, and a dim projector.
 */
export function StatusBadge({
  state,
  size = 'md',
  pulse = false,
  showBlurb = false,
}: {
  state: DensityState;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  showBlurb?: boolean;
}) {
  const meta = STATE_META[state];
  const Icon = ICONS[meta.icon];
  const isCritical = state === 'critical';

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span
        role="status"
        aria-label={`Density ${meta.label}`}
        className={clsx(
          'inline-flex w-fit items-center gap-1.5 rounded-pill border font-semibold uppercase tracking-wide',
          'border-current/30 bg-current/10',
          meta.token,
          size === 'sm' && 'px-2 py-0.5 text-[10px]',
          size === 'md' && 'px-2.5 py-1 text-[11px]',
          size === 'lg' && 'px-3 py-1.5 text-xs',
          (pulse || isCritical) && 'animate-pulse-critical',
        )}
        style={{ borderColor: `rgb(var(${meta.varName}) / 0.35)`, backgroundColor: `rgb(var(${meta.varName}) / 0.12)` }}
      >
        <Icon size={size === 'lg' ? 14 : 12} aria-hidden />
        {meta.label}
      </span>
      {showBlurb && <span className="text-[11px] text-faint">{meta.blurb}</span>}
    </span>
  );
}
