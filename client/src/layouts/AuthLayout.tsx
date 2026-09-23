import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';

/**
 * Shared chrome for the authentication screens (login and sign-up).
 *
 * The top bar is not its own: login and sign-up sit inside PublicLayout, so
 * they render the very same PublicHeader the landing page does. What this
 * layout owns is everything below that bar, in the intended order:
 *
 *   Kenai Quest logo → authentication card → form
 *
 * The photograph behind it is not this layout's either: it is the global
 * application background (body::before in theme.css), the same on every route.
 */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-[calc(100dvh-var(--topbar-height))] w-full flex-col justify-center px-5 py-12 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link to="/" aria-label="Kenai Quest, página inicial">
            <Logo size="xl" />
          </Link>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
