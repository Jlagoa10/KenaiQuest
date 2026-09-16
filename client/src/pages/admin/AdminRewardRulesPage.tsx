import { useState } from 'react';
import { AlertTriangle, Plus, Scale, Trash2 } from 'lucide-react';
import type { Rarity, RewardRuleDto } from '@kenai/shared';
import {
  MAX_GOAL_DURATION_DAYS,
  MIN_GOAL_DURATION_DAYS,
  RARITIES,
  RARITY_LABELS,
} from '@kenai/shared';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { TextField } from '../../components/ui/Field';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../../components/ui/Skeleton';
import {
  useCreateRewardRule,
  useDeleteRewardRule,
  useRewardRules,
  useUpdateRewardRule,
} from '../../hooks/useAdmin';
import { useToast } from '../../contexts/ToastContext';
import { ApiError } from '../../services/apiClient';

type WeightDraft = Record<Rarity, string>;

const EMPTY_WEIGHTS: WeightDraft = {
  COMMON: '0',
  UNCOMMON: '0',
  RARE: '0',
  EPIC: '0',
  LEGENDARY: '0',
};

export function AdminRewardRulesPage() {
  const { notify } = useToast();
  const { data: rules, isLoading, isError, error, refetch } = useRewardRules();
  const createRule = useCreateRewardRule();
  const updateRule = useUpdateRewardRule();
  const deleteRule = useDeleteRewardRule();

  const [editing, setEditing] = useState<RewardRuleDto | null>(null);
  const [isCreating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<RewardRuleDto | null>(null);

  const [name, setName] = useState('');
  const [minDays, setMinDays] = useState('7');
  const [maxDays, setMaxDays] = useState('14');
  const [priority, setPriority] = useState('10');
  const [weights, setWeights] = useState<WeightDraft>(EMPTY_WEIGHTS);
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setName('');
    setMinDays('7');
    setMaxDays('14');
    setPriority('10');
    setWeights(EMPTY_WEIGHTS);
    setFormError(null);
    setCreating(true);
  }

  function openEdit(rule: RewardRuleDto) {
    setName(rule.name);
    setMinDays(String(rule.minDays));
    setMaxDays(String(rule.maxDays));
    setPriority(String(rule.priority));
    const draft = { ...EMPTY_WEIGHTS };
    for (const weight of rule.weights) draft[weight.rarity] = String(weight.weight);
    setWeights(draft);
    setFormError(null);
    setEditing(rule);
  }

  function buildWeightPayload() {
    return RARITIES.map((rarity) => ({
      rarity,
      weight: Number(weights[rarity]) || 0,
    })).filter((entry) => entry.weight > 0);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payloadWeights = buildWeightPayload();
    if (payloadWeights.length === 0) {
      setFormError('Defina pelo menos uma raridade com peso maior que zero.');
      return;
    }
    if (Number(minDays) > Number(maxDays)) {
      setFormError('O dia inicial deve ser menor ou igual ao dia final.');
      return;
    }

    try {
      if (editing) {
        await updateRule.mutateAsync({
          id: editing.id,
          input: {
            name,
            minDays: Number(minDays),
            maxDays: Number(maxDays),
            priority: Number(priority),
            weights: payloadWeights,
          },
        });
        notify('Regra atualizada.', 'success');
        setEditing(null);
      } else {
        await createRule.mutateAsync({
          name,
          minDays: Number(minDays),
          maxDays: Number(maxDays),
          priority: Number(priority),
          isActive: true,
          weights: payloadWeights,
        });
        notify('Regra criada.', 'success');
        setCreating(false);
      }
    } catch (submitError) {
      setFormError(
        submitError instanceof ApiError ? submitError.message : 'Não foi possível salvar a regra.',
      );
    }
  }

  async function handleToggleActive(rule: RewardRuleDto) {
    try {
      await updateRule.mutateAsync({ id: rule.id, input: { isActive: !rule.isActive } });
      notify(rule.isActive ? 'Regra desativada.' : 'Regra ativada.', 'success');
    } catch (toggleError) {
      notify(
        toggleError instanceof ApiError ? toggleError.message : 'Não foi possível atualizar.',
        'error',
      );
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteRule.mutateAsync(pendingDelete.id);
      notify('Regra excluída.', 'success');
    } catch (deleteError) {
      notify(
        deleteError instanceof ApiError ? deleteError.message : 'Não foi possível excluir.',
        'error',
      );
    } finally {
      setPendingDelete(null);
    }
  }

  const totalWeight = RARITIES.reduce((sum, rarity) => sum + (Number(weights[rarity]) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className="max-w-2xl rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--text-secondary)' }}
        >
          <strong className="font-semibold">Como os pesos funcionam:</strong> eles são relativos,
          não porcentagens. Os valores são normalizados entre si, então{' '}
          <em>65 / 30 / 5</em> e <em>13 / 6 / 1</em> produzem exatamente o mesmo resultado.
          Raridades sem nenhuma arte ativa são ignoradas no sorteio.
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Nova regra
        </Button>
      </div>

      {isLoading && (
        <LoadingRegion>
          <GridSkeleton count={3} />
        </LoadingRegion>
      )}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && rules?.length === 0 && (
        <EmptyState
          icon={<Scale size={24} />}
          title="Nenhuma regra cadastrada."
          description="Sem regras, as metas não conseguem sortear recompensas."
          action={<Button onClick={openCreate}>Nova regra</Button>}
        />
      )}

      {!isLoading && rules && rules.length > 0 && (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold">{rule.name}</h3>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Metas de {rule.minDays} a {rule.maxDays} dias · prioridade {rule.priority}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--bg-muted)',
                      color: rule.isActive ? 'var(--rarity-uncommon)' : 'var(--text-muted)',
                    }}
                  >
                    {rule.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </div>

                <ul className="space-y-2">
                  {rule.weights.map((weight) => (
                    <li key={weight.rarity} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 text-xs font-medium">
                        {RARITY_LABELS[weight.rarity]}
                      </span>
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full"
                        style={{ backgroundColor: 'var(--bg-inset)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${weight.normalisedPercent}%`,
                            backgroundColor: `var(--rarity-${weight.rarity.toLowerCase()})`,
                          }}
                        />
                      </div>
                      <span className="w-28 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        peso {weight.weight} · {weight.normalisedPercent}%
                      </span>
                      {weight.weight > 0 && weight.activeArtworks === 0 && (
                        <span
                          className="inline-flex shrink-0 items-center gap-1 text-[11px]"
                          style={{ color: '#d9534f' }}
                          title="Nenhuma arte ativa nesta raridade; ela será ignorada no sorteio."
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          sem arte
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(rule)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleToggleActive(rule)}>
                    {rule.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => setPendingDelete(rule)}
                  >
                    Excluir
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Editar regra' : 'Nova regra de recompensa'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Nome da regra"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            maxLength={80}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="De (dias)"
              type="number"
              min={MIN_GOAL_DURATION_DAYS}
              max={MAX_GOAL_DURATION_DAYS}
              value={minDays}
              onChange={(event) => setMinDays(event.target.value)}
              required
            />
            <TextField
              label="Até (dias)"
              type="number"
              min={MIN_GOAL_DURATION_DAYS}
              max={MAX_GOAL_DURATION_DAYS}
              value={maxDays}
              onChange={(event) => setMaxDays(event.target.value)}
              required
            />
          </div>

          <TextField
            label="Prioridade"
            type="number"
            min={0}
            max={1000}
            hint="Quando duas regras cobrem a mesma duração, a de maior prioridade vence."
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium">Pesos por raridade</legend>
            <div className="space-y-2">
              {RARITIES.map((rarity) => (
                <div key={rarity} className="flex items-center gap-3">
                  <label
                    htmlFor={`weight-${rarity}`}
                    className="w-24 shrink-0 text-sm"
                  >
                    {RARITY_LABELS[rarity]}
                  </label>
                  <input
                    id={`weight-${rarity}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={weights[rarity]}
                    onChange={(event) =>
                      setWeights((current) => ({ ...current, [rarity]: event.target.value }))
                    }
                    className="min-h-[40px] flex-1 rounded-xl border px-3 py-2 text-sm"
                    style={{
                      borderColor: 'var(--border-strong)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {totalWeight > 0
                      ? `${Math.round(((Number(weights[rarity]) || 0) / totalWeight) * 1000) / 10}%`
                      : '—'}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Total dos pesos: {totalWeight}. As porcentagens ao lado mostram a chance relativa
              resultante — não é necessário somar 100.
            </p>
          </fieldset>

          {formError && (
            <div
              className="rounded-xl px-3.5 py-3 text-sm"
              style={{ backgroundColor: 'var(--bg-muted)', color: '#d9534f' }}
              role="alert"
            >
              {formError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={createRule.isPending || updateRule.isPending}>
              {editing ? 'Salvar alterações' : 'Criar regra'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Excluir esta regra?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" isLoading={deleteRule.isPending} onClick={handleDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Metas com duração entre {pendingDelete?.minDays} e {pendingDelete?.maxDays} dias
          deixarão de usar esta configuração.
        </p>
      </Modal>
    </div>
  );
}
