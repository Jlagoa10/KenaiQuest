# Arquivos oficiais da marca

Esta pasta guarda os arquivos oficiais do Kenai Quest. Eles **não** são gerados
pelo código e **não devem** ser recriados, recoloridos, cortados ou distorcidos.

Adicione os arquivos originais aqui, exatamente com estes nomes:

```
client/public/brand/
├── LogoSF.png          logo oficial com fundo transparente (logo principal)
├── LogoCF.png          logo oficial com fundo
├── background.png      imagem de fundo oficial da autenticação
├── background2.png     imagem de fundo oficial do topo da página inicial
└── Kenai/
    └── KenPraia.png    arte colecionável inicial de desenvolvimento
```

## Como são usados

| Arquivo | Onde aparece | Servido em |
|---|---|---|
| `LogoSF.png` | navegação, autenticação, dashboard, rodapé, admin, favicon | `/brand/LogoSF.png` |
| `LogoCF.png` | lugares que pedem uma versão contida, com fundo | `/brand/LogoCF.png` |
| `background.png` | login e cadastro | `/brand/background.png` |
| `background2.png` | topo (hero) da página inicial | `/brand/background2.png` |
| `Kenai/KenPraia.png` | arte inicial cadastrada pelo `npm run seed` | enviada ao storage |

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
