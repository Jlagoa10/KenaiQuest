import type {
  CompetitionDetailDto,
  CompetitionInvitePreviewDto,
  CompetitionSummaryDto,
  CreateCompetitionInput,
} from '@kenai/shared';
import { api } from './apiClient.js';

export async function listCompetitions(): Promise<CompetitionSummaryDto[]> {
  const response = await api.get<{ competitions: CompetitionSummaryDto[] }>('/competitions');
  return response.competitions;
}

export async function getCompetition(id: string): Promise<CompetitionDetailDto> {
  const response = await api.get<{ competition: CompetitionDetailDto }>(`/competitions/${id}`);
  return response.competition;
}

export async function createCompetition(
  input: CreateCompetitionInput,
): Promise<CompetitionDetailDto> {
  const response = await api.post<{ competition: CompetitionDetailDto }>('/competitions', input);
  return response.competition;
}

export async function previewInvite(code: string): Promise<CompetitionInvitePreviewDto> {
  const response = await api.get<{ invite: CompetitionInvitePreviewDto }>(
    `/competitions/invite/${encodeURIComponent(code)}`,
  );
  return response.invite;
}

export async function joinCompetition(code: string): Promise<CompetitionDetailDto> {
  const response = await api.post<{ competition: CompetitionDetailDto }>('/competitions/join', {
    code,
  });
  return response.competition;
}

/** The shareable link. Opening it signs the person in first, then shows the invitation. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/competicoes/convite/${code}`;
}
