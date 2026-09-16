export const TRADE_OFFER_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'SUPERSEDED',
] as const;

export type TradeOfferStatus = (typeof TRADE_OFFER_STATUSES)[number];

export const TRADE_OFFER_STATUS_LABELS: Record<TradeOfferStatus, string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
  CANCELLED: 'Cancelada',
  SUPERSEDED: 'Substituída',
};
