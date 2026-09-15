// Check da regra de classificacao. Rodar: npm test
import assert from 'node:assert/strict'
import { computeStandings, championTeamId } from './standings.js'

const teams = [{ id: 'A', name: 'Time A' }, { id: 'B', name: 'Time B' }, { id: 'C', name: 'Time C' }]
const g = (a, b, sa, sb, winner, status = 'finished') => ({
  team_a_id: a, team_b_id: b, score_a: sa, score_b: sb, winner_team_id: winner, status,
})

// A vence B por 2x0. A empata com C em 1x1 e quem opera escolhe C para levar.
const games = [g('A', 'B', 2, 0, 'A'), g('A', 'C', 1, 1, 'C')]
const table = computeStandings(teams, games)
const by = id => table.find(t => t.id === id)

assert.equal(by('A').wins, 1)
assert.equal(by('A').losses, 1, 'empate decidido contra A conta como derrota')
assert.equal(by('A').draws, 0)
assert.equal(by('A').points, 3)

assert.equal(by('C').wins, 1, 'empate decidido a favor de C conta como vitoria')
assert.equal(by('C').points, 3)
assert.equal(by('C').goalDiff, 0, 'o placar do empate continua 1x1 no saldo')

// A e C tem 3 pontos. Desempate por saldo: A tem +2, C tem 0.
assert.equal(table[0].id, 'A', 'lider por saldo de gols')
assert.equal(championTeamId(teams, games), 'A')

// A tabela e o campeao saem da mesma conta: o lider e o campeao.
assert.equal(championTeamId(teams, games), table[0].id)

// Empate sem escolha registrada volta a valer 1 ponto para cada lado.
const semEscolha = computeStandings(teams, [g('A', 'C', 1, 1, null)])
assert.equal(semEscolha.find(t => t.id === 'A').draws, 1)
assert.equal(semEscolha.find(t => t.id === 'A').points, 1)

// Jogo em andamento nao entra na conta.
assert.equal(computeStandings(teams, [g('A', 'B', 5, 0, 'A', 'playing')])[0].gamesPlayed, 0)

// Sem jogo nenhum nao existe campeao.
assert.equal(championTeamId(teams, []), null)

console.log('standings: ok')
