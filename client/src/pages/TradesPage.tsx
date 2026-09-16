import { useState } from 'react';
import { Inbox, Repeat2, Send, History } from 'lucide-react';
import type { CollectibleDto, Rarity } from '@kenai/shared';
import { RARITIES, RARITY_LABELS } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { CollectibleCard } from '../components/collectibles/CollectibleCard';
import { TradeOfferCard } from '../components/trades/TradeOfferCard';
import { ProposeTradeModal } from '../components/trades/ProposeTradeModal';
import { useAvailableForTrade, useCollection } from '../hooks/useCollectibles';
import {
  useAcceptOffer,
  useCancelOffer,
  useCreateOffer,
  useReceivedOffers,
  useRejectOffer,
  useSentOffers,
  useTradeHistory,
} from '../hooks/useTrades';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';
import { cn } from '../utils/cn';

type Tab = 'available' | 'received' | 'sent' | 'history';

const TABS: Array<{ value: Tab; label: string; icon: typeof Repeat2 }> = [
  { value: 'available', label: 'Disponíveis', icon: Repeat2 },
  { value: 'received', label: 'Ofertas recebidas', icon: Inbox },
  { value: 'sent', label: 'Minhas ofertas', icon: Send },
  { value: 'history', label: 'Histórico', icon: History },
];

export function TradesPage() {
  const [tab, setTab] = useState<Tab>('available');
  const [rarity, setRarity] = useState<Rarity | ''>('');
  const [target, setTarget] = useState<CollectibleDto | null>(null);
  const { notify } = useToast();

  const available = useAvailableForTrade(rarity ? { rarity } : {});
  const received = useReceivedOffers();
  const sent = useSentOffers();
  const history = useTradeHistory();
  const myCollection = useCollection({ tradableOnly: true });

  const createOffer = useCreateOffer();
  const acceptOffer = useAcceptOffer();
  const rejectOffer = useRejectOffer();
  const cancelOffer = useCancelOffer();

  function handleError(error: unknown, fallback: string) {
    notify(error instanceof ApiError ? error.message : fallback, 'error');
  }

  async function handlePropose(input: { offeredCollectibleId: string; message?: string }) {
    if (!target) return;
    try {
      await createOffer.mutateAsync({ ...input, requestedCollectibleId: target.id });
      setTarget(null);
      notify('Proposta enviada. Agora é só aguardar a resposta.', 'success');
      setTab('sent');
    } catch (error) {
      handleError(error, 'Não foi possível enviar a proposta.');
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptOffer.mutateAsync(id);
      notify('Troca concluída! As duas cópias mudaram de dono.', 'success');
    } catch (error) {
      handleError(error, 'Não foi possível aceitar a proposta.');
    }
  }

  async function handleReject(id: string) {
    try {
      await rejectOffer.mutateAsync(id);
      notify('Proposta recusada.', 'info');
    } catch (error) {
      handleError(error, 'Não foi possível recusar a proposta.');
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelOffer.mutateAsync(id);
      notify('Proposta cancelada.', 'info');
    } catch (error) {
      handleError(error, 'Não foi possível cancelar a proposta.');
    }
  }

  const isBusy = acceptOffer.isPending || rejectOffer.isPending || cancelOffer.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Trocas</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Troque cópias com 90% ou mais por outras artes do Kenai. Arte por arte, sem moedas.
        </p>
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Seções de troca"
      >
        {TABS.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.value;
          const count =
            item.value === 'received'
              ? received.data?.length
              : item.value === 'sent'
                ? sent.data?.length
                : undefined;

          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.value)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm transition-colors',
                isActive && 'font-semibold',
              )}
              style={{
                borderColor: isActive ? 'var(--brand-accent)' : 'var(--border-subtle)',
                color: isActive ? 'var(--brand-accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--brand-accent-soft)' : 'var(--bg-surface)',
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
              {count !== undefined && count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ backgroundColor: 'var(--brand-accent)', color: '#fff' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'available' && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por raridade">
            <RarityChip label="Todas" active={!rarity} onClick={() => setRarity('')} />
            {RARITIES.map((value) => (
              <RarityChip
                key={value}
                label={RARITY_LABELS[value]}
                active={rarity === value}
                onClick={() => setRarity(rarity === value ? '' : value)}
              />
            ))}
          </div>

          {available.isLoading && (
            <LoadingRegion>
              <GridSkeleton />
            </LoadingRegion>
          )}
          {available.isError && (
            <ErrorState error={available.error} onRetry={() => void available.refetch()} />
          )}
          {!available.isLoading && !available.isError && available.data?.length === 0 && (
            <EmptyState
              icon={<Repeat2 size={24} />}
              title="Nenhuma troca disponível no momento."
              description="Quando outras pessoas anunciarem cópias, elas aparecerão aqui."
            />
          )}
          {!available.isLoading && available.data && available.data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {available.data.map((collectible) => (
                <CollectibleCard
                  key={collectible.id}
                  collectible={collectible}
                  footer={
                    <Button fullWidth onClick={() => setTarget(collectible)} icon={<Repeat2 size={16} />}>
                      Propor troca
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'received' && (
        <OfferList
          query={received}
          emptyTitle="Nenhuma proposta recebida."
          emptyDescription="Anuncie uma cópia na sua coleção para receber propostas."
          onAccept={handleAccept}
          onReject={handleReject}
          isBusy={isBusy}
        />
      )}

      {tab === 'sent' && (
        <OfferList
          query={sent}
          emptyTitle="Você não tem propostas em aberto."
          emptyDescription="Encontre uma arte em Disponíveis e proponha uma troca."
          onCancel={handleCancel}
          isBusy={isBusy}
        />
      )}

      {tab === 'history' && (
        <OfferList
          query={history}
          emptyTitle="Nenhuma troca no histórico."
          emptyDescription="Trocas aceitas, recusadas e canceladas aparecerão aqui."
          isBusy={isBusy}
        />
      )}

      <ProposeTradeModal
        isOpen={target !== null}
        target={target}
        myCollectibles={myCollection.data ?? []}
        isSubmitting={createOffer.isPending}
        onClose={() => setTarget(null)}
        onSubmit={handlePropose}
      />
    </div>
  );
}

function OfferList({
  query,
  emptyTitle,
  emptyDescription,
  onAccept,
  onReject,
  onCancel,
  isBusy,
}: {
  query: ReturnType<typeof useReceivedOffers>;
  emptyTitle: string;
  emptyDescription: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  isBusy: boolean;
}) {
  if (query.isLoading) {
    return (
      <LoadingRegion>
        <GridSkeleton count={2} />
      </LoadingRegion>
    );
  }

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }

  if (!query.data || query.data.length === 0) {
    return <EmptyState icon={<Inbox size={24} />} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {query.data.map((offer) => (
        <TradeOfferCard
          key={offer.id}
          offer={offer}
          isBusy={isBusy}
          {...(onAccept ? { onAccept } : {})}
          {...(onReject ? { onReject } : {})}
          {...(onCancel ? { onCancel } : {})}
        />
      ))}
    </div>
  );
}

function RarityChip({
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
      className={cn('rounded-full border px-3.5 py-1.5 text-sm transition-colors', active && 'font-semibold')}
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
