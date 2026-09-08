import type { ReactNode } from 'react';

export function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cls(className)}>
      {(title || action) && (
        <header className="card-head">
          {title && <h2 className="card-title">{title}</h2>}
          {action}
        </header>
      )}
      <div className={bodyClassName ?? 'p-4'}>{children}</div>
    </section>
  );
}

function cls(s?: string) {
  return `card flex min-h-0 flex-col ${s ?? ''}`;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid-lines flex h-full min-h-[160px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line p-6 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      {hint && <p className="max-w-md text-xs text-faint">{hint}</p>}
    </div>
  );
}
