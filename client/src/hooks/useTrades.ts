import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tradeService from '../services/tradeService';

export const tradeKeys = {
  all: ['trades'] as const,
  sent: ['trades', 'sent'] as const,
  received: ['trades', 'received'] as const,
  history: ['trades', 'history'] as const,
};

export function useSentOffers() {
  return useQuery({ queryKey: tradeKeys.sent, queryFn: tradeService.listSentOffers });
}

export function useReceivedOffers() {
  return useQuery({ queryKey: tradeKeys.received, queryFn: tradeService.listReceivedOffers });
}

export function useTradeHistory() {
  return useQuery({ queryKey: tradeKeys.history, queryFn: tradeService.listTradeHistory });
}

/** Every trade mutation can move ownership, so the collection is invalidated too. */
function useTradeMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tradeKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['collectibles'] });
    },
  });
}

export function useCreateOffer() {
  return useTradeMutation<{
    offeredCollectibleId: string;
    requestedCollectibleId: string;
    message?: string;
  }>(tradeService.createOffer);
}

export function useAcceptOffer() {
  return useTradeMutation<string>(tradeService.acceptOffer);
}

export function useRejectOffer() {
  return useTradeMutation<string>(tradeService.rejectOffer);
}

export function useCancelOffer() {
  return useTradeMutation<string>(tradeService.cancelOffer);
}
