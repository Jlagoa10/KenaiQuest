import { useState } from 'react';
import type { CompletionTarget, GoalSummaryDto } from '@kenai/shared';
import { COMPLETION_TARGET_LABELS } from '@kenai/shared';
import { CalendarCheck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface CompleteDayModalProps {
  goal: GoalSummaryDto | null;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (target: CompletionTarget) => void;
}

/**
 * "Você concluiu a meta de qual dia?"
 *
 * Only Hoje and Ontem are ever offered, and each is disabled unless the server
 * says that specific day is still claimable — so the UI cannot even propose a
 * day the backend would reject.
 */
export function CompleteDayModal({
  goal,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}: CompleteDayModalProps) {
  const [selected, setSelected] = useState<CompletionTarget>('today');

  if (!goal) return null;

  const options: Array<{ target: CompletionTarget; available: boolean }> = [
    { target: 'today', available: goal.canCompleteToday },
    { target: 'yesterday', available: goal.canCompleteYesterday },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Você concluiu a meta de qual dia?"
      description={goal.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(selected)}
            isLoading={isSubmitting}
            disabled={!options.find((option) => option.target === selected)?.available}
            icon={<CalendarCheck size={16} />}
          >
            Confirmar
          </Button>
        </>
      }
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">Escolha o dia concluído</legend>
        {options.map(({ target, available }) => (
          <label
            key={target}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors',
              !available && 'cursor-not-allowed opacity-50',
            )}
            style={{
              borderColor:
                selected === target && available ? 'var(--brand-accent)' : 'var(--border-strong)',
              backgroundColor:
                selected === target && available ? 'var(--brand-accent-soft)' : 'transparent',
            }}
          >
            <input
              type="radio"
              name="completion-target"
              value={target}
              checked={selected === target}
              disabled={!available}
              onChange={() => setSelected(target)}
              className="h-4 w-4 shrink-0"
              style={{ accentColor: 'var(--brand-accent)' }}
            />
            <span className="flex-1">
              <span className="block text-sm font-medium">
                {COMPLETION_TARGET_LABELS[target]}
              </span>
              {!available && (
                <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  Não disponível para esta meta
                </span>
              )}
            </span>
          </label>
        ))}
      </fieldset>

      <p className="mt-4 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Você pode marcar apenas hoje ou ontem. Depois disso, o dia é perdido e a peça
        correspondente fica permanentemente vazia nesta cópia.
      </p>
    </Modal>
  );
}
