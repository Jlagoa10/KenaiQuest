import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import type { CollectibleDto } from '@kenai/shared';
import { buildPieceStates, formatIsoDatePtBr } from '@kenai/shared';
import { Award, Repeat2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { RarityBadge } from '../ui/RarityBadge';
import { ProgressBar } from '../ui/ProgressBar';
import { KenaiPuzzle } from '../puzzle/KenaiPuzzle';
import { collectibleImageUrl } from '../../services/collectibleService';

/**
 * One earned copy. Copies are never merged into an inventory count: two copies
 * of the same artwork render as two separate cards with their own completion.
 */
export function CollectibleCard({
  collectible,
  footer,
  href,
}: {
  collectible: CollectibleDto;
  footer?: React.ReactNode;
  href?: string;
}) {
  // A minted copy is final: anything outside the snapshot is a permanent hole.
  const pieces = useMemo(
    () =>
      buildPieceStates(collectible.totalPieces, {
        revealed: collectible.ownedPieceIndexes,
        fallback: 'MISSED',
      }),
    [collectible.totalPieces, collectible.ownedPieceIndexes],
  );

  const body = (
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{collectible.artwork.name}</h3>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>
            {collectible.goalTitle}
          </p>
        </div>
        <RarityBadge rarity={collectible.artwork.rarity} size="sm" />
      </div>

      <KenaiPuzzle
        imageUrl={collectibleImageUrl(collectible.id, collectible.imageVersion)}
        totalPieces={collectible.totalPieces}
        aspectRatio={collectible.imageAspectRatio}
        pieces={pieces}
        label={`${collectible.artwork.name}, ${collectible.piecesObtained} de ${collectible.totalPieces} peças`}
        className="mb-4"
      />

      <ProgressBar value={collectible.completionPercent} size="sm" />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">
          {collectible.piecesObtained} / {collectible.totalPieces}
          <span className="ml-1.5 font-normal" style={{ color: 'var(--text-muted)' }}>
            ({collectible.completionPercent}%)
          </span>
        </span>
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {formatIsoDatePtBr(collectible.obtainedAt.slice(0, 10))}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {collectible.isPerfect && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' }}
          >
            <Award size={12} aria-hidden="true" />
            Cópia perfeita
          </span>
        )}
        {collectible.isListedForTrade && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--brand-primary)' }}
          >
            <Repeat2 size={12} aria-hidden="true" />
            Disponível para troca
          </span>
        )}
        {!collectible.isTradeEligible && (
          <span
            className="rounded-full px-2 py-0.5 text-[11px]"
            style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)' }}
          >
            Não pode ser trocada
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Card interactive className="flex flex-col">
      {href ? <Link to={href}>{body}</Link> : body}
      {footer && <div className="mt-auto border-t p-4 sm:p-5">{footer}</div>}
    </Card>
  );
}
