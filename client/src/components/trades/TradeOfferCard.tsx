import type { TradeOfferDto } from '@kenai/shared';
import { RARITY_LABELS, TRADE_OFFER_STATUS_LABELS } from '@kenai/shared';
import { ArrowRight, Award } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';

/**
 * A proposal, shown as "what you give" -> "what you get" from the current
 * viewer's perspective, so it is always obvious which copy is moving where.
 */
export function TradeOfferCard({
  offer,
  onAccept,
  onReject,
  onCancel,
  isBusy = false,
}: {
  offer: TradeOfferDto;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  isBusy?: boolean;
}) {
  // The offerer gives what they offered; the receiver gives what was requested.
  const youGive = offer.isOutgoing ? offer.offeredCollectible : offer.requestedCollectible;
  const youGet = offer.isOutgoing ? offer.requestedCollectible : offer.offeredCollectible;
  const counterpart = offer.isOutgoing ? offer.receiver : offer.offerer;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span style={{ color: 'var(--text-muted)' }}>
              {offer.isOutgoing ? 'Proposta enviada para' : 'Proposta recebida de'}
            </span>{' '}
            <span className="font-semibold">{counterpart.name}</span>
          </p>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              backgroundColor: 'var(--bg-muted)',
              color:
                offer.status === 'ACCEPTED'
                  ? 'var(--rarity-uncommon)'
                  : offer.status === 'PENDING'
                    ? 'var(--brand-accent)'
                    : 'var(--text-muted)',
            }}
          >
            {TRADE_OFFER_STATUS_LABELS[offer.status]}
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TradeSide label="Você entrega" item={youGive} />
          <ArrowRight
            size={18}
            style={{ color: 'var(--text-muted)' }}
            aria-label="em troca de"
          />
          <TradeSide label="Você recebe" item={youGet} />
        </div>

        {offer.message && (
          <p
            className="rounded-xl px-3.5 py-2.5 text-sm italic"
            style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          >
            “{offer.message}”
          </p>
        )}

        {(offer.canAccept || offer.canReject || offer.canCancel) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {offer.canAccept && onAccept && (
              <Button className="flex-1" isLoading={isBusy} onClick={() => onAccept(offer.id)}>
                Aceitar
              </Button>
            )}
            {offer.canReject && onReject && (
              <Button
                className="flex-1"
                variant="secondary"
                disabled={isBusy}
                onClick={() => onReject(offer.id)}
              >
                Recusar
              </Button>
            )}
            {offer.canCancel && onCancel && (
              <Button
                className="flex-1"
                variant="ghost"
                disabled={isBusy}
                onClick={() => onCancel(offer.id)}
              >
                Cancelar proposta
              </Button>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TradeSide({
  label,
  item,
}: {
  label: string;
  item: TradeOfferDto['offeredCollectible'];
}) {
  return (
    <div className="min-w-0 rounded-xl p-3" style={{ backgroundColor: 'var(--bg-muted)' }}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{item.artworkName}</p>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
        {RARITY_LABELS[item.rarity]} · {item.completionPercent}%
      </p>
      {item.isPerfect && (
        <p
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: 'var(--brand-accent)' }}
        >
          <Award size={11} aria-hidden="true" />
          Perfeita
        </p>
      )}
    </div>
  );
}
