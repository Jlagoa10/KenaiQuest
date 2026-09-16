import { useState } from 'react';
import { cn } from '../../utils/cn';

interface LogoProps {
  /**
   * 'primary' uses LogoSF.png (transparent background) — the default everywhere.
   * 'contained' uses LogoCF.png, for places that need a self-contained badge.
   */
  variant?: 'primary' | 'contained';
  className?: string;
  /** Height in pixels. Width follows the file's own aspect ratio. */
  height?: number;
  withWordmark?: boolean;
}

/**
 * Official Kenai Quest logo.
 *
 * The asset is used exactly as supplied: no recolouring, no cropping, and
 * `width: auto` so the original aspect ratio is always preserved.
 *
 * If the file has not been added to client/public/brand yet, this falls back to
 * a typographic wordmark so the interface stays usable. Dropping the real PNG
 * into place makes it appear everywhere with no code change.
 */
export function Logo({
  variant = 'primary',
  className,
  height = 36,
  withWordmark = false,
}: LogoProps) {
  const [failed, setFailed] = useState(false);
  const source = variant === 'contained' ? '/brand/LogoCF.png' : '/brand/LogoSF.png';

  if (failed) {
    return (
      <span
        className={cn('inline-flex items-baseline gap-1.5 font-semibold tracking-tight', className)}
        style={{ fontSize: height * 0.5 }}
      >
        <span style={{ color: 'var(--brand-primary)' }}>Kenai</span>
        <span style={{ color: 'var(--brand-accent)' }}>Quest</span>
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img
        src={source}
        alt="Kenai Quest"
        height={height}
        style={{ height, width: 'auto' }}
        onError={() => setFailed(true)}
        draggable={false}
      />
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight">
          <span style={{ color: 'var(--brand-primary)' }}>Kenai</span>{' '}
          <span style={{ color: 'var(--brand-accent)' }}>Quest</span>
        </span>
      )}
    </span>
  );
}
