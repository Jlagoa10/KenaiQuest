import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { ApiError } from '../../services/apiClient';

/**
 * Turns any thrown value into something a person can act on.
 * Raw backend text never reaches this component: the API already returns
 * user-facing Portuguese messages, and anything unrecognised falls back to a
 * generic sentence rather than leaking internals.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError
      ? error.message
      : 'Não foi possível carregar as informações. Verifique sua conexão e tente novamente.';

  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border px-6 py-10 text-center"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}
      role="alert"
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--bg-muted)', color: '#d9534f' }}
        aria-hidden="true"
      >
        <AlertTriangle size={22} />
      </div>
      <h3 className="text-base font-semibold">Algo deu errado</h3>
      <p className="mt-1.5 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
