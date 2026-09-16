import { useState } from 'react';
import { Search, ShieldCheck, User } from 'lucide-react';
import { USER_ROLE_LABELS, formatIsoDatePtBr } from '@kenai/shared';
import type { AdminUserDto } from '@kenai/shared';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingRegion, Skeleton } from '../../components/ui/Skeleton';
import { useAdminUsers, useUpdateUserRole } from '../../hooks/useAdmin';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ApiError } from '../../services/apiClient';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pendingChange, setPendingChange] = useState<AdminUserDto | null>(null);

  const { data, isLoading, isError, error, refetch } = useAdminUsers(page, search);
  const updateRole = useUpdateUserRole();

  async function handleConfirmRoleChange() {
    if (!pendingChange) return;
    const nextRole = pendingChange.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await updateRole.mutateAsync({ id: pendingChange.id, role: nextRole });
      notify(
        nextRole === 'ADMIN' ? 'Usuário promovido a administrador.' : 'Acesso administrativo removido.',
        'success',
      );
    } catch (roleError) {
      notify(
        roleError instanceof ApiError ? roleError.message : 'Não foi possível alterar o papel.',
        'error',
      );
    } finally {
      setPendingChange(null);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
        }}
        className="flex gap-2"
        role="search"
      >
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            aria-label="Buscar usuários"
            className="min-h-[44px] w-full rounded-xl border py-2.5 pl-9 pr-3.5 text-sm"
            style={{
              borderColor: 'var(--border-strong)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>

      {isLoading && (
        <LoadingRegion>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </LoadingRegion>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && data && (
        <>
          <div className="space-y-3">
            {data.users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <Card key={user.id}>
                  <CardBody className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'var(--bg-muted)', color: 'var(--brand-primary)' }}
                        aria-hidden="true"
                      >
                        {user.role === 'ADMIN' ? <ShieldCheck size={18} /> : <User size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {user.name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
                              (você)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {user.email}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {USER_ROLE_LABELS[user.role]} · desde{' '}
                          {formatIsoDatePtBr(user.createdAt.slice(0, 10))} · {user.goalsCount} metas ·{' '}
                          {user.collectiblesCount} cópias
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPendingChange(user)}
                      disabled={isSelf}
                      title={isSelf ? 'Você não pode alterar o seu próprio papel.' : undefined}
                    >
                      {user.role === 'ADMIN' ? 'Remover admin' : 'Tornar admin'}
                    </Button>
                  </CardBody>
                </Card>
              );
            })}
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Página {data.page} de {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={pendingChange !== null}
        onClose={() => setPendingChange(null)}
        title={
          pendingChange?.role === 'ADMIN'
            ? 'Remover acesso de administrador?'
            : 'Tornar administrador?'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingChange(null)}>
              Cancelar
            </Button>
            <Button isLoading={updateRole.isPending} onClick={handleConfirmRoleChange}>
              Confirmar
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {pendingChange?.role === 'ADMIN' ? (
            <>
              <strong>{pendingChange?.name}</strong> perderá acesso ao painel administrativo. O
              sistema sempre mantém pelo menos um administrador.
            </>
          ) : (
            <>
              <strong>{pendingChange?.name}</strong> poderá cadastrar artes, alterar regras de
              recompensa e gerenciar usuários.
            </>
          )}
        </p>
        <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          As sessões ativas dessa pessoa serão encerradas para que o novo papel tenha efeito
          imediato.
        </p>
      </Modal>
    </div>
  );
}
