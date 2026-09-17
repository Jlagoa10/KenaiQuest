import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const SIZES: Record<Size, string> = {
  // min-height keeps every control comfortably tappable on a phone.
  sm: 'text-sm px-3 py-2 min-h-[38px] gap-1.5',
  md: 'text-sm px-4 py-2.5 min-h-[44px] gap-2',
  lg: 'text-base px-6 py-3 min-h-[52px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    icon,
    fullWidth = false,
    className,
    children,
    disabled,
    // HTML defaults a button inside a form to "submit"; most of ours are plain
    // actions, so the safe default is "button". A form's submit button says
    // type="submit" explicitly, and "reset" is still available the same way.
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || isLoading;

  // Orange carries the primary call to action; blue carries structure.
  const variantStyle: Record<Variant, React.CSSProperties> = {
    primary: { backgroundColor: 'var(--brand-accent)', color: '#ffffff' },
    secondary: {
      backgroundColor: 'transparent',
      color: 'var(--brand-primary)',
      borderColor: 'var(--border-strong)',
    },
    ghost: { backgroundColor: 'transparent', color: 'var(--text-secondary)' },
    danger: { backgroundColor: 'transparent', color: '#d9534f', borderColor: '#d9534f' },
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-transparent font-medium',
        'transition-all duration-150 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        'hover:brightness-95',
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      style={variantStyle[variant]}
      {...rest}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        icon && <span aria-hidden="true">{icon}</span>
      )}
      {children}
    </button>
  );
});
