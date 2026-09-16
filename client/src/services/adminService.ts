import type {
  AdminStatsDto,
  AdminUserDto,
  ArtworkDto,
  CreateRewardRuleInput,
  Rarity,
  RewardRuleDto,
  UpdateRewardRuleInput,
  UserRole,
} from '@kenai/shared';
import { api, apiRequest, apiUrl } from './apiClient.js';

export async function fetchStats(): Promise<AdminStatsDto> {
  const response = await api.get<{ stats: AdminStatsDto }>('/admin/stats');
  return response.stats;
}

export async function listArtworks(filters: {
  rarity?: Rarity | '';
  isActive?: string;
  search?: string;
} = {}): Promise<ArtworkDto[]> {
  const params = new URLSearchParams();
  if (filters.rarity) params.set('rarity', filters.rarity);
  if (filters.isActive) params.set('isActive', filters.isActive);
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();

  const response = await api.get<{ artworks: ArtworkDto[] }>(
    `/admin/artworks${query ? `?${query}` : ''}`,
  );
  return response.artworks;
}

/** Multipart upload: the browser sets the boundary, the client must not. */
export async function createArtwork(input: {
  name: string;
  description?: string;
  rarity: Rarity;
  isActive: boolean;
  file: File;
}): Promise<ArtworkDto> {
  const form = new FormData();
  form.append('name', input.name);
  if (input.description) form.append('description', input.description);
  form.append('rarity', input.rarity);
  form.append('isActive', String(input.isActive));
  form.append('file', input.file);

  const response = await apiRequest<{ artwork: ArtworkDto }>('/admin/artworks', {
    method: 'POST',
    body: form,
  });
  return response.artwork;
}

export async function updateArtwork(
  id: string,
  input: { name?: string; description?: string | null; rarity?: Rarity; isActive?: boolean },
): Promise<ArtworkDto> {
  const response = await api.patch<{ artwork: ArtworkDto }>(`/admin/artworks/${id}`, input);
  return response.artwork;
}

export async function deleteArtwork(id: string): Promise<void> {
  await api.delete<void>(`/admin/artworks/${id}`);
}

export function artworkPreviewUrl(id: string): string {
  return apiUrl(`/admin/artworks/${id}/preview.png`);
}

export async function listRewardRules(): Promise<RewardRuleDto[]> {
  const response = await api.get<{ rules: RewardRuleDto[] }>('/admin/reward-rules');
  return response.rules;
}

export async function createRewardRule(input: CreateRewardRuleInput): Promise<RewardRuleDto> {
  const response = await api.post<{ rule: RewardRuleDto }>('/admin/reward-rules', input);
  return response.rule;
}

export async function updateRewardRule(
  id: string,
  input: UpdateRewardRuleInput,
): Promise<RewardRuleDto> {
  const response = await api.patch<{ rule: RewardRuleDto }>(`/admin/reward-rules/${id}`, input);
  return response.rule;
}

export async function deleteRewardRule(id: string): Promise<void> {
  await api.delete<void>(`/admin/reward-rules/${id}`);
}

export async function previewChances(durationDays: number): Promise<{
  ruleName: string | null;
  chances: Array<{
    rarity: Rarity;
    weight: number;
    activeArtworks: number;
    normalisedPercent: number;
  }>;
}> {
  return api.get(`/admin/reward-rules/preview?durationDays=${durationDays}`);
}

export async function listUsers(params: { page?: number; search?: string } = {}): Promise<{
  users: AdminUserDto[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.search) query.set('search', params.search);
  const queryString = query.toString();

  return api.get(`/admin/users${queryString ? `?${queryString}` : ''}`);
}

export async function updateUserRole(id: string, role: UserRole): Promise<AdminUserDto> {
  const response = await api.patch<{ user: AdminUserDto }>(`/admin/users/${id}/role`, { role });
  return response.user;
}
