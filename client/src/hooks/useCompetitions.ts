import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCompetitionInput } from '@kenai/shared';
import * as competitionService from '../services/competitionService';

export const competitionKeys = {
  all: ['competitions'] as const,
  list: () => ['competitions', 'list'] as const,
  detail: (id: string) => ['competitions', 'detail', id] as const,
  invite: (code: string) => ['competitions', 'invite', code] as const,
};

/**
 * Other participants' progress changes without any action here, so a running
 * competition polls. Your own completions invalidate these queries directly
 * (see useCompleteGoalDay), so they show up immediately.
 */
const LIVE_REFRESH_MS = 30_000;

export function useCompetitions() {
  return useQuery({
    queryKey: competitionKeys.list(),
    queryFn: competitionService.listCompetitions,
    refetchInterval: (query) =>
      query.state.data?.some((competition) => competition.status === 'ACTIVE')
        ? LIVE_REFRESH_MS
        : false,
  });
}

export function useCompetition(id: string | undefined) {
  return useQuery({
    queryKey: competitionKeys.detail(id ?? ''),
    queryFn: () => competitionService.getCompetition(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data && query.state.data.status !== 'FINISHED' ? LIVE_REFRESH_MS : false,
  });
}

export function useCompetitionInvite(code: string | undefined) {
  return useQuery({
    queryKey: competitionKeys.invite(code ?? ''),
    queryFn: () => competitionService.previewInvite(code as string),
    enabled: Boolean(code),
    retry: false,
  });
}

export function useCreateCompetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCompetitionInput) => competitionService.createCompetition(input),
    onSuccess: (competition) => {
      queryClient.setQueryData(competitionKeys.detail(competition.id), competition);
      void queryClient.invalidateQueries({ queryKey: competitionKeys.list() });
    },
  });
}

export function useJoinCompetition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => competitionService.joinCompetition(code),
    onSuccess: (competition) => {
      queryClient.setQueryData(competitionKeys.detail(competition.id), competition);
      void queryClient.invalidateQueries({ queryKey: competitionKeys.all });
    },
  });
}
