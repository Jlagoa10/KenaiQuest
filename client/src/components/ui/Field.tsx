import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

const CONTROL_CLASS =
  'w-full rounded-xl border px-3.5 py-2.5 text-sm transition-colors min-h-[44px] ' +
  'placeholder:opacity-60 disabled:cursor-not-allowed disabled:opacity-60';

function controlStyle(hasError: boolean): React.CSSProperties {
  return {
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    borderColor: hasError ? '#d9534f' : 'var(--border-strong)',
  };
}

interface FieldWrapperProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}

function FieldWrapper({ label, error, hint, htmlFor, children }: FieldWrapperProps) {
  return (
    <div className="w-full">
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </p>
      )}
      {/* role=alert so a validation failure is announced when it appears. */}
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: '#d9534f' }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper label={label} error={error} hint={hint} htmlFor={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={cn(CONTROL_CLASS, className)}
        style={controlStyle(Boolean(error))}
        {...rest}
      />
    </FieldWrapper>
  );
});

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, error, hint, className, id, ...rest }, ref) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
      <FieldWrapper label={label} error={error} hint={hint} htmlFor={fieldId}>
        <textarea
          ref={ref}
          id={fieldId}
          rows={3}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL_CLASS, 'resize-y', className)}
          style={controlStyle(Boolean(error))}
          {...rest}
        />
      </FieldWrapper>
    );
  },
);

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string | undefined;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, className, id, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldWrapper label={label} error={error} hint={hint} htmlFor={fieldId}>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL_CLASS, className)}
        style={controlStyle(Boolean(error))}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
});
