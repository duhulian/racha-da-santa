# CHANGELOG

Registro append-only. Entrada nova vai no topo. Nada aqui e reescrito, apagado ou
resumido: informacao superada recebe nota datada e permanece.

O historico anterior a este arquivo esta nos commits do Git e no `README.md`, que
descreve a release v10.

---

## 2026-09-15, revisao de producao

### Pedido

"faca seu diagnostico e aplique as correcoes", sob o protocolo de engenharia de
producao. Diagnostico do codigo da v10, que ate aqui so tinha sido lido em parte.

### Corrigido

1. **CRITICAL. O Live Match Control nunca conseguiu iniciar um jogo.**
   `LiveMatchControl.jsx` gravava `status: 'in_progress'` ao criar o game, mas a
   constraint `games_status_check` no banco aceita apenas `pending`, `playing` e
   `finished`. Todo insert era recusado pelo Postgres e o admin recebia um alerta de
   erro. E a explicacao de `games` estar com 0 linhas em producao: o recurso central da
   v10 estava inoperante desde que foi escrito. Passou a gravar `'playing'`.

   O `supabase_v2.sql` versionado tambem estava errado, declarando
   `default 'in_progress' check (status in ('in_progress','finished'))`, que nao e o que
   existe no banco. Foi alinhado ao real, com nota datada, senao um ambiente novo
   nasceria incompativel com o codigo.

2. **HIGH. Baixa de mensalidade podia falhar em silencio.** `markAsPaid`,
   `markAsUnpaid`, `deletePayment`, e as equivalentes de taxa da quadra e do
   CommandCenter, descartavam o retorno do Supabase e recarregavam a tela do mesmo
   jeito. Se a gravacao falhasse, a cobranca aparecia como quitada sem ter sido
   registrada. Passaram a checar `error` e avisar.

3. **MEDIUM. Data do dia saia trocada a noite.** Seis pontos usavam
   `new Date().toISOString().split('T')[0]`, que converte para UTC antes de cortar. No
   horario de Brasilia, das 21h a meia-noite o resultado ja e o dia seguinte: uma
   mensalidade quitada as 22h de 30/09 era gravada como paga em 01/10, e a comparacao
   de vencimento errava o dia. Centralizado em `src/lib/datas.js`.

### Criado

- `src/lib/datas.js`: `hojeISO` e `dataISO`, conversao no fuso de quem usa o app.
- `src/lib/datas.test.mjs`: check da conversao, incluindo o caso das 22h e o
  vencimento dia 5. Independente do fuso da maquina que roda o teste.

### Alterado

- `src/components/LiveMatchControl.jsx`: status do game.
- `src/components/Treasury.jsx` e `src/components/CommandCenter.jsx`: checagem de erro
  nas escritas de dinheiro e uso do helper de data.
- `src/components/Home.jsx` e `src/components/Rankings.jsx`: helper de data nas janelas
  de periodo.
- `supabase_v2.sql`: check e default de `games.status`.
- `package.json`: `npm test` roda os dois checks.

### Decisoes

- **Alinhar o codigo ao banco, nao o banco ao codigo.** Trocar `'in_progress'` por
  `'playing'` e uma linha e nao toca em producao. Alterar a constraint mexeria no banco
  com dados, exigiria migration e nao traria beneficio: `'playing'` ja convive com o
  default `'pending'` que existe la.
- **Nao removi `alert()` nem troquei por toast.** E o padrao do arquivo inteiro. Trocar
  o mecanismo de feedback seria refatoracao nao pedida, misturada com correcao.
- **Nao mexi nos atributos FIFA.** O banco tem check de 40 a 99 e os inputs sao
  `type="range" min="40" max="99"`. Conferido, nao ha divergencia.
- **Nao mexi nas outras 40 escritas sem checagem de erro.** Foram tratadas as de
  dinheiro, onde falha silenciosa vira prejuizo. As demais entram como pendencia, para
  nao inflar o diff desta correcao.

### Validacao executada

- `npm test`: passa, `standings: ok` e `datas: ok`.
- `npm run build`: passa, 1.632 modulos, 17,83s.
- Constraint verificada direto no Postgres de producao:
  `games_status_check` e `CHECK (status = ANY (ARRAY['pending','playing','finished']))`.
  Consulta de comprovacao no mesmo banco devolveu
  `valor_antigo_passa_no_check = false`, `valor_novo_passa_no_check = true`,
  `games_hoje = 0`.
- Conferidos contra o banco todos os outros valores de status gravados pelo codigo
  (`confirmations`, `matches`, `payments`): batem com os checks reais. `games` era o
  unico divergente.
- Varredura de artefatos de IA nos arquivos alterados: um unico apontamento, o
  `console.log` de saida do proprio arquivo de teste, que e intencional.

