// Classificacao do racha a partir dos jogos. Fonte unica: a tabela que aparece
// em MatchDetail e a eleicao do campeao em LiveMatchControl usam esta mesma regra.
// Antes eram duas contas separadas e elas divergiam: o campeao era eleito contando
// games.winner_team_id, enquanto a tabela lia o placar, entao um jogo empatado
// valia vitoria de um lado e empate do outro.
//
// Regra da casa (v10): jogo empatado nao fecha sozinho. Quem opera o racha escolhe
// quem leva, e essa escolha vai para winner_team_id. Por isso o empate decidido
// conta como vitoria de quem foi escolhido, e nao como empate dos dois lados.
//
// Para tratar empate como empate de verdade, inclusive na eleicao do campeao,
// troque a constante abaixo para false. E o unico lugar a mudar.
const EMPATE_DECIDIDO_VALE_VITORIA = true

export function computeStandings(teams, games) {
  const finished = games.filter(g => g.status === 'finished')

  return teams.map(team => {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, gamesPlayed = 0

    finished.forEach(g => {
      let mine, theirs
      if (g.team_a_id === team.id) { mine = g.score_a; theirs = g.score_b }
      else if (g.team_b_id === team.id) { mine = g.score_b; theirs = g.score_a }
      else return

      gamesPlayed++
      goalsFor += mine
      goalsAgainst += theirs

      if (mine > theirs) wins++
      else if (mine < theirs) losses++
      else if (EMPATE_DECIDIDO_VALE_VITORIA && g.winner_team_id) {
        if (g.winner_team_id === team.id) wins++
        else losses++
      } else draws++
    })

    return {
      id: team.id, name: team.name, won: team.won,
      gamesPlayed, wins, draws, losses,
      goalsFor, goalsAgainst,
      goalDiff: goalsFor - goalsAgainst,
      points: wins * 3 + draws,
    }
  }).sort((a, b) =>
    b.points - a.points ||
    b.goalDiff - a.goalDiff ||
    b.goalsFor - a.goalsFor ||
    a.name.localeCompare(b.name)
  )
}

// Campeao do dia: o primeiro da classificacao. Retorna null se ninguem jogou,
// para nao coroar um time que nao entrou em campo.
export function championTeamId(teams, games) {
  const table = computeStandings(teams, games)
  const leader = table[0]
  return leader && leader.gamesPlayed > 0 ? leader.id : null
}
