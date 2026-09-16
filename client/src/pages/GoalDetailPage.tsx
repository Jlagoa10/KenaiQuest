import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, CircleSlash, Sparkles, Trash2 } from 'lucide-react';
import type { CompletionTarget } from '@kenai/shared';
import { RARITY_LABELS, buildPieceStates, formatIsoDatePtBr } from '@kenai/shared';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { ProgressBar } from '../components/ui/ProgressBar';
import { RarityBadge } from '../components/ui/RarityBadge';
import { ErrorState } from '../components/ui/ErrorState';
import { CardSkeleton, LoadingRegion, Skeleton } from '../components/ui/Skeleton';
import { KenaiPuzzle } from '../components/puzzle/KenaiPuzzle';
import { MysteryLabel } from '../components/puzzle/MysteryOverlay';
import { CompleteDayModal } from '../components/goals/CompleteDayModal';
import { GoalRevealModal } from '../components/goals/GoalRevealModal';
import { useCancelGoal, useCompleteGoalDay, useGoal } from '../hooks/useGoals';
import { goalImageUrl } from '../services/goalService';
import { useToast } from '../contexts/ToastContext';
import { ApiError } from '../services/apiClient';

export function GoalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: goal, isLoading, isError, error, refetch } = useGoal(id);
  const completeDay = useCompleteGoalDay(id ?? '');
  const cancelGoal = useCancelGoal();

  const [isCompleteOpen, setCompleteOpen] = useState(false);
  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [revealedPiece, setRevealedPiece] = useState<number | null>(null);
  const [showReveal, setShowReveal] = useState(false);

  if (isLoading) {
    return (
      <LoadingRegion>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <CardSkeleton />
        </div>
      </LoadingRegion>
    );
  }

  if (isError || !goal) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  const { progress } = goal;
  const isActive = goal.status === 'ACTIVE';
  const canComplete = goal.canCompleteToday || goal.canCompleteYesterday;
  const pieces = buildPieceStates(goal.totalPieces, {
    revealed: goal.revealedPieceIndexes,
    missed: goal.missedPieceIndexes,
    fallback: isActive ? 'LOCKED' : 'MISSED',
  });

  async function handleConfirm(target: CompletionTarget) {
    if (!goal) return;
    try {
      const result = await completeDay.mutateAsync(target);
      setCompleteOpen(false);
      setRevealedPiece(result.revealedPieceIndex);

      if (result.goal.status === 'COMPLETED') {
        // Completing the final day ends the goal, which is the reveal moment.
        setShowReveal(true);
      } else {
        notify('Dia concluído. Uma nova peça foi revelada.', 'success');
      }
    } catch (mutationError) {
      notify(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'Não foi possível registrar o dia.',
        'error',
      );
    }
  }

  async function handleDelete() {
    if (!goal) return;
    try {
      await cancelGoal.mutateAsync(goal.id);
      notify('Meta excluída. A recompensa misteriosa foi perdida.', 'info');
      navigate('/metas');
    } catch (mutationError) {
      notify(
        mutationError instanceof ApiError ? mutationError.message : 'Não foi possível excluir a meta.',
        'error',
      );
    }
  }

  return (
    <div className="space-y-6">
      <Link
        to="/metas"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para metas
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* The artwork is the protagonist of this page. */}
        <Card>
          <CardBody>
            {goal.artwork ? (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles size={15} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
                  {goal.artwork.name}
                </span>
                <RarityBadge rarity={goal.artwork.rarity} />
              </div>
            ) : (
              <div className="mb-3">
                <MysteryLabel revealed={progress.completedDays} total={goal.totalPieces} />
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Raridade: ???
                </p>
              </div>
            )}

            <KenaiPuzzle
              imageUrl={goalImageUrl(goal.id, goal.imageVersion)}
              totalPieces={goal.totalPieces}
              aspectRatio={goal.imageAspectRatio}
              pieces={pieces}
              highlightPieceIndex={revealedPiece}
              label={
                goal.artwork
                  ? `${goal.artwork.name}, ${progress.completedDays} de ${goal.totalPieces} peças`
                  : `Imagem misteriosa, ${progress.completedDays} de ${goal.totalPieces} peças reveladas`
              }
            />

            {isActive && (
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => setCompleteOpen(true)}
                  disabled={!canComplete}
                  title={canComplete ? undefined : 'Nenhum dia disponível para concluir agora.'}
                >
                  Meta concluída
                </Button>
                <Button
                  size="lg"
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Excluir
                </Button>
              </div>
            )}

            {isActive && !canComplete && (
              <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                Você já registrou os dias disponíveis. Volte amanhã para revelar a próxima peça.
              </p>
            )}

            {goal.status === 'COMPLETED' && goal.collectibleId && (
              <Link to={`/colecao/${goal.collectibleId}`} className="mt-5 block">
                <Button size="lg" fullWidth variant="secondary">
                  Ver na coleção
                </Button>
              </Link>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody>
              <h1 className="text-xl font-semibold sm:text-2xl">{goal.title}</h1>
              {goal.description && (
                <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {goal.description}
                </p>
              )}

              <p className="mt-4 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Dia {progress.currentDay} de {progress.totalDays}
              </p>
              <div className="mt-2">
                <ProgressBar value={progress.progressPercent} showValue label="Progresso" />
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3">
                <StatBlock
                  icon={<CheckCircle2 size={16} style={{ color: 'var(--rarity-uncommon)' }} />}
                  label="Dias concluídos"
                  value={progress.completedDays}
                />
                <StatBlock
                  icon={<CircleSlash size={16} style={{ color: 'var(--text-muted)' }} />}
                  label="Dias perdidos"
                  value={progress.missedDays}
                />
                <StatBlock
                  icon={<CalendarDays size={16} style={{ color: 'var(--brand-primary)' }} />}
                  label="Dias restantes"
                  value={progress.remainingDays}
                />
              </dl>

              <dl className="mt-5 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt style={{ color: 'var(--text-muted)' }}>Início</dt>
                  <dd className="font-medium">{formatIsoDatePtBr(goal.startDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: 'var(--text-muted)' }}>Encerramento</dt>
                  <dd className="font-medium">{formatIsoDatePtBr(goal.endDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt style={{ color: 'var(--text-muted)' }}>Total de peças</dt>
                  <dd className="font-medium tabular-nums">{goal.totalPieces}</dd>
                </div>
                {goal.artwork && (
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: 'var(--text-muted)' }}>Raridade</dt>
                    <dd className="font-medium">{RARITY_LABELS[goal.artwork.rarity]}</dd>
                  </div>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="text-sm font-semibold">Histórico de dias</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                Cada quadrado é um dia da meta, em ordem.
              </p>
              {/* A compact calendar-style strip: dense enough for 365 days. */}
              <ul className="mt-3 flex flex-wrap gap-1">
                {goal.days.map((day) => {
                  const background =
                    day.status === 'COMPLETED'
                      ? 'var(--brand-accent)'
                      : day.status === 'MISSED'
                        ? 'var(--piece-missed)'
                        : 'var(--piece-locked)';
                  return (
                    <li key={day.id}>
                      <span
                        className="block h-4 w-4 rounded-sm"
                        style={{
                          backgroundColor: background,
                          outline: day.claimable ? '1.5px solid var(--brand-primary)' : undefined,
                        }}
                        title={`Dia ${day.dayNumber} — ${formatIsoDatePtBr(day.date)} — ${
                          day.status === 'COMPLETED'
                            ? 'Concluído'
                            : day.status === 'MISSED'
                              ? 'Perdido'
                              : 'Pendente'
                        }`}
                      >
                        <span className="sr-only">
                          Dia {day.dayNumber}, {formatIsoDatePtBr(day.date)},{' '}
                          {day.status === 'COMPLETED'
                            ? 'concluído'
                            : day.status === 'MISSED'
                              ? 'perdido'
                              : 'pendente'}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>

              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <LegendItem color="var(--brand-accent)" label="Concluído" />
                <LegendItem color="var(--piece-missed)" label="Perdido" />
                <LegendItem color="var(--piece-locked)" label="Pendente" />
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      <CompleteDayModal
        goal={goal}
        isOpen={isCompleteOpen}
        isSubmitting={completeDay.isPending}
        onClose={() => setCompleteOpen(false)}
        onConfirm={handleConfirm}
      />

      <GoalRevealModal
        isOpen={showReveal}
        goal={goal}
        onClose={() => setShowReveal(false)}
      />

      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Excluir esta meta?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Manter meta
            </Button>
            <Button variant="danger" isLoading={cancelGoal.isPending} onClick={handleDelete}>
              Excluir mesmo assim
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed">
          Se você excluir esta meta, perderá permanentemente a recompensa misteriosa.
        </p>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          As {progress.completedDays} peças já reveladas não entrarão na sua coleção, e a arte
          sorteada será descartada. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-xl p-3 text-center"
      style={{ backgroundColor: 'var(--bg-muted)' }}
    >
      <span aria-hidden="true">{icon}</span>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      <dt className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
        {label}
      </dt>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-sm"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </li>
  );
}
