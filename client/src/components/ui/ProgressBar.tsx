interface ProgressBarProps {
  value: number;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, label, showValue = false, size = 'md' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 100);

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          {label && (
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--brand-accent)' }}>
              {Math.round(clamped)}%
            </span>
          )}
        </div>
      )}
      <div
        className={size === 'sm' ? 'h-1.5 w-full rounded-full' : 'h-2.5 w-full rounded-full'}
        style={{ backgroundColor: 'var(--bg-inset)' }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progresso'}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${clamped}%`, backgroundColor: 'var(--brand-accent)' }}
        />
      </div>
    </div>
  );
}
