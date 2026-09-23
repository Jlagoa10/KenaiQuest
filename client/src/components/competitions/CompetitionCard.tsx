import { Link } from 'react-router-dom';
import { CalendarDays, Users } from 'lucide-react';
import type { CompetitionSummaryDto } from '@kenai/shared';
import { formatIsoDatePtBr } from '@kenai/shared';
import { Card } from '../ui/Card';
import { RarityBadge } from '../ui/RarityBadge';
import { CompetitionStatusBadge } from './CompetitionStatusBadge';

export function CompetitionCard({ competition }: { competition: CompetitionSummaryDto }) {
  const hasStanding = competition.myPosition !== null;

  return (
    <Card interactive>
      <Link to={`/competicoes/${competition.id}`} className="block p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 truncate text-base font-semibold">{competition.name}</h3>
          <CompetitionStatusBadge status={competition.status} />
        </div>

        <div
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={13} aria-hidden="true" />
            {formatIsoDatePtBr(competition.startDate)} – {formatIsoDatePtBr(competition.endDate)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={13} aria-hidden="true" />
            {competition.participantCount}/{competition.maxParticipants} participantes
          </span>
        </div>

        <div
          className="mt-4 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3"
          style={{ backgroundColor: 'var(--bg-muted)' }}
        >
          {hasStanding ? (
            <>
              <div>
                <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {competition.status === 'FINISHED' ? 'Sua posição final' : 'Sua posição agora'}
                </p>
                <p
                  className="text-lg font-bold tabular-nums"
                  style={{ color: 'var(--brand-primary)' }}
                >
                  {competition.myPosition}º
                  <span
                    className="ml-2 text-sm font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {competition.myScorePercent}%
                  </span>
                </p>
              </div>
              {competition.myRewardRarity ? (
                <RarityBadge rarity={competition.myRewardRarity} size="sm" />
              ) : (
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Sem prêmio
                </span>
              )}
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              O ranking começa em {formatIsoDatePtBr(competition.startDate)}.
            </p>
          )}
        </div>
      </Link>
    </Card>
  );
}