### Nao validado

- O fluxo do Live Match Control nao foi exercitado de ponta a ponta. Provar em runtime
  exigiria criar racha, sortear times e gravar jogos no banco de producao. A correcao
  esta comprovada no nivel da constraint, que era exatamente onde ela falhava, nao por
  execucao do fluxo.
- As baixas de mensalidade corrigidas nao foram executadas: exigiria mexer em cobranca
  real.
- O comportamento noturno da data foi coberto por teste, nao observado em producao as
  22h.

### Pendente

- Cerca de 40 escritas ao Supabase fora do modulo financeiro ainda descartam o retorno
  de erro.
- `Login.jsx`, `MatchDay.jsx` e `Profile.jsx` seguem orfaos. A remocao continua barrada
  pelo controle de permissao do ambiente.
- Achados do linter do Supabase seguem abertos: `public.rls_auto_enable()` e
  `SECURITY DEFINER` executavel por `anon`, duas funcoes com `search_path` mutavel, e a
  protecao contra senha vazada esta desligada no Auth.
- O racha de 10/03/2026 tem um time com 0 jogadores e mostra 30 gols com 0 jogos, por
  ter vindo de importacao de historico.

### Riscos

- Games criados a partir de agora nascem com `status = 'playing'`. Nenhum dado antigo
  muda, porque nao existe nenhum game gravado.
- A mudanca em `supabase_v2.sql` so afeta quem criar um ambiente novo. Bancos existentes
  nao sao tocados por este commit.

### Estrutura do projeto apos esta sessao

```
.gitignore
CHANGELOG.md
MANUAL-DO-USUARIO.md
README.md
index.html
package-lock.json
package.json
postcss.config.js
public/favicon.svg
public/icon-192.png
public/icon-512.png
public/logo.png
public/manifest.json
public/sw.js
src/App.jsx
src/components/Admin.jsx
src/components/AdminLogin.jsx
src/components/CommandCenter.jsx
src/components/Confirm.jsx
src/components/Home.jsx
src/components/Layout.jsx
src/components/LiveMatchControl.jsx
src/components/Login.jsx            (orfao)
src/components/MatchDay.jsx         (orfao)
src/components/MatchDetail.jsx
src/components/MatchList.jsx
src/components/MatchOperations.jsx
src/components/PlayerProfile.jsx
src/components/Players.jsx
src/components/Profile.jsx          (orfao)
src/components/Rankings.jsx
src/components/RosterCommand.jsx
src/components/Treasury.jsx
src/index.css
src/lib/datas.js
src/lib/datas.test.mjs
src/lib/standings.js
src/lib/standings.test.mjs
src/lib/supabase.js
src/main.jsx
supabase_v10_migration.sql
supabase_v2.sql
supabase_v9_migration.sql
tailwind.config.js
vercel.json
vite.config.js
```

---

## 2026-09-15

### Pedido

"leia, entenda, aprenda e decore tudo que tiver do app racha da santa", depois
"diagnostique e corrija", depois "faca tudo oq precisa ser feito".

### Contexto que mudou no meio da sessao

O diagnostico inicial foi feito sobre uma copia local que estava 4 commits atras do
`origin/main` (parada em `f416d10`, a v7). O remote ja tinha `7120c79` (redesign Elite
Tactical), `e441d03` (v9), `0e14908` e `caee20b` (v10). Quando o push foi recusado,
o trabalho foi refeito em cima do `origin/main` real. Dois dos cinco defeitos
diagnosticados ja tinham sido resolvidos upstream de outra forma:

- a tela `MatchList` passou a existir na v10;
- a divergencia entre rota e parametro foi resolvida mudando a rota para `/racha/:matchId`,
  em vez de mudar o `useParams`.

As correcoes locais desses dois pontos foram descartadas. O commit que as continha
ficou preservado na branch `fix/build-classificacao-e-storage`, fora da `main`.

### Corrigido

Tres defeitos que continuavam vivos na v10:

1. **Quem recusou presenca nao conseguia voltar atras.** Em `Confirm.jsx` havia dois
   caminhos de escrita, `toggleConfirmation` e `declinePlayer`, e a chamada do botao de
   visto achatava o estado `declined` para `null`. Isso caia no ramo de `insert` e batia
   na constraint `unique(match_id, player_id)`. O jogador tocava no visto e nada
   acontecia, sem nenhum aviso. Os dois caminhos viraram um so, `setStatus`, com
   `upsert`. O mesmo defeito existia em `addAvulso`, onde a checagem procurava o jogador
   por `player_id` sem olhar o status: o avulso que tinha recusado ficava preso.
