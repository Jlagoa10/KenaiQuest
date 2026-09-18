# Arquivos oficiais da marca

Esta pasta guarda os arquivos oficiais do Kenai Quest. Eles **não** são gerados
pelo código e **não devem** ser recriados, recoloridos, cortados ou distorcidos.

Adicione os arquivos originais aqui, exatamente com estes nomes:

```
client/public/brand/
├── LogoSF.png          logo oficial com fundo transparente (logo principal)
├── LogoCF.png          logo oficial com fundo
├── background.png      imagem de fundo oficial da autenticação
├── background2.jpg     imagem de fundo oficial do topo da página inicial
└── Kenai/
    └── KenPraia.png    arte colecionável inicial de desenvolvimento
```

## Como são usados

| Arquivo | Onde aparece | Servido em |
|---|---|---|
| `LogoSF.png` | navegação, autenticação, dashboard, rodapé, admin | `/brand/LogoSF.png` |
| `LogoCF.png` | lugares que pedem uma versão contida, com fundo; origem dos ícones do site/app | `/brand/LogoCF.png` |
| `background.png` | login e cadastro | `/brand/background.png` |
| `background2.jpg` | topo (hero) da página inicial | `/brand/background2.jpg` |
| `Kenai/KenPraia.png` | arte inicial cadastrada pelo `npm run seed` | enviada ao storage |

## Ícones do site e do app

Os ícones de favicon e de "Adicionar à Tela de Início" ficam em
`client/public/icons/` (mais `client/public/favicon.ico`) e são **derivados do
`LogoCF.png`** — a logo não é redesenhada nem recolorida. A geração apenas
remove a margem branca vazia em volta, centraliza a logo num quadrado pintado
com o mesmo branco do original e reduz a escala, preservando a proporção:

```
client/public/favicon.ico                    16/32/48/64 px
client/public/icons/favicon-16.png
client/public/icons/favicon-32.png
client/public/icons/apple-touch-icon-180.png Apple Touch Icon (iOS)
client/public/icons/icon-192.png             manifest
client/public/icons/icon-512.png             manifest
client/public/icons/icon-maskable-512.png    manifest (`purpose: maskable`)
```

O manifesto fica em `client/public/site.webmanifest` e as tags correspondentes
em `client/index.html`. Se o `LogoCF.png` oficial for substituído, regenere os
ícones a partir dele em vez de editá-los à mão.

O componente `Logo` (`client/src/components/brand/Logo.tsx`) usa
`LogoSF.png` por padrão e preserva a proporção original com `width: auto`.
Cada tela escolhe um dos quatro tamanhos (`sm`, `md`, `lg`, `xl`) em vez de
passar pixels; as alturas ficam nas variáveis `--logo-*` de
`client/src/styles/theme.css` — o único lugar a ajustar a escala inteira.

As duas imagens de fundo são usadas apenas por CSS, pelas classes
`.kq-photo-bg` (autenticação) e `.kq-hero-bg` (hero da página inicial), em
`client/src/styles/theme.css`. Ambas usam sempre `cover` e `no-repeat` — nunca
esticadas e nunca duplicadas. O enquadramento de cada uma sai das variáveis
`--photo-focus` / `--hero-focus` (e as versões `-sm`, para telas estreitas),
que são o único lugar a ajustar se o recorte no celular pedir outro ponto
de foco.

Elas aparecem só nas áreas públicas; dashboard, metas, coleção, trocas, perfil
e admin continuam com fundo limpo, para que a arte colecionável do Kenai siga
sendo o foco visual.

Enquanto os arquivos não estiverem presentes, o componente exibe uma marca
tipográfica provisória para que a interface continue utilizável. Assim que os
PNGs oficiais forem adicionados nesta pasta, eles passam a ser usados
automaticamente, sem nenhuma alteração de código.
