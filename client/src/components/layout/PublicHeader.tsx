import { Link } from 'react-router-dom';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * The single top bar for every public screen — landing, login and sign-up all
 * render this one component, so there is no second, slightly different header
 * to keep in sync.
 *
 * Its surface is the translucent .kq-chrome, so the global background continues
 * behind it, with a hairline border and shadow marking the bar. It scrolls away
 * with the page — nothing here is fixed or sticky — and its height comes from
 * --topbar-height.
 */
export function PublicHeader() {
  return (
    <header className="kq-topbar kq-chrome">
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
