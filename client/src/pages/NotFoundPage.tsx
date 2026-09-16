import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/brand/Logo';

export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 text-center">
      <Logo height={44} />
      <Compass size={40} className="mt-8" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
        O Kenai procurou por toda parte, mas não achou esta página.
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button>Voltar ao início</Button>
      </Link>
    </div>
  );
}
