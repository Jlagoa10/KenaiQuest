import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  notify: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* aria-live so screen readers announce results without stealing focus. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.variant];
          return (
            <div
              key={toast.id}
              className="kq-fade-up pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg"
              style={{
                backgroundColor: 'var(--bg-surface-raised)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-raised)',
              }}
            >
              <Icon
                size={20}
                className="mt-0.5 shrink-0"
                style={{
                  color:
                    toast.variant === 'success'
                      ? 'var(--rarity-uncommon)'
                      : toast.variant === 'error'
                        ? '#d9534f'
                        : 'var(--brand-primary)',
                }}
                aria-hidden="true"
              />
              <p className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded p-1 transition-colors hover:opacity-70"
                aria-label="Fechar aviso"
              >
                <X size={16} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider.');
  return context;
}
