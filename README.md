# Racha Da Santa v8.0 - Novo Layout

Redesign completo do app aplicando o design system "Elite Tactical Interface".

## O que mudou

O visual foi reconstruido do zero, mantendo 100% das funcionalidades originais.

### Visual
Paleta escura premium com fundo #0A0E17, dourado vibrante e acentos neon.
Fonte Inter (Google Fonts).
Cards com glassmorphism (transparencia + blur + borda fina).
Sidebar vertical no desktop, bottom nav no mobile.
Tipografia em escalas definidas (display-xl, headline, body, label-caps).

### Estrutura
Sidebar fixa no desktop com logo, menu de 4 a 5 abas e botao de login/logout no rodape.
No mobile, header superior compacto mais bottom nav com icones grandes.
Home em bento grid (proximo racha + stats + rachas recentes + top 5 artilheiros/assists).
Rankings com podio visual para top 3 mais lista dos demais.
Elenco com cards coloridos por posicao (dourado/azul/verde/vermelho).
Detalhe do racha com tabela de classificacao completa (J/V/E/D/SG/PTS).
Admin com tabs em pill group e layouts otimizados para cada aba.

### Bug corrigido
A rota `/racha/:id` estava divergente do parametro `matchId` usado no `MatchDetail.jsx`, impedindo a pagina de carregar. Corrigido para `/racha/:matchId`.

### Arquivo novo
Foi criado o `src/components/MatchList.jsx` (que era importado no `App.jsx` mas estava faltando). A lista agrupa rachas por mes e ano com cards clicaveis.

## O que NAO mudou

O schema do Supabase esta identico (tabelas players, matches, confirmations, teams, team_players, match_stats, games, game_goals).
As variaveis de ambiente continuam as mesmas (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
As abas da navegacao estao preservadas (Inicio, Rachas, Rankings, Elenco, Admin).
Todas as funcionalidades estao mantidas: sorteio de 2 a 4 times, sistema de jogos de 7 min, revezamento, upload de foto no bucket avatars, confirmacao via token, envio para WhatsApp, importacao de historico, RLS, autenticacao admin.
Os 4 admins cadastrados continuam com os mesmos UIDs no Supabase (Eduardo/Duzao, Antonio, Raphael/R11, Pedro).

## Antes de subir para o GitHub

### 1. Faca backup no GitHub (ESSENCIAL)

No seu repositorio `duhulian/racha-da-santa`, crie uma branch de backup:

No GitHub pelo navegador, clique no seletor de branch (onde aparece `main`), digite `backup-antes-novo-layout` e clique em "Create branch". Isso salva o estado atual caso algo de errado.

### 2. Crie uma branch de trabalho

Ainda no GitHub, crie outra branch chamada `novo-layout` a partir da `main`. Voce vai subir este ZIP nela primeiro, testar na Vercel (preview deployment) e so depois fazer merge na `main`.

### 3. Substitua os arquivos

Baixe este ZIP, extraia e substitua os arquivos do seu repositorio local pelos que estao aqui dentro. Depois:

```
git checkout -b novo-layout
git add .
git commit -m "feat: redesign completo para Elite Tactical Interface"
git push origin novo-layout
```

A Vercel vai criar um preview deployment automatico dessa branch. Teste la antes de fazer merge na main.

## NAO precisa mexer

No banco Supabase (schema idêntico, so adiciona as tabelas `games` e `game_goals` caso ainda nao existam, com `create table if not exists`).
Nas variaveis de ambiente da Vercel (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`).
Nos admins cadastrados (os UIDs estao intactos).
Nas imagens `public/logo.png`, `public/icon-192.png` e `public/icon-512.png` (MANTENHA as que ja existem no repositorio, nao estao neste ZIP pois sao binarios).

## Testar localmente antes de subir

```
npm install
npm run dev
```

Abre em http://localhost:5173. Confira se o login admin funciona, se os rachas carregam, se a confirmacao abre pelo link, se o sorteio gera times e se o sistema de jogos de 7 min registra gols.

## Estrutura do projeto

```
racha-da-santa/
├── public/
│   ├── favicon.svg        (novo, dourado)
│   ├── manifest.json      (atualizado: theme_color)
│   └── sw.js              (cache v8)
├── src/
│   ├── App.jsx            (rota matchId corrigida)
│   ├── main.jsx
│   ├── index.css          (Inter, glassmorphism)
│   ├── lib/
│   │   └── supabase.js
│   └── components/
│       ├── Layout.jsx           (sidebar + bottom nav)
│       ├── Home.jsx             (bento grid)
│       ├── Rankings.jsx         (podio)
│       ├── MatchList.jsx        (NOVO)
│       ├── MatchDetail.jsx
│       ├── Players.jsx          (cards por posicao)
│       ├── Confirm.jsx
│       ├── AdminLogin.jsx
│       ├── Admin.jsx            (4 sub-abas)
│       ├── Login.jsx            (dormente, nao importado)
│       ├── MatchDay.jsx         (dormente, nao importado)
│       └── Profile.jsx          (dormente, nao importado)
├── index.html             (Inter do Google Fonts)
├── package.json           (v8.0.0)
├── tailwind.config.js     (nova paleta + tokens)
├── vite.config.js
├── postcss.config.js
├── vercel.json
├── supabase_v2.sql        (schema completo)
└── README.md              (este arquivo)
```

## Suporte

Se algo nao funcionar apos subir, reverta para a branch de backup que voce criou no passo 1. A branch `main` continua intocada ate voce fazer o merge manualmente.
