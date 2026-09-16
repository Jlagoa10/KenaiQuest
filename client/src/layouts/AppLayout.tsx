import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { DesktopNav, MobileNav } from '../components/layout/AppNav';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function AppLayout() {
  const { isAdmin, logout, user } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();

  async function handleLogout() {
    try {
      await logout();
      navigate('/entrar', { replace: true });
    } catch {
      notify('Não foi possível sair. Tente novamente.', 'error');
    }
  }

  return (
    <div className="min-h-dvh" style={{ backgroundColor: 'var(--bg-app)' }}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2"
        style={{ backgroundColor: 'var(--brand-accent)', color: '#fff' }}
      >
        Pular para o conteúdo
      </a>

      <header
        className="sticky top-0 z-30 border-b"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/dashboard" className="shrink-0" aria-label="Kenai Quest, ir para o dashboard">
            <Logo height={34} />
          </Link>

          <DesktopNav isAdmin={isAdmin} />

          <div className="flex shrink-0 items-center gap-2">
            <span
              className="hidden max-w-[12rem] truncate text-sm lg:block"
              style={{ color: 'var(--text-secondary)' }}
            >
              {user?.name}
            </span>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom padding clears the fixed mobile navigation bar. */}
      <main id="conteudo" className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12">
        <Outlet />
      </main>

      <MobileNav isAdmin={isAdmin} />
    </div>
  );
}
