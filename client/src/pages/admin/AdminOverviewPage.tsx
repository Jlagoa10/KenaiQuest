import { Images, Repeat2, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card';
import { ErrorState } from '../../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../../components/ui/Skeleton';
import { useAdminStats } from '../../hooks/useAdmin';

export function AdminOverviewPage() {
  const { data: stats, isLoading, isError, error, refetch } = useAdminStats();

  if (isLoading) {
    return (
      <LoadingRegion>
        <GridSkeleton count={6} />
      </LoadingRegion>
    );
  }

  if (isError || !stats) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const cards = [
    { icon: Users, label: 'Usuários', value: stats.users, hint: `${stats.admins} administradores` },
    {
      icon: Target,
      label: 'Metas ativas',
      value: stats.activeGoals,
      hint: `${stats.completedGoals} encerradas`,
    },
    {
      icon: Sparkles,
      label: 'Artes cadastradas',
      value: stats.artworks,
      hint: `${stats.activeArtworks} ativas para sorteio`,
    },
    { icon: Images, label: 'Colecionáveis', value: stats.collectibles, hint: 'cópias conquistadas' },
    {
      icon: Repeat2,
      label: 'Trocas pendentes',
      value: stats.pendingTrades,
      hint: `${stats.completedTrades} concluídas`,
    },
    {
      icon: ShieldCheck,
      label: 'Administradores',
      value: stats.admins,
      hint: 'com acesso ao painel',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label}>
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {card.label}
                  </p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{card.value}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {card.hint}
                  </p>
                </div>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--brand-primary)' }}
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
