import { CLASS_COLOR, CLASS_LABEL, fmtInt } from '@/lib/utils';
import type { CocoClass } from '@/types/domain';
import { COCO_CLASSES } from '@/types/domain';

/**
 * Per-class split (person / car / bus / truck / motorcycle).
 * This is the evidence that detection is class-aware, not just a headcount.
 */
export function ClassBreakdown({ byClass }: { byClass: Record<CocoClass, number> }) {
  const total = COCO_CLASSES.reduce((a, k) => a + (byClass[k] ?? 0), 0) || 1;

  return (
    <div className="space-y-3">
      {/* One stacked bar gives the ratio at a glance */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-pill bg-bg" role="img" aria-label="Class composition">
        {COCO_CLASSES.map((k) => (
          <span
            key={k}
            style={{ width: `${((byClass[k] ?? 0) / total) * 100}%`, background: CLASS_COLOR[k] }}
            title={`${CLASS_LABEL[k]}: ${byClass[k] ?? 0}`}
          />
        ))}
      </div>

      <ul className="space-y-2">
        {COCO_CLASSES.map((k) => {
          const v = byClass[k] ?? 0;
          const pct = (v / total) * 100;
          return (
            <li key={k} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: CLASS_COLOR[k] }} aria-hidden />
              <span className="w-24 shrink-0 truncate text-muted">{CLASS_LABEL[k]}</span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-bg">
                <span className="block h-full rounded-pill transition-[width] duration-500" style={{ width: `${pct}%`, background: CLASS_COLOR[k] }} />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-ink">{fmtInt(v)}</span>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] text-faint">{pct.toFixed(0)}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
