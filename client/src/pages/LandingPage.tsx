import { Link } from 'react-router-dom';
import { CalendarCheck, Grid3x3, Images, Repeat2, Sparkles, Target } from 'lucide-react';
import { Logo } from '../components/brand/Logo';
import { Button } from '../components/ui/Button';
import { MAX_ACTIVE_GOALS, MAX_GOAL_DURATION_DAYS, MIN_GOAL_DURATION_DAYS } from '@kenai/shared';

const STEPS = [
  {
    icon: Target,
    title: 'Crie uma meta',
    description: `Escolha o que quer fazer e por quantos dias, de ${MIN_GOAL_DURATION_DAYS} a ${MAX_GOAL_DURATION_DAYS}.`,
  },
  {
    icon: Sparkles,
    title: 'Receba uma arte secreta',
    description: 'Uma arte do Kenai é sorteada e fica escondida até o fim da meta.',
  },
  {
    icon: CalendarCheck,
    title: 'Conclua o seu dia',
    description: 'Cada dia concluído revela uma peça da imagem. Dias perdidos deixam falhas.',
  },
  {
    icon: Images,
    title: 'Guarde na coleção',
    description: 'No fim, a arte é revelada e entra na sua coleção, completa ou não.',
  },
];

export function LandingPage() {
  return (
    <div>
      {/* The hero is the one landing block that carries a background photograph:
          background2.png, under the lighter hero veil so the image keeps its
          impact while the headline, copy and CTAs stay readable in both themes. */}
      <section
        className="kq-hero-bg kq-hero-veil relative isolate border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {/* Content sits above the veil; the section itself is the full-bleed band. */}
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
          <div className="kq-fade-up">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' }}
            >
              <Sparkles size={14} aria-hidden="true" />
              Metas que viram arte
            </span>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Transforme sua rotina em uma{' '}
              <span style={{ color: 'var(--brand-accent)' }}>coleção do Kenai</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-relaxed sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
              A cada dia concluído, uma peça da imagem misteriosa é revelada. Você só descobre
              qual arte conquistou quando a meta termina.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/cadastro">
                <Button size="lg" fullWidth>
                  Começar agora
                </Button>
              </Link>
              <Link to="/entrar">
                <Button size="lg" variant="secondary" fullWidth>
                  Entrar
                </Button>
              </Link>
            </div>
          </div>

          {/* A simple, honest illustration of the mechanic: some pieces
              revealed, some still hidden. */}
          <div className="kq-surface p-6 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Imagem misteriosa
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Raridade: ???
              </span>
            </div>
            <div
              className="grid aspect-[4/3] grid-cols-5 gap-1 overflow-hidden rounded-xl p-1"
              style={{ backgroundColor: 'var(--bg-inset)' }}
              aria-hidden="true"
            >
              {Array.from({ length: 20 }, (_, index) => {
                const revealed = [0, 1, 3, 5, 6, 8, 11, 12, 15, 17].includes(index);
                const missed = [4, 13].includes(index);
                return (
                  <div
                    key={index}
                    className="rounded-sm transition-colors"
                    style={{
                      backgroundColor: revealed
                        ? index % 3 === 0
                          ? 'var(--brand-primary)'
                          : 'var(--brand-accent)'
                        : missed
                          ? 'var(--piece-missed)'
                          : 'var(--piece-locked)',
                      opacity: revealed ? 0.85 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>10 de 20 peças</span>
              <span>Dia 12 de 20</span>
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-y py-16 sm:py-20"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Como funciona</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex flex-col">
                  <div
                    className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ backgroundColor: 'var(--brand-accent-soft)', color: 'var(--brand-accent)' }}
                    aria-hidden="true"
                  >
                    <Icon size={20} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                    Passo {index + 1}
                  </span>
                  <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="kq-surface p-6">
            <Grid3x3 size={22} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold">Uma peça por dia</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              A imagem é dividida em exatamente o número de dias da sua meta. Um dia perdido
              deixa uma falha permanente naquela cópia.
            </p>
          </div>
          <div className="kq-surface p-6">
            <Images size={22} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold">Coleção que é sua</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Cada arte conquistada vira uma cópia única, com a sua própria história de dias
              concluídos e perdidos.
            </p>
          </div>
          <div className="kq-surface p-6">
            <Repeat2 size={22} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold">Trocas entre pessoas</h3>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Cópias com 90% ou mais podem ser trocadas por outras artes. Arte por arte, sem
              moedas e sem pontos.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-5 text-center">
          <Logo height={44} />
          <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
            Até {MAX_ACTIVE_GOALS} metas ativas ao mesmo tempo, para você manter o foco no que
            realmente importa.
          </p>
          <Link to="/cadastro">
            <Button size="lg">Criar minha conta</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
