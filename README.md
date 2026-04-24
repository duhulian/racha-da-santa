# Racha da Santa v10 - Elite Tactical Full Build

PWA de gestao do racha semanal (tercas na Arena Santa) com controle ao vivo, tesouraria e dashboard admin.

## O que mudou em relacao a v9

v10 e uma entrega grande com 5 blocos novos + 1 correcao. Segue mudanca por mudanca.

### Bloco 1 - Bug fix: Centro de Comando > Partidas

Ao selecionar um racha finalizado no dropdown, nada aparecia. Isso foi consertado:

- Se o racha ja esta `sorted` mas ainda sem games, mostra os times formados
- Se ja tem games registrados, lista jogo a jogo com placar e artilheiros
- Se ja finalizou, aparece campeao, artilharia e assistencias do dia
- Se o racha nao tem nenhum dado (importado do historico sem games), aparece mensagem explicativa ao inves de tela em branco

### Bloco 2 - Roster Command (tela Jogadores redesenhada)

Nova tela de elenco com:

- **Recruit Player form** com seletor visual de posicao (botoes coloridos GK/DEF/MID/FW)
- **Stats FIFA colapsaveis** (OVR, PAC, SHO, PAS, DRI, DEF, PHY) que alimentam o sorteio balanceado
- **Grid de mensalistas** com foto circular de borda colorida por posicao, apelido em destaque, numero da camisa fantasma, overall grande e coroa dourada se for admin
- **Guest Pool** lateral com todos os jogadores avulsos/convidados, botao de "promover pra mensalista" em 1 clique
- **Upload de foto** direto do card (redimensiona 400x400 JPEG 80% no navegador, sobe pro Supabase Storage)
- **Mensalidade por jogador** configurada no cadastro (default R$ 50)
- **Filtro por posicao** e busca por nome/apelido

### Bloco 3 - Match Operations (tela Rachas redesenhada)

Nova tela de gestao de rachas com 2 colunas:

- **Deploy Match** (esquerda): form de criar racha com nome, data, horario, local, Team Matrix (2/3/4 times padrao) e campo "Tactical Notes" em textarea
- **Active Log** (direita): lista dos rachas com stripe colorido lateral por status (OPEN ENTRY / SORTED / FINISHED), info completa, botoes de acao
  - Copiar link de confirmacao
  - Compartilhar WhatsApp (mensagem inclui tactical_notes)
  - Sortear times (2/3/4) usando snake draft balanceado por overall com 1 goleiro por time
  - Abrir Live Match Control (so aparece em rachas sorted)
  - Ver matriz/resultados (leva pro /racha/:id publico)
  - Excluir racha

### Bloco 4 - Live Match Control (NOVO)

Controle ao vivo de um matchday inteiro numa unica tela. Regras que estao codadas:

- **Fila de times**: 2 times jogam, os outros esperam. Vencedor fica, perdedor vai pro fim da fila
- **Tempo por game**: 10 minutos OU 2 gols (o que vier primeiro). Auto-pausa nos dois casos
- **Empate**: quando termina 0-0, 1-1, 2-2, o admin escolhe o vencedor manualmente (considerando que vao resolver em penalti)
- **Cronometro client-side** com Play/Pause, progress bar colorida (fica vermelha quando atinge limite)
- **Record Event**: modal pra adicionar gol com autor/assistente
- **System Suggestion**: card lateral que sugere o proximo confronto baseado no quem esta vencendo e na fila
- **Match Log**: historico dos games finalizados do dia
- **Team Queue**: fila visualizada com numeros de ordem
- **Encerrar Matchday**: agrega todos os gols/assists em match_stats, define o campeao (time com mais vitorias), muda status do racha pra finished e atualiza rankings

Limitacao conhecida: se o admin fechar a aba com game em andamento, os gols ainda nao salvos sao perdidos. O game fica marcado como `in_progress` no banco e pode ser descartado ao reabrir. Isso esta documentado pra melhoria futura.

### Bloco 5 - Treasury (NOVO)

Tela financeira com 3 sub-abas:

