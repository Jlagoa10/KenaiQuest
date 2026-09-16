# Kenai Quest

> Transforme suas metas diárias em artes colecionáveis do Kenai.

Kenai Quest é uma plataforma de acompanhamento de metas gamificada em torno do
Kenai, um pug animado. Você cria uma meta, o sistema sorteia **em segredo** uma
arte do Kenai, e cada dia concluído revela uma peça dessa imagem. Quando a meta
termina, a arte é revelada e entra na sua coleção — completa ou não.

Não há moedas, pontos, dinheiro, NFT ou qualquer mecânica financeira. As trocas
são sempre arte por arte.

---

## Índice

- [Conceito do produto](#conceito-do-produto)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Seed](#seed)
- [Criando o primeiro administrador](#criando-o-primeiro-administrador)
- [Rodando localmente](#rodando-localmente)
- [Arquivos oficiais da marca](#arquivos-oficiais-da-marca)
- [Configuração do Supabase](#configuração-do-supabase)
- [Como adicionar novas artes do Kenai](#como-adicionar-novas-artes-do-kenai)
- [Como funcionam as regras de recompensa](#como-funcionam-as-regras-de-recompensa)
- [Decisões técnicas importantes](#decisões-técnicas-importantes)
- [Testes](#testes)
- [Deploy do frontend na Vercel](#deploy-do-frontend-na-vercel)
- [Deploy do backend](#deploy-do-backend)
- [Segurança](#segurança)

---

## Conceito do produto

```
USUÁRIO CRIA UMA META
        ↓
SISTEMA SORTEIA UMA ARTE DO KENAI (em segredo)
        ↓
IMAGEM COMEÇA TOTALMENTE OCULTA
        ↓
USUÁRIO CONCLUI A META DO DIA
        ↓
UMA PEÇA DA IMAGEM É REVELADA
        ↓
META ENCERRA
        ↓
ARTE ENTRA NA COLEÇÃO
        ↓
CÓPIAS COM 90%+ PODEM SER TROCADAS
```

### Regras do produto

| Regra | Valor |
|---|---|
| Duração mínima de uma meta | 7 dias |
| Duração máxima de uma meta | 365 dias |
| Metas ativas simultâneas | no máximo 3 |
| Data de início | hoje ou uma data futura |
| Dias que podem ser marcados | apenas **Hoje** ou **Ontem** |
| Peças da imagem | exatamente uma por dia da meta |
| Ordem de revelação | aleatória, sorteada uma única vez e persistida |
| Dia não marcado a tempo | perdido permanentemente, deixa um buraco na imagem |
| Meta encerrada | entra na coleção mesmo incompleta |
| Meta excluída | **nenhum** colecionável é concedido |
| Cópias duplicadas | permitidas e mantidas separadas |
| Elegível para troca | completude ≥ 90% |
| Cópia 100% | recebe o selo "Cópia perfeita" |
| Meta de 365 dias | garante raridade Lendária |

Todo texto visível da aplicação está em **português do Brasil**.

---

## Stack

**Frontend** — React 18, TypeScript, Vite 6, React Router 7, Tailwind CSS 4,
TanStack Query, react-hook-form + Zod, lucide-react.

**Backend** — Node.js 20+, Express 4, TypeScript, node-postgres (`pg`), Zod,
bcryptjs, jsonwebtoken, sharp, multer, helmet, pino.

**Banco de dados** — PostgreSQL 14+ (local em desenvolvimento, Supabase em
produção).

**Armazenamento de imagens** — Supabase Storage em produção, disco local em
desenvolvimento, atrás da mesma interface.

---

## Arquitetura

Monorepo com npm workspaces e três pacotes:

```
/shared   tipos, schemas Zod, constantes e algoritmos puros (usado pelos dois lados)
/server   API Express + PostgreSQL
/client   SPA React (deploy na Vercel)
```

O pacote `shared` é o que mantém as regras honestas: o algoritmo de divisão da
imagem, o enum de raridade com os rótulos em português e os schemas de validação
existem **uma única vez** e são consumidos pelos dois lados. Não há como o
servidor e o cliente discordarem sobre a geometria das peças ou sobre o que é uma
duração válida.

O backend segue uma separação estrita de responsabilidades:

```
routes       →  apenas declaração de rotas e middlewares
controllers  →  parse da requisição, chamada do serviço, montagem do DTO
services     →  TODA a regra de negócio
repositories →  TODO o SQL
```

Nenhuma consulta SQL existe fora de `repositories/`, nenhuma regra de negócio
existe dentro de um controller ou componente React.

---

## Estrutura do projeto

```
kenai-quest/
├── package.json                  workspaces + scripts agregadores
├── tsconfig.base.json
├── docker-compose.yml            PostgreSQL local (opcional)
├── .env.example
│
├── shared/src/
│   ├── constants/                rarity · goals · trades · users · uploads
│   ├── schemas/                  validação Zod compartilhada
│   ├── domain/                   pieceGrid · completion · dates · goalProgress · random
│   └── types/                    DTOs da API (inclui os DTOs "com segredo")
│
├── server/src/
│   ├── config/                   env.ts (validado por Zod) · constants.ts
│   ├── database/                 pool · transaction · migrate.ts · seed.ts · migrations/*.sql
│   ├── middleware/               authenticate · validate · rateLimit · upload · errorHandler
│   ├── routes/                   auth · users · goals · collectibles · trades · admin
│   ├── controllers/              controllers finos
│   ├── services/                 goalService · rewardEngine · tradeService · imageCompositor · …
│   ├── repositories/             todo o SQL
│   ├── storage/                  StorageProvider + drivers Supabase e local
│   ├── jobs/                     resolveStaleGoals.ts
│   ├── scripts/                  createAdmin.ts
│   └── __tests__/                unit/ + integration/
│
└── client/
    ├── public/brand/             ARQUIVOS OFICIAIS DA MARCA (ver seção abaixo)
    ├── vercel.json
    └── src/
        ├── components/           ui/ · brand/ · goals/ · collectibles/ · trades/ · puzzle/
        ├── layouts/              PublicLayout · AppLayout · AdminLayout
        ├── pages/                Landing · Login · Cadastro · Dashboard · Metas · Coleção · Trocas · Perfil · admin/
        ├── contexts/             AuthContext · ThemeContext · ToastContext
        ├── hooks/                useGoals · useCollectibles · useTrades · useAdmin
        ├── services/             apiClient + um serviço por domínio
        └── styles/               theme.css (tokens de marca, claro e escuro)
```

---

## Requisitos

- **Node.js 20+** e npm 10+
- **PostgreSQL 14+** (local, Docker ou Supabase)
- Uma conta no **Supabase** para produção (opcional em desenvolvimento)

---

## Instalação

```bash
git clone <url-do-repositorio>
cd KenaiQuest
npm install
```

O `npm install` na raiz instala os três workspaces de uma vez.

---

## Variáveis de ambiente

Copie `.env.example` para `.env` na raiz do repositório e preencha:

```bash
cp .env.example .env
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NODE_ENV` | não | `development`, `test` ou `production`. Padrão: `development`. |
| `PORT` | não | Porta da API. Padrão: `4000`. |
| `LOG_LEVEL` | não | `info` por padrão. |
| `TRUST_PROXY` | não | `true` quando o backend estiver atrás de um proxy reverso. Necessário para o rate limit ler o IP real. |
| `DATABASE_URL` | **sim** | String de conexão PostgreSQL. |
| `DATABASE_SSL` | não | `true` ao conectar no Supabase ou em qualquer Postgres gerenciado. |
| `DATABASE_POOL_MAX` | não | Tamanho máximo do pool. Padrão: `10`. |
| `TEST_DATABASE_URL` | não | Banco usado pelos testes de integração. Sem ela, esses testes são ignorados. |
| `JWT_SECRET` | **sim** | Mínimo de 32 caracteres. Trocar invalida todas as sessões. |
| `JWT_ACCESS_TOKEN_TTL_SECONDS` | não | Padrão: `900` (15 minutos). |
| `REFRESH_TOKEN_TTL_DAYS` | não | Padrão: `30`. |
| `FRONTEND_URL` | **sim** | Origens permitidas no CORS, separadas por vírgula. |
| `COOKIE_DOMAIN` | não | Apenas se backend e frontend dividirem o mesmo domínio-pai. |
| `STORAGE_DRIVER` | não | `local` (padrão) ou `supabase`. |
| `STORAGE_LOCAL_DIR` | não | Pasta usada pelo driver local. Padrão: `./uploads`. |
| `SUPABASE_URL` | condicional | Obrigatória quando `STORAGE_DRIVER=supabase`. |
| `SUPABASE_SERVICE_ROLE_KEY` | condicional | Obrigatória quando `STORAGE_DRIVER=supabase`. **Nunca exponha ao frontend.** |
| `SUPABASE_STORAGE_BUCKET` | não | Padrão: `kenai-artworks`. |
| `SEED_ARTWORK_PATH` | não | Caminho da arte inicial usada pelo seed. |
| `VITE_API_URL` | **sim** | URL da API. Única variável que chega ao navegador. |

Gere um `JWT_SECRET` forte com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **Apenas variáveis com prefixo `VITE_` chegam ao navegador.** Todas as outras,
> incluindo `SUPABASE_SERVICE_ROLE_KEY` e `DATABASE_URL`, ficam exclusivamente no
> backend. O arquivo `.env` já está no `.gitignore`.

---

## Banco de dados e migrações

### Subindo um PostgreSQL local

Com Docker:

```bash
docker compose up -d
```

Ou usando um PostgreSQL já instalado:

```bash
createdb kenai_quest
createdb kenai_quest_test   # opcional, para os testes de integração
```

### Executando as migrações

```bash
npm run migrate:up       # aplica todas as migrações pendentes
npm run migrate:status   # mostra o que está aplicado e o que está pendente
npm run migrate:down     # reverte a última migração
```

As migrações são arquivos `.sql` numerados em
`server/src/database/migrations/`, aplicados por um runner próprio que registra
o histórico na tabela `schema_migrations`. Cada migração roda dentro da própria
transação, então uma falha não deixa o schema pela metade.

Os mesmos arquivos rodam sem alteração no PostgreSQL local e no Supabase — não há
nada específico de provedor neles.

| Migração | Conteúdo |
|---|---|
| `001_initial_schema` | enums, tabelas, índices, constraints e triggers |
| `002_default_reward_rules` | configuração inicial de recompensa por duração |

As regras de recompensa vêm como **migração**, não como seed, porque são
configuração de sistema: um banco de produção recém-criado já consegue sortear
recompensas. Depois disso, tudo é editável pelo painel administrativo.

### Tabelas principais

```
users ──┬── goals ──── goal_days          (histórico autoritativo, 1 registro por dia)
        │     └─────── collectibles       (1:1, criado no encerramento da meta)
        ├── collectibles                  (owner_id muda em uma troca)
        ├── refresh_tokens
        └── trade_offers ──── trades      (registro imutável das trocas executadas)

artworks ──┬── goals           (ON DELETE RESTRICT)
           └── collectibles    (ON DELETE RESTRICT)

reward_rules ──── reward_rule_weights
```

---

## Seed

```bash
npm run seed
```

O seed cadastra a arte inicial de desenvolvimento **Kenai na Praia** a partir de
`client/public/brand/Kenai/KenPraia.png`, enviando o arquivo pelo mesmo caminho
de código que o painel administrativo usa. Isso é proposital: trocar
`STORAGE_DRIVER` para `supabase` faz o seed popular o Supabase Storage, sem
nenhuma alteração de código.

Se o arquivo não existir, o seed apenas emite um aviso e segue — nada quebra.
Você pode cadastrar a primeira arte pelo painel em `/admin/artes`.

O seed é idempotente e não cria artes fictícias.

---

## Criando o primeiro administrador

Nenhuma senha de administrador é embutida no código ou no repositório.

**Opção 1 — promover uma conta existente** (recomendado). Cadastre-se
normalmente pela interface e depois:

```bash
npm run create:admin -- --email voce@exemplo.com
```

**Opção 2 — criar um administrador do zero, interativamente.** A senha é digitada
sem aparecer na tela e não fica no histórico do shell:

```bash
npm run create:admin
```

**Opção 3 — não interativo** (CI ou primeiro deploy):

```bash
ADMIN_EMAIL=voce@exemplo.com ADMIN_NAME="Seu Nome" ADMIN_PASSWORD='...' npm run create:admin
```

Em todos os casos a senha é validada e armazenada apenas como hash bcrypt.

---

## Rodando localmente

Em dois terminais:

```bash
npm run dev:server   # API em http://localhost:4000
npm run dev:client   # SPA em http://localhost:5173
```

Ou os dois de uma vez:

```bash
npm run dev
```

O Vite faz proxy de `/api` para o backend em desenvolvimento, então o navegador
conversa com a mesma origem e o comportamento dos cookies é idêntico ao de
produção.

### Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | sobe backend e frontend |
| `npm run build` | compila os três workspaces |
| `npm run typecheck` | verificação de tipos em todos os workspaces |
| `npm test` | testes unitários + integração |
| `npm run migrate:up` / `:down` / `:status` | migrações |
| `npm run seed` | cadastra a arte inicial |
| `npm run create:admin` | cria ou promove um administrador |
| `npm run jobs:resolve` | varredura de metas vencidas (opcional) |

---

## Arquivos oficiais da marca

Os arquivos oficiais **não são gerados pelo código** e não devem ser recriados,
recoloridos, cortados ou distorcidos. Coloque-os em:

```
client/public/brand/
├── LogoSF.png          logo oficial, fundo transparente — LOGO PRINCIPAL
├── LogoCF.png          logo oficial com fundo
└── Kenai/
    └── KenPraia.png    arte colecionável inicial de desenvolvimento
```

`LogoSF.png` é usado na navegação, nas telas de autenticação, no dashboard, no
rodapé, na navegação mobile, no painel administrativo e como favicon. O
componente `Logo` preserva a proporção original com `width: auto`.

Enquanto os arquivos não estiverem presentes, a interface exibe uma marca
tipográfica provisória, para que nada quebre. Assim que os PNGs oficiais forem
adicionados, eles passam a ser usados automaticamente — sem alteração de código e
sem novo deploy do backend.

---

## Configuração do Supabase

### 1. Banco de dados

Em **Project Settings → Database → Connection string → URI**, copie a string e
coloque em `DATABASE_URL`. Use a porta `5432` para servidores de longa duração e
`6543` (Transaction pooler) em ambientes serverless. Defina `DATABASE_SSL=true`.

Depois aplique as migrações apontando para o Supabase:

```bash
npm run migrate:up
```

### 2. Storage

1. Em **Storage → Buckets**, crie um bucket chamado `kenai-artworks`.
2. Mantenha o bucket **privado**. Isto é importante: as artes nunca são servidas
   por URL pública. O backend baixa o arquivo original, monta a imagem apenas com
   as peças já desbloqueadas e envia o resultado. Um bucket público quebraria o
   segredo do produto.
3. Em **Project Settings → API**, copie a `service_role` key.
4. Configure o backend:

```env
STORAGE_DRIVER=supabase
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
SUPABASE_STORAGE_BUCKET=kenai-artworks
```

> A `service_role` key ignora as políticas de RLS. Ela só pode existir no
> backend. Nunca a coloque em uma variável `VITE_`, em um arquivo do `client/`
> ou em qualquer lugar versionado.

Nenhuma regra de negócio conhece o Supabase: artes, coleção, recompensas e o
painel administrativo falam apenas com a interface `StorageProvider`. Trocar de
driver é configuração, não reescrita.

---

## Como adicionar novas artes do Kenai

Pelo painel administrativo, **sem alterar código e sem novo deploy**:

```
/admin/artes → Adicionar imagem → escolher arquivo → nome → raridade → Enviar
```

O que acontece:

1. O arquivo é validado (tipo MIME declarado, decodificação real da imagem,
   tamanho máximo de 5 MB).
2. A imagem é reprocessada, o que remove EXIF e qualquer conteúdo embutido.
3. O arquivo é enviado ao storage com um **nome gerado pelo servidor** — o nome
   original enviado nunca é usado como caminho.
4. Um registro é criado em `artworks` com as dimensões e a raridade.
5. A arte entra **imediatamente** no pool de sorteio da sua raridade.

Lembre-se de incluir a **estrela escondida** dentro da arte. A estrela faz parte
da identidade visual do Kenai Quest, é sempre desenhada manualmente na arte
(nunca sobreposta por código) e não concede pontos nem vantagem alguma.

### Desativar em vez de excluir

Uma arte já concedida a alguém **não pode** ser excluída — a API recusa com
`ARTWORK_IN_USE`, e as chaves estrangeiras usam `ON DELETE RESTRICT`. Use
**Desativar**: a arte sai dos sorteios futuros e todas as cópias existentes
continuam funcionando para sempre.

---

## Como funcionam as regras de recompensa

A duração da meta influencia a raridade do prêmio:

```
duração da meta
      ↓
regra ativa correspondente (maior prioridade vence)
      ↓
pesos por raridade
      ↓
raridade sorteada
      ↓
artes ativas daquela raridade
      ↓
arte sorteada
```

Configuração inicial (editável em `/admin/regras`):

| Duração | Raridades |
|---|---|
| 7–14 dias | majoritariamente Comum |
| 15–30 dias | Comum / Incomum |
| 31–60 dias | Incomum / Rara |
| 61–120 dias | Rara / Épica |
| 121–364 dias | principalmente Épica, com chance de Lendária |
| 365 dias | **Lendária garantida** |

### Os pesos são relativos, não porcentagens

O motor normaliza os pesos entre si, então `65 / 30 / 5` e `13 / 6 / 1` produzem
exatamente o mesmo resultado. Não é necessário somar 100. A interface mostra a
porcentagem resultante ao lado de cada campo enquanto você digita.

### Pools vazios

Uma raridade sem nenhuma arte ativa é **removida do sorteio antes** do cálculo.
Assim, as porcentagens exibidas no painel são as chances reais, e um catálogo
parcialmente preenchido continua funcionando. O painel marca com um aviso toda
raridade que tem peso mas nenhuma arte.

Se nenhuma raridade configurada tiver arte, o motor cai para qualquer raridade
com estoque. Se não houver arte ativa alguma, a criação da meta retorna uma
mensagem amigável em vez de quebrar.

### Prioridade

Faixas podem se sobrepor: a regra ativa de maior `priority` vence. É assim que a
regra "Desafio de um ano" (365–365, prioridade 100) garante Lendária sem precisar
editar as outras faixas.

---

## Decisões técnicas importantes

### O segredo é garantido pelo servidor, não pelo CSS

Mascarar a imagem no navegador seria muito mais simples, mas entregaria a arte
inteira ao cliente — bastaria abrir o devtools para ver o prêmio. O segredo seria
apenas cosmético.

Em vez disso, o bucket é privado e a rota `GET /api/goals/:id/image.png` usa
`sharp` para compor um PNG contendo **apenas as regiões já desbloqueadas**, sobre
um fundo transparente. Os pixels bloqueados nunca saem do servidor.

O fundo transparente é proposital: o cliente desenha por cima as células
bloqueadas e perdidas, o que permite que os buracos sigam o tema claro/escuro
ativo e que uma peça recém-revelada seja animada. A geometria vem do mesmo
algoritmo em `@kenai/shared`, então a sobreposição encaixa exatamente nas regiões
que o servidor renderizou.

Enquanto a meta está ativa, a resposta da API **omite completamente** o nome, a
raridade e o id da arte — os campos não vêm em branco, eles simplesmente não
existem no payload. Há um teste de integração que serializa a resposta inteira e
falha se qualquer um desses valores aparecer.

### Divisão da imagem em exatamente N peças

```
linhas   = arredonda(√(N ÷ proporção da imagem))
base     = N ÷ linhas (divisão inteira)
resto    = N mod linhas
→ as primeiras `resto` linhas recebem uma célula a mais
```

Isso dá exatamente N células para qualquer N de 7 a 365, cobrindo 100% da
imagem, sem supor grade quadrada — 31 peças funciona tão bem quanto 30. Quando N
não divide igualmente, linhas com menos células têm células mais largas; a soma
das áreas continua sendo exatamente 1. Há testes que verificam isso para **todas**
as 359 durações válidas.

### Ordem de revelação

Sorteada uma única vez na criação da meta (Fisher–Yates) e gravada na coluna
`goal_days.piece_index`, com unicidade garantida por constraint. Nada recalcula a
ordem depois, então recarregar a página nunca embaralha a imagem.

### Dias perdidos: resolução preguiçosa, transacional e idempotente

Um dia pendente vira `MISSED` quando sua janela Hoje/Ontem fecha. Isso precisa
acontecer mesmo que o usuário não esteja online e mesmo que nenhum job tenha
rodado.

A resolução é feita **no acesso**: toda leitura ou escrita que toca uma meta abre
uma transação, trava a linha da meta e executa um único `UPDATE` que fecha os dias
vencidos; em seguida, se a meta acabou, ela é encerrada e o colecionável é criado
**na mesma transação**. O corte é calculado no **fuso horário do dono da meta**,
nunca no do servidor.

Como a operação só move `PENDING → MISSED` e é protegida pelo lock de linha,
rodá-la duas vezes — ou de duas requisições simultâneas — converge para o mesmo
estado. O script `npm run jobs:resolve` faz a mesma coisa para todas as metas
ativas; ele existe para manter os dados frescos (estatísticas, futuras
notificações), **nunca** como dependência de correção.

### Fuso horário

`goal_days.day_date` é um `DATE` fixado na criação. "Hoje" e "Ontem" são
resolvidos no servidor a partir do fuso do usuário via `Intl`. A API aceita
apenas os literais `today` e `yesterday` — uma requisição forjada não consegue
marcar uma data arbitrária, porque a data nunca vem do cliente.

### Autenticação

Token de acesso JWT curto (15 min) mantido **apenas em memória** no cliente e
enviado como `Authorization: Bearer`; token de refresh em cookie `httpOnly`,
`Secure`, `SameSite=None`, restrito ao caminho `/api/auth`, guardado no banco
apenas como hash SHA-256 e **rotacionado a cada uso**. Reapresentar um token já
rotacionado revoga toda a família — é a detecção padrão de token roubado.

Essa combinação é imune a CSRF (chamadas de API não carregam credencial
ambiente) e não deixa credencial de longa duração acessível a JavaScript.

### Troca atômica

Aceitar uma proposta acontece em **uma única transação**: trava a proposta, depois
os dois colecionáveis em ordem determinística de id (duas aceitações simultâneas
enfileiram em vez de causar deadlock), revalida tudo a partir das **linhas
travadas** — proposta ainda pendente, cada lado ainda dono do que oferece, ambos
ainda com 90%+ —, troca os donos, registra a troca e invalida as demais propostas
abertas sobre aqueles colecionáveis. Qualquer falha desfaz tudo: não existe troca
pela metade.

### Fonte da verdade

Não há campo editável de "progresso". Todo número exibido é derivado de
`goal_days`. O snapshot `collectibles.owned_piece_indexes` é congelado no
encerramento, quando os dias já são imutáveis, e serve apenas para a composição da
imagem e os filtros da galeria.

---

## Testes

```bash
npm test              # tudo
npm run test:shared   # apenas o domínio puro
npm run test:server   # unitários + integração
```

Os testes de integração rodam contra um PostgreSQL real definido por
`TEST_DATABASE_URL`. Sem essa variável eles são **ignorados**, e apenas os testes
unitários rodam — o `npm test` não quebra em uma máquina sem banco.

Cobertura das regras críticas:

- geometria das peças para **todas** as 359 durações (contagem exata, cobertura
  total, sem sobreposição)
- máximo de 3 metas ativas, inclusive sob **requisições simultâneas**
- validação de duração (7–365) e de data de início
- conclusão Hoje/Ontem, incluindo viradas de mês e de ano
- rejeição de dia duplicado e de data arbitrária forjada
- dias perdidos permanentes e idempotência da resolução
- porcentagem de completude e regra dos 90% (verificada para **toda** combinação
  de peças e durações)
- 365 dias garante Lendária
- meta excluída não concede colecionável
- encerramento simultâneo cria **apenas um** colecionável
- propriedade dos colecionáveis nas trocas
- aceitação atômica e única sob concorrência
- upload rejeitando arquivo que não é imagem
- rotas administrativas retornando 403 para usuário comum
- o payload de uma meta ativa **não** conter nome, raridade ou id da arte

---

## Deploy do frontend na Vercel

1. Importe o repositório na Vercel.
2. **Root Directory**: `client`
3. **Build Command**: `npm run build -w @kenai/shared && npm run build -w @kenai/client`
4. **Output Directory**: `dist`
5. Variável de ambiente: `VITE_API_URL=https://sua-api.exemplo.com`

O arquivo `client/vercel.json` já configura o fallback de SPA e os cabeçalhos de
cache e segurança.

Depois do deploy, adicione a URL da Vercel ao `FRONTEND_URL` do backend (aceita
várias origens separadas por vírgula, útil para ambientes de preview).

---

## Deploy do backend

O backend é um servidor Node comum e não depende de nenhum provedor. Funciona em
Render, Railway, Fly.io, um VPS ou qualquer host com Node 20+.

```bash
npm ci
npm run build
npm run migrate:up
npm start          # executa server/dist/index.js
```

Variáveis mínimas em produção:

```env
NODE_ENV=production
DATABASE_URL=...
DATABASE_SSL=true
JWT_SECRET=...
FRONTEND_URL=https://seu-app.vercel.app
STORAGE_DRIVER=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
TRUST_PROXY=true
```

Notas:

- `TRUST_PROXY=true` é necessário atrás de um proxy reverso, senão o rate limit
  enxerga o IP errado.
- O backend usa `sharp`, que traz binários pré-compilados para Linux, macOS e
  Windows. Isso funciona nos hosts Node tradicionais; em runtimes edge sem
  suporte a binários nativos, use um host Node comum.
- Opcional: agende `npm run jobs:resolve` (por exemplo, uma vez por hora). Ele
  apenas mantém os dados frescos — a aplicação está correta sem ele.
- Há um endpoint de saúde em `GET /api/health`.

---

## Segurança

- Senhas com bcrypt (custo 12); nunca armazenadas ou retornadas em texto claro.
- Tokens de refresh guardados apenas como hash, rotacionados a cada uso, com
  revogação de família ao detectar reuso.
- Comparação de senha executada mesmo para e-mail inexistente, para que o tempo
  de resposta não revele quais contas existem.
- Autorização por papel no backend em **todas** as rotas `/api/admin`; o guard do
  frontend é conveniência, não a fronteira de segurança.
- Validação de schema com Zod em toda entrada; chaves desconhecidas são
  descartadas.
- Rate limit escalonado: rigoroso em login e cadastro, generoso na renovação de
  sessão (que não é superfície de força bruta), e um limite amplo como rede de
  proteção na API inteira.
- `helmet` para cabeçalhos de segurança; CORS com lista explícita de origens e
  credenciais habilitadas — nunca curinga.
- Upload: tipo MIME validado, decodificação real da imagem exigida, limite de
  5 MB, reprocessamento que remove metadados, e nome de arquivo gerado pelo
  servidor. Arquivos executáveis não passam.
- Todas as consultas são parametrizadas; não há concatenação de SQL.
- Erros de banco, mensagens de driver e stack traces nunca chegam ao navegador —
  o usuário vê uma mensagem em português e o detalhe fica no log.
- O bucket de artes é privado e as imagens são servidas pela API, com as peças
  bloqueadas removidas no servidor.
