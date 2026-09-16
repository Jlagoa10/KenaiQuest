import { Link } from 'react-router-dom';
import type { GoalDetailDto } from '@kenai/shared';
import {
  RARITY_LABELS,
  TRADE_ELIGIBILITY_PERCENT,
  buildPieceStates,
  isTradeEligible,
} from '@kenai/shared';
import { Award, Repeat2, Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RarityBadge } from '../ui/RarityBadge';
import { KenaiPuzzle } from '../puzzle/KenaiPuzzle';
import { goalImageUrl } from '../../services/goalService';

/**
 * The reveal moment.
 *
 * Shown once a goal ends: the artwork identity, the rarity, and exactly how
 * complete this copy turned out. Deliberately calm — a single accent, no
 * confetti.
 */
export function GoalRevealModal({
  isOpen,
  goal,
  onClose,
}: {
  isOpen: boolean;
  goal: GoalDetailDto;
  onClose: () => void;
}) {
  if (!goal.artwork) return null;

  const { progress } = goal;
  const completionPercent =
    goal.totalPieces > 0
      ? Math.round((progress.completedDays / goal.totalPieces) * 1000) / 10
      : 0;
  const tradable = isTradeEligible(progress.completedDays, goal.totalPieces);
  const isPerfect = progress.completedDays === goal.totalPieces;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Você desbloqueou um novo Kenai!"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {goal.collectibleId && (
            <Link to={`/colecao/${goal.collectibleId}`}>
              <Button>Ver na coleção</Button>
            </Link>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <KenaiPuzzle
          imageUrl={goalImageUrl(goal.id, goal.imageVersion)}
          totalPieces={goal.totalPieces}
          aspectRatio={goal.imageAspectRatio}
          pieces={buildPieceStates(goal.totalPieces, {
            revealed: goal.revealedPieceIndexes,
            missed: goal.missedPieceIndexes,
            fallback: 'MISSED',
          })}
          label={`${goal.artwork.name}, ${progress.completedDays} de ${goal.totalPieces} peças`}
        />

        <div className="text-center">
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold">
            <Sparkles size={18} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
            {goal.artwork.name}
          </h3>
          <div className="mt-2 flex justify-center">
            <RarityBadge rarity={goal.artwork.rarity} />
          </div>
          <p className="mt-3 text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
            {progress.completedDays} / {goal.totalPieces} peças — {completionPercent}%
          </p>
        </div>

        {isPerfect && (
          <p
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' }}
          >
            <Award size={16} aria-hidden="true" />
            Cópia perfeita
          </p>
        )}

        <p
          className="rounded-xl px-4 py-3 text-center text-sm"
          style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
        >
          {tradable ? (
            <span className="inline-flex items-center gap-2 font-medium">
              <Repeat2 size={15} aria-hidden="true" />
              Disponível para troca
            </span>
          ) : (
            <>
              Ainda faz parte da coleção, mas não pode ser trocada. Apenas cópias com{' '}
              {TRADE_ELIGIBILITY_PERCENT}% ou mais são elegíveis.
            </>
          )}
        </p>

        <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          Raridade {RARITY_LABELS[goal.artwork.rarity]} · Procure a estrela escondida na arte.
        </p>
      </div>
    </Modal>
  );
}
