import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { GoalSummaryDto } from '@kenai/shared';
import { buildPieceStates, formatIsoDatePtBr } from '@kenai/shared';
import { CalendarDays, CheckCircle2, CircleSlash } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Button } from '../ui/Button';
import { RarityBadge } from '../ui/RarityBadge';
import { KenaiPuzzle } from '../puzzle/KenaiPuzzle';
import { goalImageUrl } from '../../services/goalService';

interface GoalCardProps {
  goal: GoalSummaryDto;
  onComplete?: (goal: GoalSummaryDto) => void;
}

export function GoalCard({ goal, onComplete }: GoalCardProps) {
  const { progress } = goal;
  const canComplete = goal.canCompleteToday || goal.canCompleteYesterday;
  const isActive = goal.status === 'ACTIVE';

  // Unlocked pieces must actually show through, otherwise the overlay would
  // hide the artwork the server already composited. Anything still pending is
  // LOCKED while the goal runs and a permanent hole once it has ended.
  const pieces = useMemo(
    () =>
      buildPieceStates(goal.totalPieces, {
        revealed: goal.revealedPieceIndexes,
        missed: goal.missedPieceIndexes,
        fallback: isActive ? 'LOCKED' : 'MISSED',
      }),
    [goal.totalPieces, goal.revealedPieceIndexes, goal.missedPieceIndexes, isActive],
  );

  return (
    <Card interactive className="flex flex-col">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{goal.title}</h3>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Dia {progress.currentDay} de {progress.totalDays}
            </p>
          </div>
          {goal.artwork ? (
            <RarityBadge rarity={goal.artwork.rarity} size="sm" />
          ) : (
            <RarityBadge hidden size="sm" />
          )}
        </div>

        <KenaiPuzzle
          imageUrl={goalImageUrl(goal.id, goal.imageVersion)}
          totalPieces={goal.totalPieces}
          aspectRatio={goal.imageAspectRatio}
          pieces={pieces}
          label={
            goal.artwork
              ? `${goal.artwork.name}, ${progress.completedDays} de ${goal.totalPieces} peças`
              : `Imagem misteriosa, ${progress.completedDays} de ${goal.totalPieces} peças reveladas`
          }
          className="mb-4"
        />

        <ProgressBar value={progress.progressPercent} label="Progresso" showValue />

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="sr-only">Dias concluídos</dt>
            <dd className="flex flex-col items-center gap-1">
              <CheckCircle2 size={15} style={{ color: 'var(--rarity-uncommon)' }} aria-hidden="true" />
              <span className="text-sm font-semibold tabular-nums">{progress.completedDays}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Concluídos
              </span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Dias perdidos</dt>
            <dd className="flex flex-col items-center gap-1">
              <CircleSlash size={15} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <span className="text-sm font-semibold tabular-nums">{progress.missedDays}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Perdidos
              </span>
            </dd>
          </div>
          <div>
            <dt className="sr-only">Dias restantes</dt>
            <dd className="flex flex-col items-center gap-1">
              <CalendarDays size={15} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
              <span className="text-sm font-semibold tabular-nums">{progress.remainingDays}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Restantes
              </span>
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {formatIsoDatePtBr(goal.startDate)} até {formatIsoDatePtBr(goal.endDate)}
        </p>
      </div>

      <div className="mt-auto flex gap-2 border-t p-4 sm:p-5">
        {isActive && onComplete && (
          <Button
            className="flex-1"
            onClick={() => onComplete(goal)}
            disabled={!canComplete}
            title={canComplete ? undefined : 'Nenhum dia disponível para concluir agora.'}
          >
            Meta concluída
          </Button>
        )}
        <Link to={`/metas/${goal.id}`} className={isActive && onComplete ? '' : 'flex-1'}>
          <Button variant="secondary" fullWidth>
            Ver meta
          </Button>
        </Link>
      </div>
    </Card>
  );
}
