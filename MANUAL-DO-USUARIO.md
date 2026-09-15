# Manual do Usuario, Racha Da Santa

App de gestao do racha de futebol. Funciona no celular como aplicativo: abra o site no
navegador e escolha "adicionar a tela de inicio".

Versao 10. Atualizado em 15/09/2026.

Este manual descreve o uso. As notas tecnicas da release estao no `README.md` e o
historico de alteracoes no `CHANGELOG.md`.

---

## 1. Para quem so joga

Voce nao precisa de conta, senha nem cadastro. Tudo acontece pelo link que o
organizador manda no grupo.

### Confirmar presenca

1. Abra o link recebido no WhatsApp. Ele tem a cara de `.../confirmar/67a4088a5db2`.
2. A pagina mostra a data do racha e a lista dos mensalistas.
3. Ache seu nome e toque no visto para confirmar, ou no X para avisar que nao vai.
4. Pode mudar de ideia quantas vezes quiser enquanto o racha estiver aberto. Toque no
   outro botao. O botao do estado em que voce ja esta fica apagado, entao da para ver
   de relance o que esta valendo.

Quem confirmou aparece em "Confirmados", numerado por ordem de chegada. Quem recusou
aparece em "Nao vou".

Se aparecer "Nao foi possivel salvar. Tente de novo.", a gravacao falhou, normalmente
por internet instavel. Toque de novo. Nada do que voce escolheu antes se perde.

### Sou convidado, nao mensalista

No mesmo link, desca ate o bloco de jogador avulso, digite seu nome e confirme. Voce
entra na lista como avulso. Se ja jogou antes com esse mesmo nome, o app reaproveita seu
cadastro em vez de criar outro. Se voce tinha recusado e mudou de ideia, digitar o nome
de novo reconfirma.

### Acompanhar

Pelo menu de baixo:

- **Inicio**: visao geral do racha, proximos jogos e numeros da temporada.
- **Rachas**: historico de partidas, do mais novo para o mais antigo.
- **Rankings**: gols, assistencias e presencas, por periodo.
- **Elenco**: os jogadores, com posicao, numero e foto.

Tocando em um racha ja sorteado ou encerrado, voce ve a sumula: destaques, artilheiros,
a escalacao de cada time e, quando houver jogos registrados, a tabela de classificacao.

### O que cada situacao de racha quer dizer

| Situacao | O que significa |
|---|---|
| Aberto | Da para confirmar ou desmarcar presenca |
| Sorteado | Times definidos, confirmacao fechada, jogos podem comecar |
| Finalizado | Racha encerrado, resultado ja conta nos rankings |

### Como a classificacao e contada

Cada jogo vale 3 pontos para quem vence e 1 para cada lado no empate. Desempate por
saldo de gols, depois gols marcados.

Quando um jogo termina empatado, quem organiza escolhe o time que leva, simulando a
decisao por penalti. Esse jogo entra na tabela como vitoria de quem foi escolhido e
derrota do outro, e o placar continua contando normal no saldo.

O campeao do dia e o primeiro colocado dessa mesma tabela. Antes o campeao era contado
de um jeito e a tabela de outro, e os dois podiam discordar; agora saem da mesma conta.

---

## 2. Para quem organiza (admin)

Entre em `/admin/login` com email e senha. Depois de entrar aparece a aba **Admin**.

O painel tem as abas **Dashboard**, **Rachas**, **Partidas**, **Jogadores**,
**Financeiro** e **Historico**, mais o modo **Live Match Control**, que ocupa a tela
inteira durante o racha.

### Rachas

Criar o racha com data e observacao, copiar o link de confirmacao ou disparar direto no
WhatsApp com a mensagem pronta, e sortear os times quando a lista fechar. Quem sobra vai
para a Lista de Espera.

### Live Match Control

O modo usado durante o jogo: cronometro, placar, registro de gol com autor e
assistencia, fila de times e encerramento do matchday.

