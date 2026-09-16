import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Target } from 'lucide-react';
import type { CompletionTarget, GoalSummaryDto } from '@kenai/shared';
import { MAX_ACTIVE_GOALS } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../components/ui/Skeleton';
import { GoalCard } from '../components/goals/GoalCard';
import { CompleteDayModal } from '../components/goals/CompleteDayModal';
import { useCompleteGoalDay, useGoals } from '../hooks/useGoals';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';

export function DashboardPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { data: goals, isLoading, isError, error, refetch } = useGoals('ACTIVE');
  const [selectedGoal, setSelectedGoal] = useState<GoalSummaryDto | null>(null);

  const completeDay = useCompleteGoalDay(selectedGoal?.id ?? '');

  const activeCount = goals?.length ?? 0;
  const hasReachedLimit = activeCount >= MAX_ACTIVE_GOALS;

  async function handleConfirm(target: CompletionTarget) {
    if (!selectedGoal) return;
    try {
      const result = await completeDay.mutateAsync(target);
      setSelectedGoal(null);
      notify(
        result.goal.status === 'COMPLETED'
          ? 'Meta encerrada! Confira a arte que você desbloqueou.'
          : 'Dia concluído. Uma nova peça foi revelada.',
        'success',
      );
    } catch (mutationError) {
      notify(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Não foi possível registrar o dia. Tente novamente.',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Olá, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {activeCount === 0
              ? 'Crie sua primeira meta e comece a revelar um Kenai.'
              : `Você tem ${activeCount} de ${MAX_ACTIVE_GOALS} metas ativas.`}
          </p>
        </div>

        {/* The limit is enforced on the server too; disabling here just avoids a
            pointless round trip and explains why. */}
        <Link to="/metas/nova" aria-disabled={hasReachedLimit} tabIndex={hasReachedLimit ? -1 : 0}>
          <Button
            icon={<Plus size={16} />}
            disabled={hasReachedLimit}
            title={
              hasReachedLimit ? `Você pode ter no máximo ${MAX_ACTIVE_GOALS} metas ativas.` : undefined
            }
          >
            Nova meta
          </Button>
        </Link>
      </div>

      {hasReachedLimit && (
        <p
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
          role="status"
        >
          Você pode ter no máximo {MAX_ACTIVE_GOALS} metas ativas. Conclua ou encerre uma meta
          para criar outra.
        </p>
      )}

      {isLoading && (
        <LoadingRegion>
          <GridSkeleton count={3} />
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && goals && goals.length === 0 && (
        <EmptyState
          icon={<Target size={24} />}
          title="Você ainda não possui metas ativas."
          description="Crie uma meta, defina quantos dias ela vai durar e comece a revelar sua arte misteriosa do Kenai."
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
            <GoalCard key={goal.id} goal={goal} onComplete={setSelectedGoal} />
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