2. **Campeao do dia podia divergir do lider da tabela.** `LiveMatchControl` elegia o
   campeao contando `winner_team_id`, sem desempate por saldo, enquanto `MatchDetail`
   montava a tabela lendo o placar e tratando empate como 1 ponto para cada lado. Eram
   duas contas separadas para a mesma coisa. Agora existe uma so, em `src/lib/standings.js`.
3. **Fallback offline do PWA nunca funcionou.** `sw.js` lia de um cache em que nunca
   escrevia, entao o `catch` do fetch caia em `undefined`. Passou a gravar respostas GET
   de mesma origem. As exclusoes de `/storage/v1/`, `/rest/v1/` e `/auth/v1/` que a v10
   ja tinha foram mantidas.

### Criado

- `src/lib/standings.js`: `computeStandings` e `championTeamId`, fonte unica da
  classificacao e da eleicao do campeao.
- `src/lib/standings.test.mjs`: check da regra, sem framework. Roda com `npm test`.
- `CHANGELOG.md` e `MANUAL-DO-USUARIO.md`.

### Alterado

- `src/components/Confirm.jsx`: caminho unico de escrita, e falha de gravacao agora
  aparece na tela em estado proprio (`saveError`), separado do `error` que substitui a
  pagina inteira quando o link e invalido. Os botoes ficaram com significado fixo, visto
  confirma e X recusa, e o estado ja ativo fica desabilitado.
- `src/components/MatchDetail.jsx`: a classificacao inline saiu, passou a usar
  `computeStandings`.
- `src/components/LiveMatchControl.jsx`: o campeao passou a sair de `championTeamId`.
- `public/sw.js`: grava no cache; `CACHE_NAME` de `v9` para `v10`, para que o
  `activate` limpe o cache antigo e o service worker novo assuma.
- `package.json`: script `test`.

### Decisoes

- **Empate decidido conta como vitoria na tabela.** O `README.md` declara a premissa:
  "empate = admin escolhe vencedor (simula pinalti)". Como a escolha e deliberada e o
  jogo nao fecha sem ela, quem estava errada era a tabela, que mostrava empate. A regra
  ficou numa constante unica, `EMPATE_DECIDIDO_VALE_VITORIA` em `src/lib/standings.js`:
  trocar para `false` faz empate voltar a valer 1 ponto para cada lado, na tabela e na
  eleicao do campeao ao mesmo tempo. Nao existe mais como as duas telas discordarem.
- **Campeao passou a considerar saldo de gols.** Antes, empate em numero de vitorias era
  resolvido por `Object.keys(...).find(...)`, ou seja, pela ordem em que os times
  voltavam do banco. Agora segue o criterio da tabela: pontos, saldo, gols marcados, nome.
- **Nao trouxe o `supabase_v3.sql` escrito antes.** O remote ja tem
  `supabase_v9_migration.sql` e `supabase_v10_migration.sql`, que cobrem `games`,
  `game_goals` e mais. Aquele arquivo teria sido schema duplicado e desatualizado.
- **`git branch -f` em vez de `git reset --hard`** para realinhar a `main` local com o
  remote. Move o ponteiro sem tocar em arquivo e sem descartar nada.

### Validacao executada

- `npm run build`: passa. 1.631 modulos, 24,45s.
- `npm test`: passa (`standings: ok`). O check cobre empate decidido virando vitoria e
  derrota, empate sem escolha voltando a 1 ponto, desempate por saldo, jogo em andamento
  fora da conta e ausencia de campeao sem jogos.
- Render real em Chromium headless contra o build de producao servido por
  `vite preview`, com os dados do Supabase de producao:
  - `/racha/459fd57d-c580-49e8-882e-d67a19ae4d7a` mostrou a sumula de 10/03/2026 com
    artilheiros (V. Miguel 5G, Wesley 5G, Leandro 4G), 30 gols e a escalacao dos 4 times.
  - `/confirmar/67a4088a5db2` mostrou o racha de 28/04/2026 com 14 confirmados e 2 recusas.
  - `/rachas` montou a tela de historico de partidas.
- Estado do banco no momento da sessao: 33 players, 2 matches, 35 confirmations,
  7 teams, 16 match_stats, 0 games, 0 game_goals, 5 contas em `auth.users`,
  13 arquivos no bucket `avatars`.

### Nao validado

- O fluxo de confirmacao corrigido nao foi exercitado em runtime. Os dois rachas
  existentes estao em `sorted` e `finished`, e a area de confirmacao so aparece com
  status `open`. Testar exigiria criar um racha e gravar confirmacoes no banco de
  producao. Coberto por build e revisao de logica, nao por execucao.
- A classificacao corrigida nao foi vista com dados: `games` tem 0 linhas, entao a
  tabela nao aparece em tela nenhuma ainda. Coberta pelo check automatizado.
- O `sw.js` novo nao foi testado com a rede desligada.
- Nao foi possivel testar upload de foto com conta autenticada nao-admin, porque as 5
  contas existentes sao todas de admin.

