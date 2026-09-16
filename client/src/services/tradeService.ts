import type { TradeOfferDto } from '@kenai/shared';
import { api } from './apiClient.js';

export async function listSentOffers(): Promise<TradeOfferDto[]> {
  const response = await api.get<{ offers: TradeOfferDto[] }>('/trades/offers/sent');
  return response.offers;
}

export async function listReceivedOffers(): Promise<TradeOfferDto[]> {
  const response = await api.get<{ offers: TradeOfferDto[] }>('/trades/offers/received');
  return response.offers;
}

export async function listTradeHistory(): Promise<TradeOfferDto[]> {
  const response = await api.get<{ offers: TradeOfferDto[] }>('/trades/offers/history');
  return response.offers;
}

export async function createOffer(input: {
  offeredCollectibleId: string;
  requestedCollectibleId: string;
  message?: string;
}): Promise<TradeOfferDto> {
  const response = await api.post<{ offer: TradeOfferDto }>('/trades/offers', input);
  return response.offer;
}

export async function acceptOffer(id: string): Promise<TradeOfferDto> {
  const response = await api.post<{ offer: TradeOfferDto }>(`/trades/offers/${id}/accept`);
  return response.offer;
}

export async function rejectOffer(id: string): Promise<TradeOfferDto> {
  const response = await api.post<{ offer: TradeOfferDto }>(`/trades/offers/${id}/reject`);
  return response.offer;
}

export async function cancelOffer(id: string): Promise<TradeOfferDto> {
  const response = await api.post<{ offer: TradeOfferDto }>(`/trades/offers/${id}/cancel`);
  return response.offer;
}
