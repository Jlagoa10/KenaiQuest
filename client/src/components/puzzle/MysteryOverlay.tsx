import { Sparkles } from 'lucide-react';

/**
 * The "Imagem misteriosa" caption shown over an active goal's artwork.
 * Sits above the puzzle rather than inside it, so it never obscures pieces the
 * user has already earned.
 */
export function MysteryLabel({ revealed, total }: { revealed: number; total: number }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        <Sparkles size={15} style={{ color: 'var(--brand-accent)' }} aria-hidden="true" />
        Imagem misteriosa
      </span>
      <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {revealed} de {total} peças
      </span>
    </div>
  );
}
