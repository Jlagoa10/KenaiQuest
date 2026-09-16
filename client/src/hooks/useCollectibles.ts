import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as collectibleService from '../services/collectibleService';
import type { CollectionFilters } from '../services/collectibleService';

export const collectibleKeys = {
  all: ['collectibles'] as const,
  list: (filters: CollectionFilters) => ['collectibles', 'list', filters] as const,
  detail: (id: string) => ['collectibles', 'detail', id] as const,
  available: (filters: CollectionFilters) => ['collectibles', 'available', filters] as const,
};

export function useCollection(filters: CollectionFilters = {}) {
  return useQuery({
    queryKey: collectibleKeys.list(filters),
    queryFn: () => collectibleService.listCollection(filters),
  });
}

export function useCollectible(id: string | undefined) {
  return useQuery({
    queryKey: collectibleKeys.detail(id ?? ''),
    queryFn: () => collectibleService.getCollectible(id as string),
    enabled: Boolean(id),
  });
}

export function useAvailableForTrade(filters: CollectionFilters = {}) {
  return useQuery({
    queryKey: collectibleKeys.available(filters),
    queryFn: () => collectibleService.listAvailableForTrade(filters),
  });
}

export function useSetListing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, listed }: { id: string; listed: boolean }) =>
      collectibleService.setListing(id, listed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectibleKeys.all });
    },
  });
}
