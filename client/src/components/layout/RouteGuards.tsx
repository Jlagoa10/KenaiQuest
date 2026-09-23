import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

function FullPageLoader() {
  return (
    <div
      className="flex min-h-dvh items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Blocks anonymous access and remembers where the user was headed. */
export function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (!isAuthenticated) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/**
 * Admin-only areas. This is convenience routing, not the security boundary —
 * every /api/admin route independently enforces the role server side, so a user
 * who forces their way to /admin simply gets 403s and an empty screen.
 */
export function RequireAdmin() {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

/**
 * Keeps a signed-in user away from the login and signup screens.
 *
 * Signing in flips isAuthenticated before the login form can navigate, so this
 * guard is what actually performs the post-login redirect. It honours the path
 * RequireAuth remembered — that is how an invitation link opened while signed
 * out still reaches the invitation — and only ever an in-app path.
 */
export function RedirectIfAuthenticated() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageLoader />;
  if (isAuthenticated) {
    const from = (location.state as { from?: unknown } | null)?.from;
    const target =
      typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard';
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