Regra em vigor: dois times em campo, o vencedor fica, o perdedor vai para o fim da fila.
**Jogo empatado nao fecha sozinho**, voce escolhe quem leva. Essa escolha conta como
vitoria na tabela.

Ao encerrar o matchday, o app soma gols e assistencias de todos, define o time campeao
pelo lider da classificacao e libera o resultado nos rankings.

### Jogadores

Cadastro de mensalistas e convidados, posicao, numero, foto de perfil e promocao de
avulso para mensalista.

### Financeiro

Mensalidades por jogador e taxas da quadra, com geracao de cobrancas do mes.

### Historico

Lancamento de rachas antigos, anteriores ao app: data, quem jogou, gols e assistencias.
Entra ja finalizado e passa a contar nos rankings.

---

## 3. Perguntas frequentes

**Confirmei e depois desmarquei. Perdi a vaga?**
Nao. A ordem so importa se aparecer mais gente do que vaga, e nesse caso quem sobra vai
para a lista de espera no sorteio.

**Digitei meu nome como avulso duas vezes, criei dois cadastros?**
Nao. O app procura um avulso com o mesmo nome antes de criar outro.

**O app abre sem internet?**
Abre o que ja foi carregado antes, mas nao mostra dados atualizados. Confirmar presenca,
sortear e registrar gol precisam de conexao.

**Depois de uma atualizacao o app ficou estranho.**
Recarregue a pagina uma vez. O app troca a versao guardada no celular quando detecta
uma nova.

**Sou mensalista e nao consigo entrar no admin.**
A area de admin e so para quem organiza. Jogador nao precisa de login para nada.

---

## 4. Estrutura do projeto

Para quem for mexer no codigo.

```
.gitignore
CHANGELOG.md                         historico de alteracoes, append-only
MANUAL-DO-USUARIO.md                 este arquivo
README.md                            notas tecnicas da release v10
index.html
package-lock.json
package.json
postcss.config.js
public/favicon.svg
public/icon-192.png
public/icon-512.png
public/logo.png
public/manifest.json                 identidade do app instalavel
public/sw.js                         service worker, cache de emergencia
src/App.jsx                          rotas e sessao
src/components/Admin.jsx             painel e abas
src/components/AdminLogin.jsx        login do organizador
src/components/CommandCenter.jsx     dashboard do admin
src/components/Confirm.jsx           pagina publica de confirmacao
src/components/Home.jsx              inicio
src/components/Layout.jsx            cabecalho e menu inferior
src/components/LiveMatchControl.jsx  controle do racha ao vivo
src/components/Login.jsx             NAO USADO, desenho antigo
src/components/MatchDay.jsx          NAO USADO, desenho antigo
src/components/MatchDetail.jsx       sumula do racha
src/components/MatchList.jsx         historico de partidas
src/components/MatchOperations.jsx   operacao dos rachas
src/components/PlayerProfile.jsx     perfil do jogador
src/components/Players.jsx           elenco
src/components/Profile.jsx           NAO USADO, desenho antigo
src/components/Rankings.jsx          rankings por periodo
src/components/RosterCommand.jsx     gestao do elenco
src/components/Treasury.jsx          financeiro
src/index.css
src/lib/standings.js                 regra unica de classificacao e campeao
src/lib/standings.test.mjs           check da regra de pontuacao
src/lib/supabase.js                  cliente do Supabase
src/main.jsx
supabase_v10_migration.sql
supabase_v2.sql                      schema base (APAGA TUDO, so em ambiente novo)
supabase_v9_migration.sql
tailwind.config.js
vercel.json
vite.config.js
```

Comandos: `npm run dev` para desenvolver, `npm run build` para gerar o site,
`npm run preview` para servir o site gerado, `npm test` para rodar o check da regra de
classificacao.

Para mudar como o empate conta, edite a constante `EMPATE_DECIDIDO_VALE_VITORIA` em
`src/lib/standings.js`. E o unico lugar: a tabela e a eleicao do campeao usam a mesma
funcao, entao nao ha como as duas telas discordarem.
