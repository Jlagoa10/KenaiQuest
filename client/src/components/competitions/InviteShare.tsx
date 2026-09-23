import { Copy, Link2, Share2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { inviteLink } from '../../services/competitionService';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function InviteShare({ code, name }: { code: string; name: string }) {
  const { notify } = useToast();
  const link = inviteLink(code);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function handleCopy(text: string, what: string) {
    const copied = await copyText(text);
    notify(
      copied ? `${what} copiado.` : 'Não foi possível copiar. Selecione e copie manualmente.',
      copied ? 'success' : 'error',
    );
  }

  async function handleShare() {
    try {
      await navigator.share({
        title: `Competição ${name} — Kenai Quest`,
        text: `Entre na minha competição no Kenai Quest com o código ${code}.`,
        url: link,
      });
    } catch {
      // Dismissing the share sheet is not an error worth reporting.
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="flex flex-col items-center gap-1 rounded-xl px-4 py-4 text-center"
        style={{ backgroundColor: 'var(--bg-muted)' }}
      >
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Código de convite
        </span>
        <span
          className="select-all font-mono text-2xl font-bold tracking-[0.25em]"
          style={{ color: 'var(--brand-primary)' }}
        >
          {code}
        </span>
      </div>
      <p className="break-all text-center text-xs" style={{ color: 'var(--text-muted)' }}>
        {link}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button fullWidth icon={<Link2 size={16} />} onClick={() => void handleCopy(link, 'Link')}>
          Copiar link
        </Button>
        <Button
          fullWidth
          variant="secondary"
          icon={<Copy size={16} />}
          onClick={() => void handleCopy(code, 'Código')}
        >
          Copiar código
        </Button>
        {canShare && (
          <Button
            fullWidth
            variant="secondary"
            icon={<Share2 size={16} />}
            onClick={() => void handleShare()}
          >
            Compartilhar
          </Button>
        )}
      </div>
    </div>
  );
}
