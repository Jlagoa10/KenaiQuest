import { cn } from '../../utils/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('kq-skeleton', className)} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="kq-surface p-4 sm:p-5">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-2 h-3 w-1/3" />
      <Skeleton className="mb-4 h-40 w-full" />
      <Skeleton className="h-2.5 w-full" />
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
}

/** Announced politely so a screen reader hears that content is loading. */
export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}
