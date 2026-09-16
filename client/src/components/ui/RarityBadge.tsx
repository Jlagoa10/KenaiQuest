import type { Rarity } from '@kenai/shared';
import { RARITY_LABELS, RARITY_TOKENS } from '@kenai/shared';

interface RarityBadgeProps {
  rarity?: Rarity;
  /** Renders the masked "Raridade: ???" state used while a goal is secret. */
  hidden?: boolean;
  size?: 'sm' | 'md';
}

export function RarityBadge({ rarity, hidden = false, size = 'md' }: RarityBadgeProps) {
  const color = hidden || !rarity ? 'var(--text-muted)' : `var(--${RARITY_TOKENS[rarity]})`;
  const label = hidden || !rarity ? '???' : RARITY_LABELS[rarity];

  return (
    <span
      className={
        size === 'sm'
          ? 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold'
          : 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold'
      }
      style={{ color, backgroundColor: 'var(--bg-muted)' }}
    >
      {/* A dot alone would encode meaning in colour only, so the label is always present. */}
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
