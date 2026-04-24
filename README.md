# Racha Da Santa v9.0

Segunda rodada de atualizacoes com perfil FIFA, sorteio balanceado e upload de foto corrigido.

## O que mudou nessa versao

### Novo
1. **Tela de perfil do jogador estilo FIFA** com card de overall, stats PAC/SHO/PAS/DRI/DEF/PHY, foto em circulo dourado, nacionalidade (bandeira) e historico dos ultimos 5 rachas
2. **Stats FIFA editaveis** por jogador no painel admin (com sliders 40-99)
3. **Sorteio balanceado por overall**: algoritmo distribui jogadores alternando times, comecando pelos de overall mais alto, respeitando 1 goleiro por time
4. **Upload de foto corrigido**: agora redimensiona para 400x400 no navegador antes de subir, gera nome unico por upload (mata cache) e limpa fotos antigas
5. **Next Match card com contador regressivo** (dias, horas, minutos) no topo da home
6. **Player of the Month** baseado no desempenho dos ultimos 30 dias
7. **Overall visivel no card de cada jogador** no elenco (clicavel para o perfil)
8. **Ordenacao do elenco** por Overall, Numero ou Nome
9. **Nome, local e horario do racha** editaveis pelo admin

### Regras atualizadas
- **Time agora tem 6 jogadores**: 1 goleiro + 5 de linha (antes eram 7)
- Duracao: 1h30 (apenas informativo)
- Tempo por partida: 7 min (mantido)

### O que NAO mudou
- Schema do banco (apenas adicionou campos, nao mexeu nos existentes)
- Variaveis de ambiente da Vercel
- Admins cadastrados
- Logica de confirmacao, WhatsApp, importacao de historico
- Autenticacao e RLS

## Passo a passo para subir

### 1. Rodar o SQL de migracao no Supabase (ESSENCIAL)

Esse script **nao apaga nada**. Ele apenas adiciona campos novos com valores padrao.

1. Abra o Supabase: https://supabase.com/dashboard
2. Entre no projeto
3. Va em **SQL Editor** no menu lateral
4. Clica em "New query"
5. Abra o arquivo `supabase_v9_migration.sql` deste ZIP e **copie todo o conteudo**
6. Cola no SQL Editor
7. Clica em **Run** (ou Ctrl+Enter)
8. Deve aparecer "Success. No rows returned"

Apos rodar, todos os jogadores existentes passam a ter overall = 70 e stats = 70 por padrao. Voce pode ajustar individualmente pelo painel Admin.

### 2. Subir o codigo no GitHub

Voce ja tem o clone em `C:\Users\edu_d\Downloads\racha-da-santa` e esta na branch `novo-layout`.

1. Extraia este ZIP em qualquer lugar
2. Entre na pasta `racha-da-santa` que saiu do ZIP
3. Seleciona tudo que esta dentro (Ctrl+A) e copia (Ctrl+C)
4. Cola dentro de `C:\Users\edu_d\Downloads\racha-da-santa`, substituindo arquivos
5. No CMD, dentro da pasta `C:\Users\edu_d\Downloads\racha-da-santa`, rode um por vez:

```
git add .
git commit -m "v9 perfil FIFA sorteio balanceado upload de foto"
git push origin novo-layout
```

### 3. Aguardar deploy da Vercel

A Vercel vai fazer build automatico da branch `novo-layout`. Acesse https://vercel.com/dashboard, abra o projeto `racha-da-santa`, va em **Deployments** e espere o status virar **Ready**.

Importante: voce vai precisar testar no link **de preview** da branch novo-layout, nao no site real. O link de preview tem esse formato:

```
racha-da-santa-git-novo-layout-duhulian.vercel.app
```

### 4. Ajustar as stats FIFA dos jogadores

Apos testar e gostar do resultado, entra no painel Admin, aba **Jogadores**, e clica no lapis de cada jogador. Agora tem os campos de Overall, PAC, SHO, PAS, DRI, DEF, PHY e Nacionalidade.

Exemplo de valores tipicos:
- Goleiro forte: overall 80, DEF 85, PHY 78, demais 60-70
- Meia classico: overall 82, PAS 88, DRI 80, SHO 75, demais 70-75
- Atacante artilheiro: overall 83, SHO 88, PAC 82, DRI 78, DEF 55, demais 70
- Zagueiro: overall 78, DEF 85, PHY 80, PAC 70, demais 65

Os valores iniciais (todos em 70) ja geram sorteios funcionais. Voce vai refinando com o tempo.

### 5. Testar o novo sorteio balanceado

Crie um racha de teste, confirme uns 12-14 jogadores, clique em **Sortear 2 times**. Agora o algoritmo:
1. Coloca 1 goleiro por time (se tiver)
2. Distribui os outros alternando os times, sempre dando o jogador de overall mais alto pro time com menor soma de overall
3. O resultado sao times com soma de overall praticamente igual

Se nao gostar do sorteio, clica de novo em Sortear. Como os jogadores de cada overall ficam ordenados, o resultado e sempre o mesmo para os mesmos jogadores (determinístico).

### 6. Testar o upload de foto

Entra no Admin aba Jogadores, clica no icone de camera no canto da foto de qualquer jogador, seleciona uma foto. Ele:
- Redimensiona automaticamente para 400x400 (corta quadrado no centro)
- Comprime em JPEG 80%
- Sobe com nome unico (mata cache antigo)
- Atualiza na tela imediatamente

Se a foto ainda aparecer antiga, da refresh forcado no navegador (Ctrl+Shift+R) uma vez.

## Funcionalidades das telas de referencia que ainda NAO estao

Das tres imagens que voce mandou, eu deixei de fora (requer decisao sua):

- **Treasury Overview** (mensalidades) - sistema novo grande, precisa tabela e logica
- **Club News** - precisa sistema de posts
- **Badge Room** - precisa sistema de conquistas
- **Rating individual por partida** (8.5, 7.2, 6.0) - tem o campo no banco mas nao tem UI

Se quiser alguma dessas, me avisa qual primeiro.

## Estrutura de arquivos

```
racha-da-santa/
├── public/
│   ├── favicon.svg
│   ├── manifest.json
│   └── sw.js                (v9, ignora cache do storage)
├── src/
│   ├── App.jsx              (nova rota /jogador/:playerId)
│   ├── main.jsx
│   ├── index.css
│   ├── lib/
│   │   └── supabase.js
│   └── components/
│       ├── Layout.jsx
│       ├── Home.jsx               (Next Match + countdown + Player of the Month)
│       ├── Rankings.jsx
│       ├── MatchList.jsx
│       ├── MatchDetail.jsx
│       ├── Players.jsx            (overall + clicavel para perfil)
│       ├── PlayerProfile.jsx      (NOVO - perfil FIFA)
│       ├── Confirm.jsx
│       ├── AdminLogin.jsx
│       ├── Admin.jsx              (stats FIFA + sorteio balanceado + upload com resize)
│       ├── Login.jsx              (dormente)
│       ├── MatchDay.jsx           (dormente)
│       └── Profile.jsx            (dormente)
├── index.html
├── package.json                   (v9.0.0)
├── tailwind.config.js
├── vite.config.js
├── postcss.config.js
├── vercel.json
├── supabase_v2.sql                (schema completo v7 + v9)
├── supabase_v9_migration.sql      (APENAS a migracao v9, use este)
└── README.md
```
