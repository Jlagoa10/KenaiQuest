import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trophy } from 'lucide-react';
import type { CreateCompetitionInput } from '@kenai/shared';
import {
  MAX_COMPETITION_DURATION_DAYS,
  MAX_COMPETITION_PARTICIPANTS,
  MIN_COMPETITION_DURATION_DAYS,
  addDays,
  compareIsoDates,
  competitionDurationDays,
  createCompetitionSchema,
  formatIsoDatePtBr,
  isIsoDate,
} from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { TextField } from '../components/ui/Field';
import { useCreateCompetition } from '../hooks/useCompetitions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';
import { todayForTimezone } from '../utils/dates';

export function NewCompetitionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();
  const createCompetition = useCreateCompetition();
  const [formError, setFormError] = useState<string | null>(null);

  // Joining closes at the start, so the earliest start is tomorrow.
  const tomorrow = addDays(todayForTimezone(user?.timezone ?? 'America/Sao_Paulo'), 1);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompetitionInput>({
    resolver: zodResolver(createCompetitionSchema),
    defaultValues: { startDate: tomorrow, endDate: addDays(tomorrow, 29) },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const durationDays =
    isIsoDate(startDate) && isIsoDate(endDate) && compareIsoDates(endDate, startDate) >= 0
      ? competitionDurationDays(startDate, endDate)
      : null;

  async function onSubmit(values: CreateCompetitionInput) {
    setFormError(null);
    try {
      const competition = await createCompetition.mutateAsync(values);
      notify('Competição criada! Agora é só convidar seus amigos.', 'success');
      navigate(`/competicoes/${competition.id}`);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar a competição. Tente novamente.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Nova competição</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Até {MAX_COMPETITION_PARTICIPANTS} participantes, incluindo você. Novas pessoas só podem
          entrar antes da data de início.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardBody className="space-y-5">
            <TextField
              label="Nome da competição"
              placeholder="Ex.: Desafio de outubro"
              error={errors.name?.message}
              {...register('name')}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Data de início"
                type="date"
                min={tomorrow}
                hint="A partir de amanhã."
                error={errors.startDate?.message}
                {...register('startDate')}
              />
              <TextField
                label="Data de término"
                type="date"
                min={isIsoDate(startDate) ? startDate : tomorrow}
                hint={`Entre ${MIN_COMPETITION_DURATION_DAYS} e ${MAX_COMPETITION_DURATION_DAYS} dias.`}
                error={errors.endDate?.message}
                {...register('endDate')}
              />
            </div>

            {durationDays !== null && (
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-muted)' }}
                aria-live="polite"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Trophy size={15} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
                  {formatIsoDatePtBr(startDate)} até {formatIsoDatePtBr(endDate)} · {durationDays}{' '}
                  {durationDays === 1 ? 'dia' : 'dias'}
                </p>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  A pontuação é a porcentagem de dias de meta concluídos nesse período, somando
                  todas as metas de cada participante. No final, o último lugar ganha um Kenai Comum
                  e cada posição acima sobe uma raridade: com 2 participantes o 1º ganha Incomum,
                  com 5 ganha Lendário. Empates recebem a mesma raridade.
                </p>
              </div>
            )}

            {formError && (
              <div
                className="rounded-xl px-3.5 py-3 text-sm"
                style={{ backgroundColor: 'var(--bg-muted)', color: '#d9534f' }}
                role="alert"
              >
                {formError}
              </div>
            )}
          </CardBody>

          <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:p-5">
            <Button type="button" variant="ghost" onClick={() => navigate('/competicoes')}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Criar competição
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
