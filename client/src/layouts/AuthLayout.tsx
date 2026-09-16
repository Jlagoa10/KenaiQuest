import { Link, Outlet } from 'react-router-dom';
import { Logo } from '../components/brand/Logo';

/**
 * Shared chrome for the authentication screens (login and sign-up).
 *
 * It owns the official background photograph so neither page has to repeat it,
 * and lays the screen out in the intended order:
 *
 *   background.png → Kenai Quest logo → authentication card → form
 *
 * The photo layer is fixed to the viewport and sits behind every in-flow
 * element (`-z-10`), which is what keeps it covering the full screen on any
 * device without ever being stretched or scaled beyond `cover`.
 */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] w-full flex-col justify-center px-5 py-12 sm:px-6">
      {/* Decorative only: the photograph carries no information of its own. */}
      <div className="kq-photo-bg kq-photo-veil fixed inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto flex w-full max-w-md flex-col">
        <div className="mb-7 flex flex-col items-center text-center">
          <Link to="/" aria-label="Kenai Quest, página inicial">
            <Logo height={56} />
          </Link>
        </div>

        <Outlet />
      </div>
    </div>
  );
}
