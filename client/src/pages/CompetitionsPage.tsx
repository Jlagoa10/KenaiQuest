import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Plus, Trophy } from 'lucide-react';
import type { CompetitionStatus } from '@kenai/shared';
import {
  COMPETITION_STATUS_LABELS,
  INVITE_CODE_LENGTH,
  MAX_COMPETITION_PARTICIPANTS,
  inviteCodeSchema,
} from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { TextField } from '../components/ui/Field';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { CompetitionCard } from '../components/competitions/CompetitionCard';
import { useCompetitions } from '../hooks/useCompetitions';
import { cn } from '../utils/cn';

const FILTERS: Array<{ value: CompetitionStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'UPCOMING', label: COMPETITION_STATUS_LABELS.UPCOMING },
  { value: 'ACTIVE', label: COMPETITION_STATUS_LABELS.ACTIVE },
  { value: 'FINISHED', label: COMPETITION_STATUS_LABELS.FINISHED },
];

function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | undefined>();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(`O código tem ${INVITE_CODE_LENGTH} letras e números.`);
      return;
    }
    setError(undefined);
    navigate(`/competicoes/convite/${parsed.data}`);
  }

  return (
    <Card>
      <CardBody>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <div className="flex-1">
            <TextField
              label="Recebeu um convite?"
              placeholder="Código de convite"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={INVITE_CODE_LENGTH + 4}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={error}
              className="font-mono uppercase tracking-widest"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            icon={<LogIn size={16} />}
            className="sm:mt-[26px]"
          >
            Ver convite
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export function CompetitionsPage() {
  const [filter, setFilter] = useState<CompetitionStatus | 'ALL'>('ALL');
  const { data: competitions, isLoading, isError, error, refetch } = useCompetitions();
  const visible =
    competitions?.filter((competition) => filter === 'ALL' || competition.status === filter) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Competições</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Dispute com até {MAX_COMPETITION_PARTICIPANTS} pessoas usando o progresso real das suas
            metas. Quem terminar na frente ganha um Kenai mais raro.
          </p>
        </div>
        <Link to="/competicoes/nova">
          <Button icon={<Plus size={16} />}>Nova competição</Button>
        </Link>
      </div>

      <JoinByCode />

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar competições por situação"
      >
        {FILTERS.map((option) => {
          const isActive = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={isActive}
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                isActive && 'font-semibold',
              )}
              style={{
                borderColor: isActive ? 'var(--brand-accent)' : 'var(--border-strong)',
                color: isActive ? 'var(--brand-accent)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--brand-accent-soft)' : 'transparent',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <LoadingRegion>
          <GridSkeleton count={3} />
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && visible.length === 0 && (
        <EmptyState
          icon={<Trophy size={24} />}
          title={filter === 'ALL' ? 'Nenhuma competição ainda.' : 'Nenhuma competição encontrada.'}
          description={
            filter === 'ALL'
              ? 'Crie uma competição e convide seus amigos, ou entre com um código de convite.'
              : 'Ajuste o filtro para ver suas outras competições.'
          }
          action={
            filter === 'ALL' ? (
              <Link to="/competicoes/nova">
                <Button icon={<Plus size={16} />}>Nova competição</Button>
              </Link>
            ) : undefined
          }
        />
      )}

      {!isLoading && !isError && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </div>
      )}
    </div>
  );
}
