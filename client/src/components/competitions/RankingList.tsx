import { Link } from 'react-router-dom';
import { Crown, Medal } from 'lucide-react';
import type { CompetitionRankingEntryDto } from '@kenai/shared';
import { RARITY_LABELS, RARITY_TOKENS } from '@kenai/shared';
import { ProgressBar } from '../ui/ProgressBar';
import { RarityBadge } from '../ui/RarityBadge';
import { ParticipantAvatar } from './ParticipantAvatar';

/** The position medallion, tinted with the rarity that position stands for. */
function PositionMark({ entry }: { entry: CompetitionRankingEntryDto }) {
  const color = entry.positionRarity
    ? `var(--${RARITY_TOKENS[entry.positionRarity]})`
    : 'var(--text-muted)';
  return (
    <span
      className="relative inline-flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold tabular-nums"
      style={{ color, backgroundColor: 'var(--bg-muted)', border: `1.5px solid ${color}` }}
      aria-label={`${entry.position}º lugar`}
    >
      {entry.position === 1 ? (
        <Crown size={12} aria-hidden="true" className="-mb-0.5" />
      ) : entry.position <= 3 ? (
        <Medal size={12} aria-hidden="true" className="-mb-0.5" />
      ) : null}
      {entry.position}º
    </span>
  );
}

function RewardCell({ entry, isFinal }: { entry: CompetitionRankingEntryDto; isFinal: boolean }) {
  if (!entry.rewardRarity) {
    const reason = entry.completedDays === 0 ? 'Nenhum dia concluído' : 'Sem prêmio';
    return (
      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {reason}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <RarityBadge rarity={entry.rewardRarity} size="sm" />
      {isFinal && entry.rewardStatus === 'PENDING' && (
        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Aguardando arte
        </span>
      )}
      {isFinal && entry.isMe && entry.collectibleId && (
        <Link
          to={`/colecao/${entry.collectibleId}`}
          className="text-[11px] font-semibold"
          style={{ color: 'var(--brand-accent)' }}
        >
          Ver na coleção
        </Link>
      )}
    </span>
  );
}

/**
 * One row per participant: position → person → score → Kenai.
 *
 * Tied participants share a position and are shown with the same number and
 * the same rarity. Every value comes from the server; nothing is computed here.
 */
export function RankingList({
  ranking,
  isFinal,
}: {
  ranking: CompetitionRankingEntryDto[];
  isFinal: boolean;
}) {
  return (
    <ol className="space-y-2" aria-label={isFinal ? 'Resultado final' : 'Ranking ao vivo'}>
      {ranking.map((entry) => {
        const rewardLabel = entry.rewardRarity
          ? `Kenai de raridade ${RARITY_LABELS[entry.rewardRarity]}`
          : 'sem prêmio';
        return (
          <li
            key={entry.userId}
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{
              borderColor: entry.isMe ? 'var(--brand-accent)' : 'var(--border-subtle)',
              backgroundColor: entry.isMe ? 'var(--brand-accent-soft)' : 'var(--bg-surface)',
            }}
            aria-label={`${entry.position}º lugar: ${entry.name}, ${entry.scorePercent}%, ${rewardLabel}`}
          >
            <PositionMark entry={entry} />
            <span className="hidden sm:inline-flex">
              <ParticipantAvatar name={entry.name} highlight={entry.isMe} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {entry.name}
                {entry.isMe && (
                  <span
                    className="ml-1.5 text-xs font-medium"
                    style={{ color: 'var(--brand-accent)' }}
                  >
                    (você)
                  </span>
                )}
              </p>
              <div className="mt-1.5">
                <ProgressBar value={entry.scorePercent} size="sm" />
              </div>
              <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {entry.completedDays} de {entry.scheduledDays} dias de meta concluídos
              </p>
            </div>
            <div className="flex w-20 shrink-0 flex-col items-end gap-1 text-right sm:w-24">
              <span
                className="text-base font-bold tabular-nums"
                style={{ color: 'var(--brand-primary)' }}
              >
                {entry.scorePercent}%
              </span>
              <RewardCell entry={entry} isFinal={isFinal} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
