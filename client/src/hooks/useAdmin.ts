import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRewardRuleInput,
  Rarity,
  UpdateRewardRuleInput,
  UserRole,
} from '@kenai/shared';
import * as adminService from '../services/adminService';

export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  artworks: (filters: Record<string, string | undefined>) =>
    ['admin', 'artworks', filters] as const,
  rules: ['admin', 'rules'] as const,
  users: (page: number, search: string) => ['admin', 'users', page, search] as const,
};

export function useAdminStats() {
  return useQuery({ queryKey: adminKeys.stats, queryFn: adminService.fetchStats });
}

export function useAdminArtworks(filters: { rarity?: Rarity | ''; isActive?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.artworks(filters as Record<string, string | undefined>),
    queryFn: () => adminService.listArtworks(filters),
  });
}

export function useCreateArtwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminService.createArtwork,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useUpdateArtwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { name?: string; rarity?: Rarity; isActive?: boolean; description?: string | null };
    }) => adminService.updateArtwork(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useDeleteArtwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteArtwork(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useRewardRules() {
  return useQuery({ queryKey: adminKeys.rules, queryFn: adminService.listRewardRules });
}

export function useCreateRewardRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRewardRuleInput) => adminService.createRewardRule(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.rules });
    },
  });
}

export function useUpdateRewardRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRewardRuleInput }) =>
      adminService.updateRewardRule(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.rules });
    },
  });
}

export function useDeleteRewardRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deleteRewardRule(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys.rules });
    },
  });
}

export function useAdminUsers(page: number, search: string) {
  return useQuery({
    queryKey: adminKeys.users(page, search),
    queryFn: () => adminService.listUsers({ page, search }),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      adminService.updateUserRole(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