- **Visao geral (Overview)**: 3 KPIs (Total do mes, Arrecadado, Pendente) + lista de Pendentes do mes atual + card da proxima taxa da quadra
- **Pagamentos (Ledger)**: lista completa de mensalidades do mes com status chips, botao "Gerar cobrancas do mes" (cria mensalidades em lote pros mensalistas que ainda nao tem no mes), botao pra cadastrar individual, marcar como pago, desfazer
- **Quadra (Fees)**: gestao de pitch_fees (proximas cobrancas de aluguel) com data de vencimento, valor total, valor por jogador, descricao

Funcionalidades:

- **Gerar cobrancas do mes inteiro** em 1 clique baseado no cadastro (monthly_fee de cada jogador)
- **Marcar como pago** com data do pagamento automatica
- **Notificar via WhatsApp**: abre wa.me com mensagem pronta incluindo nome, valor, mes de referencia
- **Auto-overdue**: pagamentos pendentes cujo vencimento ja passou sao marcados como atrasados
- **Seletor de mes** com 12 meses disponiveis (6 antes e 6 depois do atual)

### Bloco 6 - Command Center (Dashboard admin novo)

Dashboard que abre quando o admin loga. Agrupa:

- **Session code** gerado (RDST-XXXX-X estilo militar)
- **4 mini-KPIs** (Elenco, Rachas totais, Rachas no mes, Mensalidades pendentes)
- **Next Match Banner** com status, confirmados, botao "Gerenciar" e botao "Live Match Control" (se ja sorteado)
- **Treasury Overview** compact: Arrecadado, Pendente, Proxima Quadra + top 3 inadimplentes com notify WhatsApp + marcar como pago direto
- **Quick Entry** lateral: adiciona gol/assist rapido pra qualquer racha sem abrir o painel de partidas
- **Tactical Draw Engine**: lista jogadores agrupados por posicao (Atacantes/Meias/Zagueiros/Goleiros) ordenados por overall, com quick link pra tela de sorteio

## Nova estrutura de abas do Admin

Antes (v9): Rachas | Partidas | Jogadores | Historico

Agora (v10): **Dashboard** | Rachas | Partidas | Jogadores | **Financeiro** | Historico

Mais um modo overlay "Live Match Control" que ocupa a tela inteira quando ativado.

## Novas tabelas no Supabase

### `payments`
Mensalidades individuais com mes de referencia, status, metodo de pagamento.

### `pitch_fees`
Taxas da quadra (aluguel) com vencimento, valor total, descricao.

### `match_live_state`
Estado ao vivo de um matchday: fila de times (JSONB), game atual, cronometro.

## Novos campos em tabelas existentes

- `players.monthly_fee` (numeric) - valor da mensalidade individual
- `players.guest_notes` (text) - observacao pros convidados
- `players.role` agora aceita `'guest'` alem de `'player'` e `'admin'`
- `matches.tactical_notes` (text) - observacoes taticas do racha
- `games.started_at` / `finished_at` / `duration_seconds` - timing dos jogos
- `game_goals.minute` - minuto do gol

## Como instalar esta versao

### Passo 1 - Rodar migration SQL no Supabase

1. Abrir **Supabase Dashboard** do projeto racha-da-santa
2. Ir em **SQL Editor** (menu lateral)
3. Clicar em **New Query**
4. Colar TODO o conteudo do arquivo `supabase_v10_migration.sql`
5. Clicar em **Run**
6. Deve aparecer "Success. No rows returned."

A migracao e nao-destrutiva. Nao apaga nada, so adiciona.

### Passo 2 - Deixar o bucket de avatars publico (se ainda nao fez)

1. Ainda no Supabase, ir em **Storage**
2. Clicar no bucket **avatars**
3. Clicar em **Bucket settings** (engrenagem)
4. Ativar toggle **Public bucket**
5. Salvar

Teste abrindo esta URL, deve mostrar alguma foto (se ja tiver subido):

```
https://wourrnmhsnqynrfvkqay.supabase.co/storage/v1/object/public/avatars/SEU_PLAYER_ID_timestamp.jpg
```

