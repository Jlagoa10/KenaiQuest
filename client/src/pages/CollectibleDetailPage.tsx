import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Repeat2, Target } from 'lucide-react';
import {
  RARITY_LABELS,
  TRADE_ELIGIBILITY_PERCENT,
  buildPieceStates,
  formatIsoDatePtBr,
} from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { RarityBadge } from '../components/ui/RarityBadge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, LoadingRegion, Skeleton } from '../components/ui/Skeleton';
import { KenaiPuzzle } from '../components/puzzle/KenaiPuzzle';
import { useCollectible, useSetListing } from '../hooks/useCollectibles';
import { collectibleImageUrl } from '../services/collectibleService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';

export function CollectibleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { notify } = useToast();
  const { data: collectible, isLoading, isError, error, refetch } = useCollectible(id);
  const setListing = useSetListing();

  if (isLoading) {
    return (
      <LoadingRegion>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <CardSkeleton />
        </div>
      </LoadingRegion>
    );
  }

  if (isError || !collectible) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const isOwner = collectible.owner.id === user?.id;

  async function handleToggleListing() {
    if (!collectible) return;
    try {
      await setListing.mutateAsync({
        id: collectible.id,
        listed: !collectible.isListedForTrade,
      });
      notify(
        collectible.isListedForTrade
          ? 'Cópia removida das trocas.'
          : 'Cópia anunciada para troca.',
        'success',
      );
    } catch (mutationError) {
      notify(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Não foi possível atualizar a troca.',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/colecao"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para a coleção
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardBody>
            <KenaiPuzzle
              imageUrl={collectibleImageUrl(collectible.id, collectible.imageVersion)}
              totalPieces={collectible.totalPieces}
              aspectRatio={collectible.imageAspectRatio}
              pieces={buildPieceStates(collectible.totalPieces, {
                revealed: collectible.ownedPieceIndexes,
                fallback: 'MISSED',
              })}
              label={`${collectible.artwork.name}, ${collectible.piecesObtained} de ${collectible.totalPieces} peças`}
            />

            {collectible.piecesMissed > 0 && (
              <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                As {collectible.piecesMissed}{' '}
                {collectible.piecesMissed === 1 ? 'área vazia' : 'áreas vazias'} correspondem a
                dias não concluídos. Elas são permanentes nesta cópia.
              </p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="text-xl font-semibold sm:text-2xl">{collectible.artwork.name}</h1>
                <RarityBadge rarity={collectible.artwork.rarity} />
              </div>

              {collectible.artwork.description && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {collectible.artwork.description}
                </p>
              )}

              <div className="mt-5">
                <ProgressBar value={collectible.completionPercent} label="Completude" showValue />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {collectible.isPerfect && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' }}
                  >
                    <Award size={13} aria-hidden="true" />
                    Cópia perfeita
                  </span>
                )}
                {collectible.isTradeEligible ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--brand-primary)' }}
                  >
                    <Repeat2 size={13} aria-hidden="true" />
                    Elegível para troca
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-1 text-xs"
                    style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)' }}
                  >
                    Abaixo de {TRADE_ELIGIBILITY_PERCENT}% — não pode ser trocada
                  </span>
                )}
              </div>

              <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
                <Row label="Peças obtidas" value={`${collectible.piecesObtained} de ${collectible.totalPieces}`} />
                <Row label="Peças perdidas" value={String(collectible.piecesMissed)} />
                <Row label="Raridade" value={RARITY_LABELS[collectible.artwork.rarity]} />
                <Row label="Conquistado em" value={formatIsoDatePtBr(collectible.obtainedAt.slice(0, 10))} />
                <Row label="Meta de origem" value={collectible.goalTitle} />
                <Row label="Dono atual" value={collectible.owner.name} />
                {collectible.earnedByName !== collectible.owner.name && (
                  <Row label="Conquistado por" value={collectible.earnedByName} />
                )}
              </dl>
            </CardBody>
          </Card>

          {isOwner && (
            <Card>
              <CardBody className="space-y-3">
                <h2 className="text-sm font-semibold">Trocas</h2>
                {collectible.isTradeEligible ? (
                  <>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {collectible.isListedForTrade
                        ? 'Esta cópia está visível para outras pessoas proporem trocas.'
                        : 'Anuncie esta cópia para que outras pessoas possam propor trocas.'}
                    </p>
                    <Button
                      fullWidth
                      variant={collectible.isListedForTrade ? 'secondary' : 'primary'}
                      icon={<Repeat2 size={16} />}
                      isLoading={setListing.isPending}
                      onClick={handleToggleListing}
                    >
                      {collectible.isListedForTrade ? 'Remover das trocas' : 'Anunciar para troca'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Ainda faz parte da coleção, mas não pode ser trocada. Apenas cópias com{' '}
                    {TRADE_ELIGIBILITY_PERCENT}% ou mais são elegíveis.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {collectible.sourceGoalId && isOwner && (
            <Link to={`/metas/${collectible.sourceGoalId}`}>
              <Button variant="secondary" fullWidth icon={<Target size={16} />}>
                Ver meta de origem
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt style={{ color: 'var(--text-muted)' }}>{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  );
}
