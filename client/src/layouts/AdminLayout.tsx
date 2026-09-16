import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Images, Scale, Users } from 'lucide-react';
import { cn } from '../utils/cn';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Visão geral', icon: BarChart3, end: true },
  { to: '/admin/artes', label: 'Artes do Kenai', icon: Images, end: false },
  { to: '/admin/regras', label: 'Regras de recompensa', icon: Scale, end: false },
  { to: '/admin/usuarios', label: 'Usuários', icon: Users, end: false },
];

export function AdminLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Administração</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Gerencie artes, regras de recompensa e usuários do Kenai Quest.
        </p>
      </div>

      {/* Horizontally scrollable on narrow screens instead of wrapping into a
          cramped grid, so the admin area stays usable on a phone. */}
      <nav
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        aria-label="Navegação administrativa"
      >
        {ADMIN_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive && 'font-semibold',
                )
              }
              style={({ isActive }) => ({
                borderColor: isActive ? 'var(--brand-accent)' : 'var(--border-subtle)',
                color: isActive ? 'var(--brand-accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--brand-accent-soft)' : 'var(--bg-surface)',
              })}
            >
              <Icon size={16} aria-hidden="true" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
