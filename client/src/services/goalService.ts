import type {
  CompletionTarget,
  CreateGoalInput,
  GoalDetailDto,
  GoalStatus,
  GoalSummaryDto,
} from '@kenai/shared';
import { api, apiUrl } from './apiClient.js';

export async function listGoals(status?: GoalStatus): Promise<GoalSummaryDto[]> {
  const query = status ? `?status=${status}` : '';
  const response = await api.get<{ goals: GoalSummaryDto[] }>(`/goals${query}`);
  return response.goals;
}

export async function getGoal(id: string): Promise<GoalDetailDto> {
  const response = await api.get<{ goal: GoalDetailDto }>(`/goals/${id}`);
  return response.goal;
}

export async function createGoal(input: CreateGoalInput): Promise<GoalSummaryDto> {
  const response = await api.post<{ goal: GoalSummaryDto }>('/goals', input);
  return response.goal;
}

export async function completeGoalDay(
  id: string,
  target: CompletionTarget,
): Promise<{ goal: GoalDetailDto; revealedPieceIndex: number }> {
  return api.post<{ goal: GoalDetailDto; revealedPieceIndex: number }>(`/goals/${id}/complete`, {
    target,
  });
}

export async function cancelGoal(id: string): Promise<void> {
  await api.delete<void>(`/goals/${id}`);
}

/**
 * URL of the server-composited artwork.
 *
 * The version token changes whenever a piece is unlocked, which busts the cache
 * without disabling it. The image itself contains only revealed regions — the
 * rest never leaves the server.
 */
export function goalImageUrl(goalId: string, version: string): string {
  return `${apiUrl(`/goals/${goalId}/image.png`)}?v=${version}`;
}
