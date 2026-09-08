import clsx from 'clsx';

/** Labelled number. Monospaced value + unit so live updates never shift layout. */
export function Metric({
  label,
  value,
  unit,
  sub,
  tone,
  className,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: React.ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="truncate text-[11px] font-medium uppercase tracking-[0.06em] text-faint">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={clsx('metric-value', tone ?? 'text-ink')}>{value}</span>
        {unit && <span className="font-mono text-xs text-faint">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
