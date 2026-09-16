import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target } from 'lucide-react';
import type { CompletionTarget, GoalStatus, GoalSummaryDto } from '@kenai/shared';
import { GOAL_STATUS_LABELS, MAX_ACTIVE_GOALS } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { GoalCard } from '../components/goals/GoalCard';
import { CompleteDayModal } from '../components/goals/CompleteDayModal';
import { useCompleteGoalDay, useGoals } from '../hooks/useGoals';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';
import { cn } from '../utils/cn';

const FILTERS: Array<{ value: GoalStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'ACTIVE', label: GOAL_STATUS_LABELS.ACTIVE },
  { value: 'COMPLETED', label: GOAL_STATUS_LABELS.COMPLETED },
  { value: 'CANCELLED', label: GOAL_STATUS_LABELS.CANCELLED },
];

export function GoalsPage() {
  const [filter, setFilter] = useState<GoalStatus | 'ALL'>('ALL');
  const [selectedGoal, setSelectedGoal] = useState<GoalSummaryDto | null>(null);
  const { notify } = useToast();

  const { data: goals, isLoading, isError, error, refetch } = useGoals(
    filter === 'ALL' ? undefined : filter,
  );
  const completeDay = useCompleteGoalDay(selectedGoal?.id ?? '');

  const activeCount = goals?.filter((goal) => goal.status === 'ACTIVE').length ?? 0;

  async function handleConfirm(target: CompletionTarget) {
    if (!selectedGoal) return;
    try {
      await completeDay.mutateAsync(target);
      setSelectedGoal(null);
      notify('Dia concluído. Uma nova peça foi revelada.', 'success');
    } catch (mutationError) {
      notify(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Não foi possível registrar o dia.',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Metas</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Acompanhe suas metas ativas e o histórico das que já terminaram.
          </p>
        </div>
        <Link to="/metas/nova">
          <Button icon={<Plus size={16} />} disabled={activeCount >= MAX_ACTIVE_GOALS}>
            Nova meta
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar metas por situação">
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

      {!isLoading && !isError && goals && goals.length === 0 && (
        <EmptyState
          icon={<Target size={24} />}
          title="Nenhuma meta encontrada."
          description="Ajuste o filtro ou crie uma nova meta para começar."
          action={
            <Link to="/metas/nova">
              <Button icon={<Plus size={16} />}>Nova meta</Button>
            </Link>
          }
        />
      )}

      {!isLoading && !isError && goals && goals.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              {...(goal.status === 'ACTIVE' ? { onComplete: setSelectedGoal } : {})}
            />
          ))}
        </div>
      )}

      <CompleteDayModal
        goal={selectedGoal}
        isOpen={selectedGoal !== null}
        isSubmitting={completeDay.isPending}
        onClose={() => setSelectedGoal(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
