import { Outlet } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';
import { PublicHeader } from '../components/layout/PublicHeader';

/*
 * The shell paints no background of its own: the global application
 * background (body::before in theme.css) sits behind every public screen, and
 * the header and footer are translucent chrome over it.
 *
 * The top bar is PublicHeader, rendered once here. Landing, login and sign-up
 * are all nested inside this layout, so every public screen gets exactly the
 * same header — same height, same surface, same spacing.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicHeader />

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="kq-chrome border-t py-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center sm:px-6">
          <Logo size="sm" />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Transforme suas metas diárias em artes colecionáveis do Kenai.
          </p>
        </div>
      </footer>
    </div>
  );
}
