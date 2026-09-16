import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompletionTarget, CreateGoalInput, GoalStatus } from '@kenai/shared';
import * as goalService from '../services/goalService';

export const goalKeys = {
  all: ['goals'] as const,
  list: (status?: GoalStatus) => ['goals', 'list', status ?? 'all'] as const,
  detail: (id: string) => ['goals', 'detail', id] as const,
};

export function useGoals(status?: GoalStatus) {
  return useQuery({
    queryKey: goalKeys.list(status),
    queryFn: () => goalService.listGoals(status),
  });
}

export function useGoal(id: string | undefined) {
  return useQuery({
    queryKey: goalKeys.detail(id ?? ''),
    queryFn: () => goalService.getGoal(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => goalService.createGoal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useCompleteGoalDay(goalId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target: CompletionTarget) => goalService.completeGoalDay(goalId, target),
    onSuccess: (result) => {
      // The response already carries the refreshed goal, so seed the cache with
      // it instead of triggering another round trip.
      queryClient.setQueryData(goalKeys.detail(goalId), result.goal);
      void queryClient.invalidateQueries({ queryKey: goalKeys.list() });
      // A finished goal mints a collectible, so the collection is stale too.
      void queryClient.invalidateQueries({ queryKey: ['collectibles'] });
    },
  });
}

export function useCancelGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => goalService.cancelGoal(goalId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}
