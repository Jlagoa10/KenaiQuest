import type { CollectibleDetailDto, CollectibleDto, Rarity } from '@kenai/shared';
import { api, apiUrl } from './apiClient.js';

export interface CollectionFilters {
  rarity?: Rarity | '';
  perfectOnly?: boolean;
  tradableOnly?: boolean;
  listedOnly?: boolean;
  search?: string;
}

function toQueryString(filters: CollectionFilters): string {
  const params = new URLSearchParams();
  if (filters.rarity) params.set('rarity', filters.rarity);
  if (filters.perfectOnly) params.set('perfectOnly', 'true');
  if (filters.tradableOnly) params.set('tradableOnly', 'true');
  if (filters.listedOnly) params.set('listedOnly', 'true');
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function listCollection(filters: CollectionFilters = {}): Promise<CollectibleDto[]> {
  const response = await api.get<{ collectibles: CollectibleDto[] }>(
    `/collectibles${toQueryString(filters)}`,
  );
  return response.collectibles;
}

export async function getCollectible(id: string): Promise<CollectibleDetailDto> {
  const response = await api.get<{ collectible: CollectibleDetailDto }>(`/collectibles/${id}`);
  return response.collectible;
}

export async function setListing(id: string, listed: boolean): Promise<CollectibleDto> {
  const response = await api.patch<{ collectible: CollectibleDto }>(
    `/collectibles/${id}/listing`,
    { listed },
  );
  return response.collectible;
}

export async function listAvailableForTrade(
  filters: CollectionFilters = {},
): Promise<CollectibleDto[]> {
  const response = await api.get<{ collectibles: CollectibleDto[] }>(
    `/trades/available${toQueryString(filters)}`,
  );
  return response.collectibles;
}

export function collectibleImageUrl(collectibleId: string, version: string): string {
  return `${apiUrl(`/collectibles/${collectibleId}/image.png`)}?v=${version}`;
}