### Passo 3 - Subir codigo novo no Git

No seu PC Windows (CMD):

```
cd C:\Users\edu_d\Downloads\racha-da-santa
git checkout novo-layout
```

Abrir o ZIP `racha-da-santa-v10.zip` (que vem junto com esse README) e:

1. Apagar a pasta local `src/components` (guarde um backup se quiser)
2. Copiar a pasta `src/components` do ZIP pra dentro de `src/`
3. Copiar tambem: `supabase_v10_migration.sql` (raiz) e substituir `README.md`

No CMD:

```
git add .
git commit -m "feat: v10 - command center, live match control, treasury, roster command"
git push
```

Ir no GitHub, abrir Pull Request de `novo-layout` pra `main`, mergear.

O Vercel deploya automatico em uns 2 minutos.

## Premissas que adotei (me fala se alguma esta errada)

1. **Racha ao vivo**: 2 times jogam, vencedor fica, perdedor fim da fila, empate = admin escolhe vencedor (simula pinalti). Tempo 10min OU 2 gols por game
2. **Mensalidade**: R$ 50 default, configuravel por jogador. Vence dia 5 do mes
3. **Notificacao**: abre link wa.me (WhatsApp Web) com mensagem pronta pro destinatario manual. Nao envia email
4. **Guest Pool**: jogadores com `role='guest'` OR `player_type='avulso'`. Promover vira `role='player'` + `player_type='mensalista'`
5. **Chat de racha**: botao compartilhar abre wa.me com mensagem pronta. Nao tem chat interno no app
6. **Link de convite**: mantido igual ao v9 (pagina publica /confirmar/:token)
7. **So admin controla ao vivo**: jogador nao admin nao tem acesso ao Live Match Control

## Como testar depois do deploy

1. Login como admin no /admin/login
2. Na aba **Dashboard**, deve aparecer o Command Center completo
3. Ir em **Financeiro** > clicar em "Gerar cobrancas do mes" pra criar as mensalidades do mes atual
4. Ir em **Rachas** > criar um racha de teste > copiar link > abrir em aba anonima > confirmar uns jogadores > voltar pro admin > sortear times > clicar em "Live Match Control"
5. Testar iniciar game, marcar gol, finalizar game, ver fila reorganizada, rodar 2-3 games, encerrar matchday
6. Abrir aba **Partidas**, selecionar o racha recem-finalizado > confirmar que mostra times, games e artilharia
7. Ir em **Jogadores** > ver cards redesenhados > tentar promover um guest (se tiver)

## Stack

- React 18.3.1 + Vite 6.0.2
- Tailwind 3.4.17 com design tokens Elite Tactical
- Supabase (Postgres + Auth + Storage + RLS)
- React Router 7.1.1
- Lucide React para icones
- Deploy: Vercel

## Contas de admin existentes (da base v9)

Eduardo/Duzao, Antonio, Raphael/R11, Pedro

## Arquivos novos nesta release

```
supabase_v10_migration.sql      # rodar no SQL Editor antes do deploy
src/components/CommandCenter.jsx     # dashboard admin principal
src/components/LiveMatchControl.jsx  # controle ao vivo do matchday
src/components/MatchOperations.jsx   # deploy match + active log
src/components/RosterCommand.jsx     # elenco + guest pool
src/components/Treasury.jsx          # mensalidades + pitch fees
src/components/Admin.jsx             # REESCRITO - orquestrador com 6 tabs
README.md                            # este arquivo
```

Arquivos nao tocados (manter o que ja tinha):

```
src/components/Home.jsx
src/components/Layout.jsx
src/components/MatchList.jsx
src/components/MatchDetail.jsx
src/components/Players.jsx
src/components/PlayerProfile.jsx
src/components/Rankings.jsx
src/components/Confirm.jsx
src/components/AdminLogin.jsx
src/App.jsx
src/main.jsx
src/lib/supabase.js
src/index.css
tailwind.config.js
vite.config.js
vercel.json
package.json
index.html
public/*
```

---

Build validado com `npm run build` rodando sem erros. Bundle final: 556 kB (gzip 147 kB).
