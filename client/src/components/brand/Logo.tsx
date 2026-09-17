import { useState } from 'react';
import { cn } from '../../utils/cn';

/**
 * The four sizes the logo is allowed to take. Every screen picks one of these
 * instead of passing pixels, so the scale lives in a single place:
 *
 *   sm  footer
 *   md  top bars (public header, application header)
 *   lg  page marks (landing "how it works", 404)
 *   xl  the authentication screens
 *
 * The actual heights are the --logo-* tokens in theme.css, one place for the
 * whole scale.
 */
export type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  /**
   * 'primary' uses LogoSF.png (transparent background) — the default everywhere.
   * 'contained' uses LogoCF.png, for places that need a self-contained badge.
   */
  variant?: 'primary' | 'contained';
  className?: string;
  size?: LogoSize;
  withWordmark?: boolean;
}

/**
 * Official Kenai Quest logo.
 *
 * The asset is used exactly as supplied: no recolouring, no cropping, and
 * `width: auto` so the original aspect ratio is always preserved. Each size
 * also carries a max-width, so a wide file scales down on a phone rather than
 * pushing the header out of the viewport — still never distorted.
 *
 * If the file has not been added to client/public/brand yet, this falls back to
 * a typographic wordmark so the interface stays usable. Dropping the real PNG
 * into place makes it appear everywhere with no code change.
 */
export function Logo({
  variant = 'primary',
  className,
  size = 'md',
  withWordmark = false,
}: LogoProps) {
  const [failed, setFailed] = useState(false);
  const source = variant === 'contained' ? '/brand/LogoCF.png' : '/brand/LogoSF.png';

  if (failed) {
    return (
      <span
        className={cn(
          `kq-logo-${size} inline-flex items-baseline gap-1.5 font-semibold tracking-tight`,
          'kq-logo-fallback',
          className,
        )}
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
        className={cn('kq-logo', `kq-logo-${size}`)}
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
