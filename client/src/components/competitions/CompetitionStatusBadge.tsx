import type { CompetitionStatus } from '@kenai/shared';
import { COMPETITION_STATUS_LABELS } from '@kenai/shared';

const STYLES: Record<CompetitionStatus, { color: string; background: string }> = {
  UPCOMING: { color: 'var(--brand-primary)', background: 'var(--bg-muted)' },
  ACTIVE: { color: 'var(--brand-accent)', background: 'var(--brand-accent-soft)' },
  FINISHED: { color: 'var(--text-muted)', background: 'var(--bg-muted)' },
};

export function CompetitionStatusBadge({ status }: { status: CompetitionStatus }) {
  const style = STYLES[status];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: style.color, backgroundColor: style.background }}
    >
      <span
        className={
          status === 'ACTIVE'
            ? 'inline-block h-1.5 w-1.5 animate-pulse rounded-full'
            : 'inline-block h-1.5 w-1.5 rounded-full'
        }
        style={{ backgroundColor: style.color }}
        aria-hidden="true"
      />
      {COMPETITION_STATUS_LABELS[status]}
    </span>
  );
}
