import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Info, PartyPopper, Trophy, Users } from 'lucide-react';
import type { CompetitionDetailDto } from '@kenai/shared';
import {
  MAX_COMPETITION_PARTICIPANTS,
  MIN_PARTICIPANTS_FOR_REWARDS,
  RARITY_LABELS,
  compareIsoDates,
  formatIsoDatePtBr,
} from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { RarityBadge } from '../components/ui/RarityBadge';
import { CardSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { CompetitionStatusBadge } from '../components/competitions/CompetitionStatusBadge';
import { InviteShare } from '../components/competitions/InviteShare';
import { ParticipantAvatar } from '../components/competitions/ParticipantAvatar';
import { RankingList } from '../components/competitions/RankingList';
import { useCompetition } from '../hooks/useCompetitions';
import { useAuth } from '../contexts/AuthContext';
import { todayForTimezone } from '../utils/dates';

function ParticipantsCard({ competition }: { competition: CompetitionDetailDto }) {
  return (
    <Card>
      <CardHeader
        title="Participantes"
        description={`${competition.participantCount} de ${competition.maxParticipants}`}
      />
      <CardBody>
        <ul className="space-y-2.5">
          {competition.participants.map((participant) => (
            <li key={participant.userId} className="flex items-center gap-3">
              <ParticipantAvatar name={participant.name} highlight={participant.isMe} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {participant.name}
                {participant.isMe && (
                  <span className="ml-1.5 text-xs" style={{ color: 'var(--brand-accent)' }}>
                    (você)
                  </span>
                )}
              </span>
              {participant.isCreator && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--brand-primary)' }}
                >
                  Criador
                </span>
              )}
            </li>
          ))}
          {Array.from(
            {
              length: competition.acceptingParticipants
                ? MAX_COMPETITION_PARTICIPANTS - competition.participantCount
                : 0,
            },
            (_, index) => (
              <li key={`open-${index}`} className="flex items-center gap-3" aria-hidden="true">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed"
                  style={{ borderColor: 'var(--border-strong)' }}
                />
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Vaga aberta
                </span>
              </li>
            ),
          )}
        </ul>
      </CardBody>
    </Card>
  );
}

function MyResultBanner({ competition }: { competition: CompetitionDetailDto }) {
  const mine = competition.ranking.find((entry) => entry.isMe);
  if (!mine) return null;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
      style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'var(--brand-accent-soft)' }}
      role="status"
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--brand-accent)', color: '#ffffff' }}
        aria-hidden="true"
      >
        {mine.rewardRarity ? <PartyPopper size={26} /> : <Trophy size={26} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">
          Você terminou em {mine.position}º lugar com {mine.scorePercent}%.
        </p>
        <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {mine.rewardRarity
            ? mine.rewardStatus === 'AWARDED'
              ? `Seu prêmio, um Kenai de raridade ${RARITY_LABELS[mine.rewardRarity]}, já está na sua coleção.`
              : `Seu Kenai de raridade ${RARITY_LABELS[mine.rewardRarity]} está garantido e chega à sua coleção assim que houver uma arte dessa raridade disponível.`
            : mine.completedDays === 0
              ? 'Como nenhum dia de meta foi concluído no período, não houve prêmio desta vez.'
              : 'Esta competição não concedeu prêmios.'}
        </p>
      </div>
      {mine.rewardRarity && mine.collectibleId && (
        <Link to={`/colecao/${mine.collectibleId}`} className="shrink-0">
          <Button>Ver meu Kenai</Button>
        </Link>
      )}
    </div>
  );
}

export function CompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: competition, isLoading, isError, error, refetch } = useCompetition(id);

  if (isLoading) {
    return (
      <LoadingRegion>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </LoadingRegion>
    );
  }

  if (isError || !competition) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const today = todayForTimezone(user?.timezone ?? 'America/Sao_Paulo');
  const periodOver = compareIsoDates(today, competition.endDate) > 0;

  return (
    <div className="space-y-6">
      <Link
        to="/competicoes"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Competições
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold sm:text-3xl">{competition.name}</h1>
          <div
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={15} aria-hidden="true" />
              {formatIsoDatePtBr(competition.startDate)} – {formatIsoDatePtBr(competition.endDate)}{' '}
              · {competition.durationDays} dias
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} aria-hidden="true" />
              {competition.participantCount}/{competition.maxParticipants} participantes
            </span>
          </div>
        </div>
        <CompetitionStatusBadge status={competition.status} />
      </div>

      {competition.status === 'FINISHED' && <MyResultBanner competition={competition} />}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {competition.status === 'UPCOMING' && (
            <Card>
              <CardHeader
                title="Convide seus amigos"
                description={
                  competition.acceptingParticipants
                    ? `Entradas abertas até ${formatIsoDatePtBr(competition.startDate)}, quando a competição começa.`
                    : 'A competição está completa.'
                }
              />
              <CardBody>
                <InviteShare code={competition.inviteCode} name={competition.name} />
              </CardBody>
            </Card>
          )}

          {competition.status === 'UPCOMING' && (
            <Card>
              <CardBody className="flex items-center gap-3">
                <Trophy size={20} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  O ranking ao vivo começa em {formatIsoDatePtBr(competition.startDate)}.
                </p>
              </CardBody>
            </Card>
          )}

          {competition.status !== 'UPCOMING' && (
            <Card>
              <CardHeader
                title={competition.rankingIsFinal ? 'Resultado final' : 'Ranking ao vivo'}
                description={
                  competition.rankingIsFinal
                    ? 'Participante → posição → pontuação → Kenai conquistado. Este resultado não muda mais.'
                    : periodOver
                      ? `O período terminou. O último dia ainda pode ser marcado como "Ontem"; o resultado final sai em ${formatIsoDatePtBr(competition.resultsDate)}.`
                      : 'Atualizado a partir das suas metas. A raridade mostra o que cada posição vale agora.'
                }
              />
              <CardBody>
                <RankingList ranking={competition.ranking} isFinal={competition.rankingIsFinal} />
                {!competition.rewardsEnabled && (
                  <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Prêmios só são concedidos em competições com pelo menos{' '}
                    {MIN_PARTICIPANTS_FOR_REWARDS} participantes.
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <ParticipantsCard competition={competition} />

          <Card>
            <CardBody className="space-y-3 text-sm">
              <h2 className="flex items-center gap-2 font-semibold">
                <Info size={16} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                Como funciona
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                A pontuação é a porcentagem de dias de meta concluídos no período, somando todas as
                suas metas. Dias de hoje e de ontem ainda não marcados não contam contra você.
              </p>
              <ul className="space-y-1.5">
                {(['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'] as const).map(
                  (rarity, index) => (
                    <li key={rarity} className="flex items-center justify-between gap-2">
                      <span style={{ color: 'var(--text-secondary)' }}>{index + 1}º lugar</span>
                      <RarityBadge rarity={rarity} size="sm" />
                    </li>
                  ),
                )}
              </ul>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Empates dividem a mesma posição e recebem a mesma raridade. Quem não concluir nenhum
                dia não recebe prêmio.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
