import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sparkles } from 'lucide-react';
import type { CreateGoalInput } from '@kenai/shared';
import {
  MAX_GOAL_DURATION_DAYS,
  MIN_GOAL_DURATION_DAYS,
  addDays,
  createGoalSchema,
  formatIsoDatePtBr,
} from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { TextAreaField, TextField } from '../components/ui/Field';
import { useCreateGoal } from '../hooks/useGoals';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';

/** Today in the user's own timezone, matching what the server will validate. */
function todayForUser(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const SUGGESTED_DURATIONS = [7, 21, 30, 60, 100, 365];

export function NewGoalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useToast();
  const createGoal = useCreateGoal();
  const [formError, setFormError] = useState<string | null>(null);

  const today = todayForUser(user?.timezone ?? 'America/Sao_Paulo');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues: { durationDays: 30, startDate: today },
  });

  const durationDays = Number(watch('durationDays')) || 0;
  const startDate = watch('startDate') || today;

  const isValidPreview =
    durationDays >= MIN_GOAL_DURATION_DAYS && durationDays <= MAX_GOAL_DURATION_DAYS;
  const endDate = isValidPreview ? addDays(startDate, durationDays - 1) : null;

  async function onSubmit(values: CreateGoalInput) {
    setFormError(null);
    try {
      const goal = await createGoal.mutateAsync(values);
      notify('Meta criada! Sua arte misteriosa já foi sorteada.', 'success');
      navigate(`/metas/${goal.id}`);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar a meta. Tente novamente.';
      setFormError(message);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Nova meta</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Uma arte do Kenai será sorteada em segredo e revelada peça por peça.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardBody className="space-y-5">
            <TextField
              label="Nome da meta"
              placeholder="Ex.: Correr 30 minutos"
              error={errors.title?.message}
              {...register('title')}
            />

            <TextAreaField
              label="Descrição (opcional)"
              placeholder="Detalhe o que conta como concluído."
              error={errors.description?.message}
              {...register('description')}
            />

            <div>
              <TextField
                label="Duração (dias)"
                type="number"
                inputMode="numeric"
                min={MIN_GOAL_DURATION_DAYS}
                max={MAX_GOAL_DURATION_DAYS}
                hint={`Qualquer valor entre ${MIN_GOAL_DURATION_DAYS} e ${MAX_GOAL_DURATION_DAYS} dias. A imagem terá exatamente uma peça por dia.`}
                error={errors.durationDays?.message}
                {...register('durationDays')}
              />
              {/* Shortcuts, not a restriction: any integer in range is allowed. */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {SUGGESTED_DURATIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setValue('durationDays', value, { shouldValidate: true })
                    }
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                    style={{
                      borderColor:
                        durationDays === value ? 'var(--brand-accent)' : 'var(--border-strong)',
                      color:
                        durationDays === value ? 'var(--brand-accent)' : 'var(--text-secondary)',
                      backgroundColor:
                        durationDays === value ? 'var(--brand-accent-soft)' : 'transparent',
                    }}
                  >
                    {value} dias
                  </button>
                ))}
              </div>
            </div>

            <TextField
              label="Data de início"
              type="date"
              min={today}
              hint="Pode começar hoje ou em uma data futura."
              error={errors.startDate?.message}
              {...register('startDate')}
            />

            {endDate && (
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-muted)' }}
                aria-live="polite"
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles size={15} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
                  Sua meta vai de {formatIsoDatePtBr(startDate)} até {formatIsoDatePtBr(endDate)}
                </p>
                <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  A imagem misteriosa será dividida em {durationDays} peças — uma para cada dia.
                  Metas mais longas têm chance de artes mais raras.
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
            <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Criar meta
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
