import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Accessible dialog.
 *
 * Handles the three things a custom modal usually gets wrong: Escape closes it,
 * focus is trapped inside while it is open and restored to the trigger on close,
 * and the page behind cannot scroll. Rendered in a portal so it is never
 * clipped by an ancestor's overflow.
 *
 * On small screens it docks to the bottom as a sheet, which keeps the actions
 * within thumb reach.
 *
 * The effects below deliberately depend on `isOpen` alone. Callers pass `onClose`
 * as an inline arrow, so a fresh function arrives on every parent render — and a
 * form inside the dialog re-renders its parent on every keystroke. Had the
 * effects depended on that identity they would tear down and set up again per
 * character, moving focus out of the field being typed into. `onCloseRef` keeps
 * the handler current without tying the listeners to it.
 */
export function Modal({ isOpen, onClose, title, description, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const focusables = useCallback(
    () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute('disabled')),
    [],
  );

  // Opening and closing: scroll lock, the initial focus and handing focus back.
  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // The close button is first in the DOM, but landing on "Fechar" is not a
    // useful starting point — the first field is. The button stays reachable by
    // Tab, and is only used here when the dialog has nothing else to focus.
    const elements = focusables();
    const firstContentControl = elements.find((element) => element !== closeButtonRef.current);
    (firstContentControl ?? closeButtonRef.current ?? dialogRef.current)?.focus();

    return () => {
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [isOpen, focusables]);

  // Escape to close, Tab to cycle within the dialog.
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const elements = focusables();
      if (elements.length === 0) return;

      const first = elements[0] as HTMLElement;
      const last = elements[elements.length - 1] as HTMLElement;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, focusables]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kq-modal-title"
        aria-describedby={description ? 'kq-modal-description' : undefined}
        tabIndex={-1}
        className="kq-fade-up relative w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: 'var(--bg-surface-raised)',
          boxShadow: 'var(--shadow-raised)',
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id="kq-modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            {description && (
              <p
                id="kq-modal-description"
                className="mt-1 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-5">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
