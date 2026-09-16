import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import { ThemeToggle } from '../components/layout/ThemeToggle';

/*
 * The shell paints no background colour of its own: <body> already carries
 * --bg-app, and leaving this transparent is what lets the authentication
 * screens show the background photograph behind the header.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
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

      <main className="flex-1">
        <Outlet />
      </main>

      <footer
        className="border-t py-8"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <Logo height={28} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Transforme suas metas diárias em artes colecionáveis do Kenai.
          </p>
        </div>
      </footer>
    </div>
  );
}