### Pendente

- `Login.jsx`, `MatchDay.jsx` e `Profile.jsx` continuam no repositorio sem ninguem
  importar (verificado por varredura de imports). A remocao foi tentada e **bloqueada
  pelo controle de permissao do ambiente**, que barra exclusao de arquivo. Precisa ser
  feita manualmente ou com permissao concedida.
- O racha de 10/03/2026 tem "Time D" com 0 jogadores, resultado de sortear 4 times com
  gente demais de fora. Vale conferir a regra de sorteio.
- Naquele mesmo racha o painel mostra "0 Jogos" apesar de 30 gols: os gols vieram por
  importacao de historico, sem `games` correspondentes.
- 1 conta em `auth.users` nao tem `player` correspondente. Quem logar com ela fica sem
  perfil. 1 player tem `role = 'admin'` com `user_id` nulo.

### Riscos

- Bump do `CACHE_NAME` para `v10` faz o service worker antigo ser substituido. Quem
  estiver com o app aberto pode precisar recarregar uma vez.
- `EMPATE_DECIDIDO_VALE_VITORIA = true` muda como rachas antigos apareceriam na tabela,
  se houvesse jogos registrados. Hoje nao ha (`games` vazia), entao nao ha efeito
  retroativo visivel.

### Estrutura do projeto apos esta sessao

```
.gitignore
CHANGELOG.md
MANUAL-DO-USUARIO.md
README.md
index.html
package-lock.json
package.json
postcss.config.js
public/favicon.svg
public/icon-192.png
public/icon-512.png
public/logo.png
public/manifest.json
public/sw.js
src/App.jsx
src/components/Admin.jsx
src/components/AdminLogin.jsx
src/components/CommandCenter.jsx
src/components/Confirm.jsx
src/components/Home.jsx
src/components/Layout.jsx
src/components/LiveMatchControl.jsx
src/components/Login.jsx            (orfao)
src/components/MatchDay.jsx         (orfao)
src/components/MatchDetail.jsx
src/components/MatchList.jsx
src/components/MatchOperations.jsx
src/components/PlayerProfile.jsx
src/components/Players.jsx
src/components/Profile.jsx          (orfao)
src/components/Rankings.jsx
src/components/RosterCommand.jsx
src/components/Treasury.jsx
src/index.css
src/lib/standings.js
src/lib/standings.test.mjs
src/lib/supabase.js
src/main.jsx
supabase_v10_migration.sql
supabase_v2.sql
supabase_v9_migration.sql
tailwind.config.js
vercel.json
vite.config.js
```

---

## 2026-09-15, banco de dados

### Feito

Aplicada a migration `restringe_avatars_a_admin` no projeto Supabase
`wourrnmhsnqynrfvkqay`, com autorizacao explicita.

### Motivo

As policies de `storage.objects` chamadas "Admin faz upload", "Admin atualiza foto" e
"Admin deleta foto" verificavam apenas `bucket_id = 'avatars'`. Apesar do nome, nao
checavam papel nenhum. Qualquer conta autenticada podia sobrescrever ou apagar as fotos
dos jogadores. As tres foram substituidas por versoes que exigem
`role = 'admin'`, junto com "Fotos publicas", que virou "Leitura publica avatars".
Leitura continua aberta, que e o que a URL publica das fotos exige.

Os nomes antigos precisaram ser removidos no mesmo passo: policies permissivas se somam
por OR, entao criar a versao restrita sem apagar a permissiva deixaria a regra fraca
valendo.

As policies qualificam `public.players`. A API de storage nao roda com o mesmo
`search_path` do PostgREST, e sem o schema explicito a subconsulta podia nao resolver.

### Validacao executada

- Leitura publica da mesma foto antes e depois: HTTP 200, 16.798 bytes nos dois casos.
  A exibicao de avatares nao quebrou.
- `get_advisors` de seguranca apos a mudanca: nenhum aviso de RLS ausente ou policy
  inconsistente em `storage.objects`.

### Nao validado

- A listagem direta de `pg_policies` apos a migration foi bloqueada pelo controle de
  permissao do ambiente. O estado foi confirmado por via indireta.
- A negacao para conta autenticada nao-admin esta apoiada no texto da policy, nao em
  teste, porque nao existe conta desse tipo hoje.

### Achados nao corrigidos

Do linter de seguranca do Supabase, todos anteriores a esta sessao:

- `public.rls_auto_enable()` e `SECURITY DEFINER` e pode ser executada por `anon` e por
  `authenticated` via `/rest/v1/rpc/rls_auto_enable`.
- `public.mark_overdue_payments` e `public.update_updated_at` com `search_path` mutavel.
- Protecao contra senha vazada desligada no Supabase Auth.
