import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { LoginInput } from '@kenai/shared';
import { loginSchema } from '@kenai/shared';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/apiClient';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await login(values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível entrar. Tente novamente em instantes.',
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo height={52} />
        <h1 className="mt-6 text-2xl font-semibold">Entrar</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Bem-vindo de volta. Continue de onde parou.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="kq-surface space-y-4 p-6" noValidate>
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          placeholder="Sua senha"
          error={errors.password?.message}
          {...register('password')}
        />

        {formError && (
          <div
            className="rounded-xl px-3.5 py-3 text-sm"
            style={{ backgroundColor: 'var(--bg-muted)', color: '#d9534f' }}
            role="alert"
          >
            {formError}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" isLoading={isSubmitting}>
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        Ainda não tem conta?{' '}
        <Link to="/cadastro" className="font-semibold" style={{ color: 'var(--brand-accent)' }}>
          Criar conta
        </Link>
      </p>
    </div>
  );
}
