# Artes do Kenai

Coloque `KenPraia.png` nesta pasta (mantendo exatamente esta grafia).

Este é o colecionável inicial de desenvolvimento. O comando `npm run seed`
procura o arquivo em `client/public/brand/Kenai/KenPraia.png`, envia a imagem
para o storage configurado (disco local ou Supabase Storage) e cadastra a arte
"Kenai na Praia" no banco.

Se o arquivo não existir, o seed apenas emite um aviso e segue sem cadastrar a
arte — nada quebra. As próximas artes devem ser cadastradas pelo painel
administrativo em `/admin/artes`, sem alterar código.
