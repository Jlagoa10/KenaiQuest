import { useState } from 'react';
import { Images } from 'lucide-react';
import type { Rarity } from '@kenai/shared';
import { RARITIES, RARITY_LABELS } from '@kenai/shared';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { CollectibleCard } from '../components/collectibles/CollectibleCard';
import { useCollection } from '../hooks/useCollectibles';
import type { CollectionFilters } from '../services/collectibleService';
import { cn } from '../utils/cn';

export function CollectionPage() {
  const [filters, setFilters] = useState<CollectionFilters>({});
  const { data: collectibles, isLoading, isError, error, refetch } = useCollection(filters);

  const hasFilters = Object.values(filters).some(Boolean);

  function toggle(key: 'perfectOnly' | 'tradableOnly' | 'listedOnly') {
    setFilters((current) => ({ ...current, [key]: current[key] ? undefined : true }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Minha coleção</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Cada meta encerrada vira uma cópia única, com sua própria história.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por raridade">
          <FilterChip
            label="Todas"
            active={!filters.rarity}
            onClick={() => setFilters((current) => ({ ...current, rarity: undefined }))}
          />
          {RARITIES.map((rarity: Rarity) => (
            <FilterChip
              key={rarity}
              label={RARITY_LABELS[rarity]}
              active={filters.rarity === rarity}
              onClick={() =>
                setFilters((current) => ({
                  ...current,
                  rarity: current.rarity === rarity ? undefined : rarity,
                }))
              }
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Outros filtros">
          <FilterChip
            label="Cópias perfeitas"
            active={Boolean(filters.perfectOnly)}
            onClick={() => toggle('perfectOnly')}
          />
          <FilterChip
            label="Podem ser trocadas"
            active={Boolean(filters.tradableOnly)}
            onClick={() => toggle('tradableOnly')}
          />
          <FilterChip
            label="Anunciadas para troca"
            active={Boolean(filters.listedOnly)}
            onClick={() => toggle('listedOnly')}
          />
        </div>
      </div>

      {isLoading && (
        <LoadingRegion>
          <GridSkeleton />
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && collectibles && collectibles.length === 0 && (
        <EmptyState
          icon={<Images size={24} />}
          title={hasFilters ? 'Nenhuma cópia com esses filtros.' : 'Sua coleção ainda está vazia.'}
          description={
            hasFilters
              ? 'Tente remover alguns filtros para ver mais artes.'
              : 'Conclua uma meta para desbloquear sua primeira arte do Kenai.'
          }
        />
      )}

      {!isLoading && !isError && collectibles && collectibles.length > 0 && (
        <>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {collectibles.length} {collectibles.length === 1 ? 'cópia' : 'cópias'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collectibles.map((collectible) => (
              <CollectibleCard
                key={collectible.id}
                collectible={collectible}
                href={`/colecao/${collectible.id}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
        active && 'font-semibold',
      )}
      style={{
        borderColor: active ? 'var(--brand-accent)' : 'var(--border-strong)',
        color: active ? 'var(--brand-accent)' : 'var(--text-secondary)',
        backgroundColor: active ? 'var(--brand-accent-soft)' : 'transparent',
      }}
    >
      {label}
    </button>
  );
}
