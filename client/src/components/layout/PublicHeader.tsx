import { Link } from 'react-router-dom';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from './ThemeToggle';

/**
 * The single top bar for every public screen — landing, login and sign-up all
 * render this one component, so there is no second, slightly different header
 * to keep in sync.
 *
 * It carries its own opaque surface (.kq-topbar) and its height comes from
 * --topbar-height, the same token the authentication screens use to start the
 * background photograph below the bar.
 */
export function PublicHeader() {
  return (
    <header className="kq-topbar">
      <div className="kq-topbar-inner mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="Kenai Quest, página inicial">
          <Logo height={34} />
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
