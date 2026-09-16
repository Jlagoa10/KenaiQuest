import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { RegisterInput } from '@kenai/shared';
import { registerSchema } from '@kenai/shared';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from '../services/apiClient';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      // The browser's own timezone is a far better default than a fixed one,
      // and the user can change it later in the profile.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await registerUser({ ...values, timezone });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar sua conta. Tente novamente.',
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo height={52} />
        <h1 className="mt-6 text-2xl font-semibold">Criar conta</h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Comece a transformar suas metas em artes colecionáveis.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="kq-surface space-y-4 p-6" noValidate>
        <TextField
          label="Nome"
          autoComplete="name"
          placeholder="Como quer ser chamado"
          error={errors.name?.message}
          {...register('name')}
        />

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
          autoComplete="new-password"
          placeholder="Mínimo de 8 caracteres"
          hint="Use pelo menos 8 caracteres, com letras e números."
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
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        Já tem uma conta?{' '}
        <Link to="/entrar" className="font-semibold" style={{ color: 'var(--brand-accent)' }}>
          Entrar
        </Link>
      </p>
    </div>
  );
}
