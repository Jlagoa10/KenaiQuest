import { Link } from 'react-router-dom';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * The single top bar for every public screen — landing, login and sign-up all
 * render this one component, so there is no second, slightly different header
 * to keep in sync.
 *
 * It carries its own opaque surface (.kq-topbar), never a transparent one, so
 * the bar reads as chrome above the page rather than as part of whatever
 * photograph sits behind the content. It scrolls away with the page — nothing
 * here is fixed or sticky — and its height comes from --topbar-height.
 */
export function PublicHeader() {
  return (
    <header className="kq-topbar">
      <div className="kq-topbar-inner mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Kenai Quest, página inicial">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/entrar"
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ color: 'var(--brand-primary)' }}
          >
            Entrar
          </Link>
        </div>
      </div>
    </header>
  );
}
