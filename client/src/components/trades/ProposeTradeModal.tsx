import { useState } from 'react';
import type { CollectibleDto } from '@kenai/shared';
import { RARITY_LABELS, TRADE_ELIGIBILITY_PERCENT } from '@kenai/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/Field';
import { cn } from '../../utils/cn';

/**
 * Choose which of your own eligible copies to offer for someone else's.
 * Only tradable copies are listed, which mirrors what the backend will accept.
 */
export function ProposeTradeModal({
  isOpen,
  target,
  myCollectibles,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  target: CollectibleDto | null;
  myCollectibles: CollectibleDto[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: { offeredCollectibleId: string; message?: string }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (!target) return null;

  const eligible = myCollectibles.filter(
    (item) => item.isTradeEligible && !item.hasPendingTrade,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Propor troca"
      description={`Você quer ${target.artwork.name} de ${target.owner.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            disabled={!selectedId}
            isLoading={isSubmitting}
            onClick={() =>
              selectedId &&
              onSubmit({
                offeredCollectibleId: selectedId,
                ...(message.trim() ? { message: message.trim() } : {}),
              })
            }
          >
            Enviar proposta
          </Button>
        </>
      }
    >
      {eligible.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Você ainda não tem cópias elegíveis para troca. Apenas cópias com{' '}
          {TRADE_ELIGIBILITY_PERCENT}% ou mais, e que não estejam em outra proposta, podem ser
          oferecidas.
        </p>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">O que você oferece?</legend>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {eligible.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors',
                  )}
                  style={{
                    borderColor:
                      selectedId === item.id ? 'var(--brand-accent)' : 'var(--border-strong)',
                    backgroundColor:
                      selectedId === item.id ? 'var(--brand-accent-soft)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="offered-collectible"
                    value={item.id}
                    checked={selectedId === item.id}
                    onChange={() => setSelectedId(item.id)}
                    className="h-4 w-4 shrink-0"
                    style={{ accentColor: 'var(--brand-accent)' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.artwork.name}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {RARITY_LABELS[item.artwork.rarity]} · {item.completionPercent}%
                      {item.isPerfect && ' · Cópia perfeita'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <TextAreaField
            label="Mensagem (opcional)"
            placeholder="Diga por que essa troca faz sentido."
            maxLength={280}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}
