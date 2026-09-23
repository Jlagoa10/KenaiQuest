import { cn } from '../../utils/cn';

/** Accounts have no profile picture, so the avatar is the person's initials. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function ParticipantAvatar({
  name,
  highlight = false,
  size = 'md',
}: {
  name: string;
  highlight?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-10 w-10 text-sm',
      )}
      style={{
        backgroundColor: highlight ? 'var(--brand-accent)' : 'var(--bg-muted)',
        color: highlight ? '#ffffff' : 'var(--brand-primary)',
        boxShadow: '0 0 0 2px var(--bg-surface)',
      }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}
