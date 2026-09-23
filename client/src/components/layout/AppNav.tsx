import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Images, Repeat2, User, ShieldCheck, Target, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/metas', label: 'Metas', icon: Target },
  { to: '/colecao', label: 'Coleção', icon: Images },
  { to: '/trocas', label: 'Trocas', icon: Repeat2 },
  { to: '/competicoes', label: 'Competições', icon: Trophy },
  { to: '/perfil', label: 'Perfil', icon: User },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

export function DesktopNav({ isAdmin }: { isAdmin: boolean }) {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
      {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'font-semibold' : 'hover:opacity-80',
            )
          }
          style={({ isActive }) => ({
            color: isActive ? 'var(--brand-accent)' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'var(--brand-accent-soft)' : 'transparent',
          })}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Mobile navigation: a fixed bottom bar, which keeps every destination in
 * thumb reach and avoids a hamburger menu that hides the product's main areas.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        // Keeps the bar clear of the iOS home indicator and, in landscape, the notch.
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      aria-label="Navegação principal"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium"
                style={({ isActive }) => ({
                  color: isActive ? 'var(--brand-accent)' : 'var(--text-muted)',
                })}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
