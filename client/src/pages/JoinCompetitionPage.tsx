import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, LogIn, Trophy, Users } from 'lucide-react';
import { formatIsoDatePtBr } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { CompetitionStatusBadge } from '../components/competitions/CompetitionStatusBadge';
import { ParticipantAvatar } from '../components/competitions/ParticipantAvatar';
import { useCompetitionInvite, useJoinCompetition } from '../hooks/useCompetitions';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';

/**
 * Where an invitation link lands. Signed-out visitors are sent to the login
 * screen first and brought back here afterwards (RequireAuth keeps the path).
 */
export function JoinCompetitionPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: invite, isLoading, isError, error, refetch } = useCompetitionInvite(code);
  const joinCompetition = useJoinCompetition();

  async function handleJoin() {
    if (!invite || !code) return;
    try {
      const competition = await joinCompetition.mutateAsync(code);
      notify('Você entrou na competição. Boa sorte!', 'success');
      navigate(`/competicoes/${competition.id}`, { replace: true });
    } catch (joinError) {
      notify(
        joinError instanceof ApiError
          ? joinError.message
          : 'Não foi possível entrar na competição.',
        'error',
      );
      void refetch();
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        to="/competicoes"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Competições
      </Link>

      {isLoading && (
        <LoadingRegion>
          <CardSkeleton />
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {invite && (
        <Card>
          <CardBody className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <div
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
                style={{
                  backgroundColor: 'var(--brand-accent-soft)',
                  color: 'var(--brand-accent)',
                }}
                aria-hidden="true"
              >
                <Trophy size={26} />
              </div>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {invite.creatorName
                  ? `${invite.creatorName} convidou você para`
                  : 'Você foi convidado para'}
              </p>
              <h1 className="mt-1 text-xl font-semibold sm:text-2xl">{invite.name}</h1>
              <div className="mt-2">
                <CompetitionStatusBadge status={invite.status} />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-muted)' }}>
                <dt
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <CalendarDays size={13} aria-hidden="true" />
                  Período
                </dt>
                <dd className="mt-1 font-medium">
                  {formatIsoDatePtBr(invite.startDate)} – {formatIsoDatePtBr(invite.endDate)}
                </dd>
                <dd className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {invite.durationDays} dias
                </dd>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-muted)' }}>
                <dt
                  className="flex items-center gap-1.5 text-xs"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Users size={13} aria-hidden="true" />
                  Participantes
                </dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {invite.participantCount} de {invite.maxParticipants}
                </dd>
              </div>
            </dl>

            <ul className="flex flex-wrap justify-center gap-2" aria-label="Quem já participa">
              {invite.participantNames.map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm"
                  style={{ backgroundColor: 'var(--bg-muted)' }}
                >
                  <ParticipantAvatar name={name} size="sm" />
                  {name}
                </li>
              ))}
            </ul>

            {invite.isParticipant ? (
              <Link to={`/competicoes/${invite.id}`} className="block">
                <Button fullWidth>Você já participa — abrir competição</Button>
              </Link>
            ) : invite.canJoin ? (
              <Button
                fullWidth
                size="lg"
                icon={<LogIn size={18} />}
                isLoading={joinCompetition.isPending}
                onClick={() => void handleJoin()}
              >
                Entrar na competição
              </Button>
            ) : (
              <p
                className="rounded-xl px-3.5 py-3 text-center text-sm"
                style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
                role="status"
              >
                {invite.joinBlockedReason ?? 'Não é possível entrar nesta competição.'}
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
