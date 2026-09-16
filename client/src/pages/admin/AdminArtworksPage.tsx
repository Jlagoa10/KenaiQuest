import { useState } from 'react';
import { Eye, EyeOff, Images, Plus, Trash2, Upload } from 'lucide-react';
import type { ArtworkDto, Rarity } from '@kenai/shared';
import {
  ALLOWED_ARTWORK_MIME_TYPES,
  MAX_ARTWORK_FILE_BYTES,
  RARITIES,
  RARITY_LABELS,
} from '@kenai/shared';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { SelectField, TextAreaField, TextField } from '../../components/ui/Field';
import { RarityBadge } from '../../components/ui/RarityBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { GridSkeleton, LoadingRegion } from '../../components/ui/Skeleton';
import {
  useAdminArtworks,
  useCreateArtwork,
  useDeleteArtwork,
  useUpdateArtwork,
} from '../../hooks/useAdmin';
import { artworkPreviewUrl } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import { ApiError } from '../../services/apiClient';

const MAX_MB = Math.round(MAX_ARTWORK_FILE_BYTES / 1024 / 1024);

export function AdminArtworksPage() {
  const { notify } = useToast();
  const { data: artworks, isLoading, isError, error, refetch } = useAdminArtworks();
  const createArtwork = useCreateArtwork();
  const updateArtwork = useUpdateArtwork();
  const deleteArtwork = useDeleteArtwork();

  const [isUploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ArtworkDto | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rarity, setRarity] = useState<Rarity>('COMMON');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function resetForm() {
    setName('');
    setDescription('');
    setRarity('COMMON');
    setFile(null);
    setUploadError(null);
  }

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setUploadError(null);

    if (!file) {
      setUploadError('Selecione um arquivo de imagem.');
      return;
    }
    // Mirrors the server limits so an oversized file fails instantly.
    if (file.size > MAX_ARTWORK_FILE_BYTES) {
      setUploadError(`Arquivo muito grande. O limite é ${MAX_MB} MB.`);
      return;
    }
    if (!(ALLOWED_ARTWORK_MIME_TYPES as readonly string[]).includes(file.type)) {
      setUploadError('Formato inválido. Envie uma imagem PNG, JPEG ou WebP.');
      return;
    }

    try {
      await createArtwork.mutateAsync({
        name,
        ...(description.trim() ? { description: description.trim() } : {}),
        rarity,
        isActive: true,
        file,
      });
      setUploadOpen(false);
      resetForm();
      notify('Arte cadastrada e já disponível para sorteio.', 'success');
    } catch (uploadException) {
      setUploadError(
        uploadException instanceof ApiError
          ? uploadException.message
          : 'Não foi possível enviar a arte.',
      );
    }
  }

  async function handleToggleActive(artwork: ArtworkDto) {
    try {
      await updateArtwork.mutateAsync({ id: artwork.id, input: { isActive: !artwork.isActive } });
      notify(artwork.isActive ? 'Arte desativada.' : 'Arte ativada.', 'success');
    } catch (toggleError) {
      notify(
        toggleError instanceof ApiError ? toggleError.message : 'Não foi possível atualizar a arte.',
        'error',
      );
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await deleteArtwork.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
      notify('Arte excluída.', 'success');
    } catch (deleteError) {
      notify(
        deleteError instanceof ApiError ? deleteError.message : 'Não foi possível excluir a arte.',
        'error',
      );
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Envie novas artes do Kenai sem precisar de deploy. Toda arte ativa entra
          automaticamente nos sorteios da sua raridade.
        </p>
        <Button icon={<Plus size={16} />} onClick={() => setUploadOpen(true)}>
          Adicionar imagem
        </Button>
      </div>

      {isLoading && (
        <LoadingRegion>
          <GridSkeleton />
        </LoadingRegion>
      )}
      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && artworks?.length === 0 && (
        <EmptyState
          icon={<Images size={24} />}
          title="Nenhuma arte cadastrada."
          description="Envie a primeira arte do Kenai para que as metas possam sortear recompensas."
          action={
            <Button icon={<Plus size={16} />} onClick={() => setUploadOpen(true)}>
              Adicionar imagem
            </Button>
          }
        />
      )}

      {!isLoading && artworks && artworks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {artworks.map((artwork) => (
            <Card key={artwork.id}>
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: `${artwork.width / artwork.height}`, backgroundColor: 'var(--bg-inset)' }}
              >
                <img
                  src={artworkPreviewUrl(artwork.id)}
                  alt={`Prévia de ${artwork.name}`}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
                {!artwork.isActive && (
                  <span
                    className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                  >
                    Inativa
                  </span>
                )}
              </div>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="min-w-0 truncate text-sm font-semibold">{artwork.name}</h3>
                  <RarityBadge rarity={artwork.rarity} size="sm" />
                </div>

                <dl className="space-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex justify-between">
                    <dt>Dimensões</dt>
                    <dd>{artwork.width} × {artwork.height}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cópias concedidas</dt>
                    <dd className="tabular-nums">{artwork.collectiblesAwarded}</dd>
                  </div>
                </dl>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    icon={artwork.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    onClick={() => handleToggleActive(artwork)}
                  >
                    {artwork.isActive ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 size={14} />}
                    onClick={() => setPendingDelete(artwork)}
                    aria-label={`Excluir ${artwork.name}`}
                    // Deleting an awarded artwork would orphan collectibles, so
                    // the server refuses it and the UI says so up front.
                    disabled={artwork.collectiblesAwarded > 0}
                    title={
                      artwork.collectiblesAwarded > 0
                        ? 'Esta arte já foi concedida. Desative-a em vez de excluir.'
                        : undefined
                    }
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
        isOpen={isUploadOpen}
        onClose={() => {
          setUploadOpen(false);
          resetForm();
        }}
        title="Adicionar arte do Kenai"
        description="A imagem é enviada para o armazenamento configurado e fica disponível imediatamente."
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <TextField
            label="Nome da arte"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Kenai na Praia"
            required
            minLength={2}
            maxLength={80}
          />

          <TextAreaField
            label="Descrição (opcional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
          />

          <SelectField
            label="Raridade"
            value={rarity}
            onChange={(event) => setRarity(event.target.value as Rarity)}
          >
            {RARITIES.map((value) => (
              <option key={value} value={value}>
                {RARITY_LABELS[value]}
              </option>
            ))}
          </SelectField>

          <div>
            <label htmlFor="artwork-file" className="mb-1.5 block text-sm font-medium">
              Arquivo de imagem
            </label>
            <input
              id="artwork-file"
              type="file"
              accept={ALLOWED_ARTWORK_MIME_TYPES.join(',')}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full rounded-xl border px-3.5 py-2.5 text-sm"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-surface)' }}
              required
            />
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              PNG, JPEG ou WebP, até {MAX_MB} MB. Lembre-se de incluir a estrela escondida.
            </p>
          </div>

          {uploadError && (
            <div
              className="rounded-xl px-3.5 py-3 text-sm"
              style={{ backgroundColor: 'var(--bg-muted)', color: '#d9534f' }}
              role="alert"
            >
              {uploadError}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setUploadOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" icon={<Upload size={16} />} isLoading={createArtwork.isPending}>
              Enviar arte
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Excluir esta arte?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="danger" isLoading={deleteArtwork.isPending} onClick={handleDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm">
          A arte <strong>{pendingDelete?.name}</strong> será removida do banco de dados e do
          armazenamento. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
