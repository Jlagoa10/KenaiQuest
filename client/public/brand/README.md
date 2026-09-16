# Arquivos oficiais da marca

Esta pasta guarda os arquivos oficiais do Kenai Quest. Eles **não** são gerados
pelo código e **não devem** ser recriados, recoloridos, cortados ou distorcidos.

Adicione os arquivos originais aqui, exatamente com estes nomes:

```
client/public/brand/
├── LogoSF.png          logo oficial com fundo transparente (logo principal)
├── LogoCF.png          logo oficial com fundo
└── Kenai/
    └── KenPraia.png    arte colecionável inicial de desenvolvimento
```

## Como são usados

| Arquivo | Onde aparece | Servido em |
|---|---|---|
| `LogoSF.png` | navegação, autenticação, dashboard, rodapé, admin, favicon | `/brand/LogoSF.png` |
| `LogoCF.png` | lugares que pedem uma versão contida, com fundo | `/brand/LogoCF.png` |
| `Kenai/KenPraia.png` | arte inicial cadastrada pelo `npm run seed` | enviada ao storage |

O componente `Logo` (`client/src/components/brand/Logo.tsx`) usa
`LogoSF.png` por padrão e preserva a proporção original com `width: auto`.

Enquanto os arquivos não estiverem presentes, o componente exibe uma marca
tipográfica provisória para que a interface continue utilizável. Assim que os
PNGs oficiais forem adicionados nesta pasta, eles passam a ser usados
automaticamente, sem nenhuma alteração de código.
