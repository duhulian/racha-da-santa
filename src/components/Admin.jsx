import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Shuffle, Save, Trophy, UserCog, Trash2, Link, Share2, Check, Pencil, Camera, X, History, Play, Square, ChevronDown } from 'lucide-react'

const TEAM_SIZE = 7

export default function Admin() {
  const [tab, setTab] = useState('match')
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: m } = await supabase.from('matches').select('*').order('date', { ascending: false }).limit(50)
    setMatches(m || [])
    const { data: p } = await supabase.from('players').select('*').order('player_type').order('name')
    setPlayers(p || [])
    setLoading(false)
  }

  const tabs = [
    { key: 'match', label: 'Rachas' },
    { key: 'games', label: 'Partidas' },
    { key: 'players', label: 'Jogadores' },
    { key: 'history', label: 'Historico' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <UserCog size={20} className="text-gold-400" /> Painel Admin
      </h2>
      <div className="flex gap-1.5 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap px-2 ${
              tab === t.key ? 'bg-gold-400 text-navy-900' : 'bg-navy-800 text-slate-400'
            }`}>{t.label}</button>
        ))}
      </div>
      {loading ? <div className="text-center py-8 text-slate-400">Carregando...</div> : (
        <>
          {tab === 'match' && <MatchTab matches={matches} onReload={loadData} />}
          {tab === 'games' && <GamesTab matches={matches} players={players} onReload={loadData} />}
          {tab === 'players' && <PlayersTab players={players} onReload={loadData} />}
          {tab === 'history' && <HistoryTab players={players} onReload={loadData} />}
        </>
      )}
    </div>
  )
}

// ============================================
// ABA: RACHAS (criar, link, sortear)
// ============================================
function MatchTab({ matches, onReload }) {
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [numTeams, setNumTeams] = useState(2)

  async function createMatch() {
    if (!newDate) return
    setSaving(true)
    const { data: me } = await supabase.from('players').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    await supabase.from('matches').insert({ date: newDate, notes: notes || null, created_by: me.id, status: 'open' })
    setNewDate(''); setNotes(''); setSaving(false); onReload()
  }
  function getConfirmLink(token) { return `${window.location.origin}/confirmar/${token}` }
  function copyLink(token) { navigator.clipboard.writeText(getConfirmLink(token)); setCopiedId(token); setTimeout(() => setCopiedId(''), 2000) }
  function shareWhatsApp(match) {
    const link = getConfirmLink(match.token)
    const d = new Date(match.date + 'T12:00:00')
    const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    window.open(`https://wa.me/?text=${encodeURIComponent(`⚽ *RACHA DA SANTA*\n📅 ${dateStr}\n\nConfirme sua presenca:\n${link}`)}`, '_blank')
  }
  async function sortTeams(matchId) {
    const { data: confs } = await supabase.from('confirmations').select('player_id').eq('match_id', matchId).eq('status', 'confirmed')
    if (!confs || confs.length < numTeams * 2) { alert(`Precisa de pelo menos ${numTeams * 2} confirmados.`); return }
    const { data: oldTeams } = await supabase.from('teams').select('id').eq('match_id', matchId)
    if (oldTeams) { for (const t of oldTeams) { await supabase.from('team_players').delete().eq('team_id', t.id) }; await supabase.from('teams').delete().eq('match_id', matchId) }
    const ids = confs.map(c => c.player_id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]] }
    const total = numTeams * TEAM_SIZE; const tp = ids.slice(0, Math.min(total, ids.length)); const wl = ids.slice(Math.min(total, ids.length))
    const names = ['Time A', 'Time B', 'Time C', 'Time D']
    for (let t = 0; t < numTeams; t++) {
      const { data: team } = await supabase.from('teams').insert({ match_id: matchId, name: names[t] }).select().single()
      const s = t * TEAM_SIZE; const e = Math.min(s + TEAM_SIZE, tp.length); const pl = tp.slice(s, e)
      if (pl.length > 0) await supabase.from('team_players').insert(pl.map(pid => ({ team_id: team.id, player_id: pid })))
    }
    if (wl.length > 0) { const { data: w } = await supabase.from('teams').insert({ match_id: matchId, name: 'Lista de Espera' }).select().single(); await supabase.from('team_players').insert(wl.map(pid => ({ team_id: w.id, player_id: pid }))) }
    await supabase.from('matches').update({ status: 'sorted' }).eq('id', matchId); onReload()
  }
  async function deleteMatch(matchId) { if (!confirm('Excluir este racha?')) return; await supabase.from('matches').delete().eq('id', matchId); onReload() }

  const sc = { open: 'bg-green-500/20 text-green-400', sorted: 'bg-blue-500/20 text-blue-400', finished: 'bg-slate-500/20 text-slate-400' }
  const sl = { open: 'Aberto', sorted: 'Sorteado', finished: 'Finalizado' }

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400">Criar novo racha</h3>
        <div><label className="block text-xs text-slate-400 mb-1">Data</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" /></div>
        <div><label className="block text-xs text-slate-400 mb-1">Observacoes (opcional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" placeholder="Ex: Campo diferente..." /></div>
        <button onClick={createMatch} disabled={saving || !newDate} className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          <Plus size={16} /> {saving ? 'Criando...' : 'Criar Racha'}</button>
      </div>
      <div className="space-y-2">
        {matches.map(match => {
          const d = new Date(match.date + 'T12:00:00'); const fmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return (
            <div key={match.id} className="bg-navy-800 rounded-xl p-3 space-y-2 border border-navy-700">
              <div className="flex items-center gap-3">
                <div className="flex-1"><p className="text-white text-sm font-medium">{fmt}</p><span className={`text-xs px-2 py-0.5 rounded-full ${sc[match.status]}`}>{sl[match.status]}</span></div>
                {match.status !== 'finished' && <button onClick={() => deleteMatch(match.id)} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-1.5 rounded-lg transition"><Trash2 size={14} /></button>}
              </div>
              {match.status !== 'finished' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(match.token)} className="flex-1 bg-navy-700 hover:bg-navy-600 text-slate-300 py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5">
                      {copiedId === match.token ? <><Check size={14} /> Copiado!</> : <><Link size={14} /> Copiar link</>}</button>
                    <button onClick={() => shareWhatsApp(match)} className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5"><Share2 size={14} /> WhatsApp</button>
                  </div>
                  {match.status === 'open' && (
                    <div className="flex gap-2 items-center">
                      <select value={numTeams} onChange={(e) => setNumTeams(parseInt(e.target.value))} className="bg-navy-700 text-white rounded-lg p-2 text-xs outline-none">
                        <option value={2}>2 Times</option><option value={3}>3 Times</option><option value={4}>4 Times</option></select>
                      <button onClick={() => sortTeams(match.id)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5"><Shuffle size={14} /> Sortear ({numTeams}x{TEAM_SIZE})</button>
                    </div>)}
                </div>)}
            </div>)
        })}
      </div>
    </div>
  )
}

// ============================================
// ABA: PARTIDAS (registrar jogos de 7 min)
// ============================================
function GamesTab({ matches, players, onReload }) {
  const [selectedMatch, setSelectedMatch] = useState('')
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [teamPlayers, setTeamPlayers] = useState({})
  const [saving, setSaving] = useState(false)

  // Estado do jogo atual sendo registrado
  const [currentTeamA, setCurrentTeamA] = useState('')
  const [currentTeamB, setCurrentTeamB] = useState('')
  const [goals, setGoals] = useState([])

  const sortedMatches = matches.filter(m => m.status === 'sorted' || m.status === 'finished')
  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')

  useEffect(() => { if (selectedMatch) loadMatchData() }, [selectedMatch])

  async function loadMatchData() {
    const { data: t } = await supabase.from('teams')
      .select('*, team_players(player_id, players(id, name, nickname, position))').eq('match_id', selectedMatch)
    setTeams(t || [])

    // Montar mapa de jogadores por time
    const tpMap = {}
    t?.forEach(team => {
      tpMap[team.id] = team.team_players?.map(tp => tp.players) || []
    })
    setTeamPlayers(tpMap)

    const { data: g } = await supabase.from('games')
      .select('*, game_goals(*, scorer:scorer_id(name, nickname), assister:assist_id(name, nickname))')
      .eq('match_id', selectedMatch).order('game_number', { ascending: true })
    setGames(g || [])

    // Sugerir proximo jogo
    if (g && g.length === 0 && t) {
      const regular = t.filter(tm => tm.name !== 'Lista de Espera')
      if (regular.length >= 2) { setCurrentTeamA(regular[0].id); setCurrentTeamB(regular[1].id) }
    } else if (g && g.length > 0) {
      const lastGame = g[g.length - 1]
      if (lastGame.status === 'finished') suggestNextGame(g, t || [])
    }
  }

  function suggestNextGame(gamesList, teamsList) {
    const regular = teamsList.filter(t => t.name !== 'Lista de Espera')
    if (regular.length < 2) return

    const lastGame = gamesList[gamesList.length - 1]
    if (!lastGame || !lastGame.winner_team_id) return

    const winnerId = lastGame.winner_team_id
    const loserId = lastGame.team_a_id === winnerId ? lastGame.team_b_id : lastGame.team_a_id

    // Proximo time que nao jogou no ultimo jogo
    const teamsInLastGame = [lastGame.team_a_id, lastGame.team_b_id]
    const nextTeam = regular.find(t => !teamsInLastGame.includes(t.id))

    if (nextTeam) {
      setCurrentTeamA(winnerId)
      setCurrentTeamB(nextTeam.id)
    } else if (regular.length === 2) {
      setCurrentTeamA(lastGame.team_a_id)
      setCurrentTeamB(lastGame.team_b_id)
    }
  }

  function addGoal(teamId, scorerId, assistId) {
    setGoals(prev => [...prev, { teamId, scorerId, assistId: assistId || null }])
  }

  function removeGoal(index) {
    setGoals(prev => prev.filter((_, i) => i !== index))
  }

  async function finishGame() {
    if (!currentTeamA || !currentTeamB) return
    setSaving(true)

    const scoreA = goals.filter(g => g.teamId === currentTeamA).length
    const scoreB = goals.filter(g => g.teamId === currentTeamB).length

    // Determinar vencedor. Empate: time mais antigo em campo sai (team A e o que ja estava)
    let winnerId = null
    if (scoreA > scoreB) winnerId = currentTeamA
    else if (scoreB > scoreA) winnerId = currentTeamB
    else winnerId = currentTeamB // empate: team A (mais antigo) sai, team B "vence"

    const gameNumber = games.length + 1

    const { data: game } = await supabase.from('games').insert({
      match_id: selectedMatch, game_number: gameNumber,
      team_a_id: currentTeamA, team_b_id: currentTeamB,
      score_a: scoreA, score_b: scoreB,
      winner_team_id: winnerId, status: 'finished'
    }).select().single()

    if (game && goals.length > 0) {
      await supabase.from('game_goals').insert(
        goals.map(g => ({ game_id: game.id, team_id: g.teamId, scorer_id: g.scorerId, assist_id: g.assistId }))
      )
    }

    setGoals([])
    setSaving(false)
    loadMatchData()
  }

  async function finalizeRacha() {
    if (!confirm('Finalizar este racha? Os rankings serao atualizados.')) return
    setSaving(true)

    // Calcular totais por jogador a partir dos game_goals
    const { data: allGoals } = await supabase.from('game_goals')
      .select('scorer_id, assist_id').in('game_id', games.map(g => g.id))

    const playerTotals = {}
    // Incluir todos os confirmados
    const { data: confs } = await supabase.from('confirmations')
      .select('player_id').eq('match_id', selectedMatch).eq('status', 'confirmed')

    confs?.forEach(c => {
      playerTotals[c.player_id] = { goals: 0, assists: 0 }
    })

    allGoals?.forEach(g => {
      if (!playerTotals[g.scorer_id]) playerTotals[g.scorer_id] = { goals: 0, assists: 0 }
      playerTotals[g.scorer_id].goals += 1
      if (g.assist_id) {
        if (!playerTotals[g.assist_id]) playerTotals[g.assist_id] = { goals: 0, assists: 0 }
        playerTotals[g.assist_id].assists += 1
      }
    })

    // Salvar match_stats (para rankings)
    await supabase.from('match_stats').delete().eq('match_id', selectedMatch)
    const rows = Object.entries(playerTotals).map(([pid, s]) => ({
      match_id: selectedMatch, player_id: pid, goals: s.goals, assists: s.assists, present: true
    }))
    if (rows.length > 0) await supabase.from('match_stats').insert(rows)

    // Definir time vencedor (mais vitorias nos jogos)
    const wins = {}
    regularTeams.forEach(t => { wins[t.id] = 0 })
    games.forEach(g => { if (g.winner_team_id && wins[g.winner_team_id] !== undefined) wins[g.winner_team_id]++ })
    const maxWins = Math.max(...Object.values(wins))
    const champId = Object.keys(wins).find(id => wins[id] === maxWins)

    for (const t of regularTeams) {
      await supabase.from('teams').update({ won: t.id === champId }).eq('id', t.id)
    }

    await supabase.from('matches').update({ status: 'finished' }).eq('id', selectedMatch)
    setSaving(false)
    alert('Racha finalizado!')
    onReload()
  }

  // Jogadores dos dois times em campo
  const teamAPlayers = teamPlayers[currentTeamA] || []
  const teamBPlayers = teamPlayers[currentTeamB] || []
  const teamAName = regularTeams.find(t => t.id === currentTeamA)?.name || 'Time A'
  const teamBName = regularTeams.find(t => t.id === currentTeamB)?.name || 'Time B'
  const goalsA = goals.filter(g => g.teamId === currentTeamA).length
  const goalsB = goals.filter(g => g.teamId === currentTeamB).length

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-2">Selecione o racha</h3>
        <select value={selectedMatch} onChange={(e) => { setSelectedMatch(e.target.value); setGoals([]) }}
          className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none text-sm">
          <option value="">Escolha um racha...</option>
          {sortedMatches.map(m => (
            <option key={m.id} value={m.id}>
              {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {m.status === 'finished' ? 'Finalizado' : 'Sorteado'}
            </option>
          ))}
        </select>
      </div>

      {/* Jogos ja registrados */}
      {games.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-3">Jogos registrados ({games.length})</h3>
          <div className="space-y-2">
            {games.map(g => {
              const tA = regularTeams.find(t => t.id === g.team_a_id)
              const tB = regularTeams.find(t => t.id === g.team_b_id)
              const winner = regularTeams.find(t => t.id === g.winner_team_id)
              return (
                <div key={g.id} className="bg-navy-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Jogo {g.game_number}</span>
                    {winner && <span className="text-xs text-gold-400">🏆 {winner.name}</span>}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className={`text-sm font-semibold ${g.winner_team_id === g.team_a_id ? 'text-gold-400' : 'text-white'}`}>{tA?.name}</span>
                    <span className="bg-navy-600 px-3 py-1 rounded-lg text-white font-bold text-lg">{g.score_a} x {g.score_b}</span>
                    <span className={`text-sm font-semibold ${g.winner_team_id === g.team_b_id ? 'text-gold-400' : 'text-white'}`}>{tB?.name}</span>
                  </div>
                  {g.game_goals?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {g.game_goals.map((gl, i) => (
                        <p key={i} className="text-xs text-slate-400">
                          ⚽ {gl.scorer?.nickname || gl.scorer?.name}
                          {gl.assister && <span className="text-slate-500"> (assist. {gl.assister?.nickname || gl.assister?.name})</span>}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Registrar novo jogo */}
      {selectedMatch && matches.find(m => m.id === selectedMatch)?.status === 'sorted' && regularTeams.length >= 2 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-gold-400/20 space-y-4">
          <h3 className="text-sm font-semibold text-gold-400">Registrar Jogo {games.length + 1}</h3>

          {/* Selecao dos times */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Time A (em campo)</label>
              <select value={currentTeamA} onChange={(e) => setCurrentTeamA(e.target.value)}
                className="w-full bg-navy-700 rounded-lg p-2 text-white outline-none text-sm">
                <option value="">Selecione</option>
                {regularTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-1 text-slate-500 font-bold">vs</div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Time B (entrando)</label>
              <select value={currentTeamB} onChange={(e) => setCurrentTeamB(e.target.value)}
                className="w-full bg-navy-700 rounded-lg p-2 text-white outline-none text-sm">
                <option value="">Selecione</option>
                {regularTeams.filter(t => t.id !== currentTeamA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Placar atual */}
          {currentTeamA && currentTeamB && (
            <>
              <div className="flex items-center justify-center gap-4 py-2">
                <span className="text-white font-semibold text-sm">{teamAName}</span>
                <span className="bg-navy-600 px-4 py-2 rounded-xl text-white font-bold text-2xl">{goalsA} x {goalsB}</span>
                <span className="text-white font-semibold text-sm">{teamBName}</span>
              </div>

              {/* Registrar gol */}
              <div className="space-y-3">
                <GoalInput label={teamAName} teamId={currentTeamA} players={teamAPlayers} allPlayers={[...teamAPlayers, ...teamBPlayers]} onAddGoal={addGoal} />
                <GoalInput label={teamBName} teamId={currentTeamB} players={teamBPlayers} allPlayers={[...teamAPlayers, ...teamBPlayers]} onAddGoal={addGoal} />
              </div>

              {/* Lista de gols do jogo atual */}
              {goals.length > 0 && (
                <div className="bg-navy-700/50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-2">Gols deste jogo:</p>
                  {goals.map((g, i) => {
                    const allP = [...teamAPlayers, ...teamBPlayers]
                    const scorer = allP.find(p => p.id === g.scorerId)
                    const assister = g.assistId ? allP.find(p => p.id === g.assistId) : null
                    const teamName = g.teamId === currentTeamA ? teamAName : teamBName
                    return (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <span className="text-xs text-white flex-1">
                          ⚽ {scorer?.nickname || scorer?.name} <span className="text-slate-500">({teamName})</span>
                          {assister && <span className="text-slate-400"> assist. {assister.nickname || assister.name}</span>}
                        </span>
                        <button onClick={() => removeGoal(i)} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Finalizar jogo */}
              <button onClick={finishGame} disabled={saving}
                className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                <Square size={16} /> {saving ? 'Salvando...' : 'Finalizar Jogo'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Botao finalizar racha */}
      {selectedMatch && games.length > 0 && matches.find(m => m.id === selectedMatch)?.status === 'sorted' && (
        <button onClick={finalizeRacha} disabled={saving}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2">
          <Trophy size={16} /> {saving ? 'Finalizando...' : 'Encerrar Racha e Calcular Resultados'}
        </button>
      )}
    </div>
  )
}

// Componente para registrar um gol
function GoalInput({ label, teamId, players, allPlayers, onAddGoal }) {
  const [scorerId, setScorerId] = useState('')
  const [assistId, setAssistId] = useState('')
  const [open, setOpen] = useState(false)

  function submit() {
    if (!scorerId) return
    onAddGoal(teamId, scorerId, assistId || null)
    setScorerId(''); setAssistId(''); setOpen(false)
  }

  return (
    <div className="bg-navy-700/30 rounded-xl p-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm">
        <span className="text-white font-semibold">⚽ Gol do {label}</span>
        <ChevronDown size={14} className={`text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Quem fez o gol</label>
            <select value={scorerId} onChange={(e) => setScorerId(e.target.value)}
              className="w-full bg-navy-700 rounded-lg p-2 text-white outline-none text-sm">
              <option value="">Selecione</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Assistencia (opcional)</label>
            <select value={assistId} onChange={(e) => setAssistId(e.target.value)}
              className="w-full bg-navy-700 rounded-lg p-2 text-white outline-none text-sm">
              <option value="">Sem assistencia</option>
              {players.filter(p => p.id !== scorerId).map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={!scorerId}
            className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2 rounded-lg text-sm transition disabled:opacity-50">
            Registrar Gol
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================
// ABA: JOGADORES
// ============================================
function PlayersTab({ players, onReload }) {
  const [showForm, setShowForm] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [name, setName] = useState(''); const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState(''); const [shirtNumber, setShirtNumber] = useState('')
  const [saving, setSaving] = useState(false); const [uploadingPhoto, setUploadingPhoto] = useState('')

  const mensalistas = players.filter(p => p.player_type === 'mensalista')
  const avulsos = players.filter(p => p.player_type === 'avulso')
  const pl = { goleiro: 'Goleiro', zagueiro: 'Zagueiro', meia: 'Meia', atacante: 'Atacante' }

  function startEdit(p) { setEditingPlayer(p); setName(p.name); setNickname(p.nickname || ''); setPosition(p.position || ''); setShirtNumber(p.shirt_number ? String(p.shirt_number) : ''); setShowForm(true) }
  function startNew() { setEditingPlayer(null); setName(''); setNickname(''); setPosition(''); setShirtNumber(''); setShowForm(true) }
  function cancelForm() { setEditingPlayer(null); setName(''); setNickname(''); setPosition(''); setShirtNumber(''); setShowForm(false) }

  async function savePlayer() {
    if (!name.trim() || !position) return; setSaving(true)
    const data = { name: name.trim(), nickname: nickname.trim() || null, position, shirt_number: shirtNumber ? parseInt(shirtNumber) : null }
    if (editingPlayer) await supabase.from('players').update(data).eq('id', editingPlayer.id)
    else await supabase.from('players').insert({ ...data, player_type: 'mensalista', role: 'player' })
    cancelForm(); setSaving(false); onReload()
  }

  async function handlePhotoUpload(playerId, file) {
    if (!file) return; setUploadingPhoto(playerId)
    const ext = file.name.split('.').pop().toLowerCase(); const fileName = `${playerId}.${ext}`
    await supabase.storage.from('avatars').remove([`${playerId}.jpg`, `${playerId}.jpeg`, `${playerId}.png`, `${playerId}.webp`])
    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true, contentType: file.type, cacheControl: '0' })
    if (uploadError) { alert('Erro ao subir foto: ' + uploadError.message); setUploadingPhoto(''); return }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const photoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}?t=${Date.now()}`
    await supabase.from('players').update({ photo_url: photoUrl }).eq('id', playerId)
    setUploadingPhoto(''); onReload()
  }

  async function promoteToMensalista(pid) { await supabase.from('players').update({ player_type: 'mensalista' }).eq('id', pid); onReload() }
  async function deactivatePlayer(pid) { if (!confirm('Desativar?')) return; await supabase.from('players').update({ active: false }).eq('id', pid); onReload() }

  return (
    <div className="space-y-4">
      <button onClick={startNew} className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm"><Plus size={16} /> Cadastrar mensalista</button>

      {showForm && (
        <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-gold-400/30">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gold-400">{editingPlayer ? 'Editar jogador' : 'Novo mensalista'}</h3><button onClick={cancelForm} className="text-slate-400 hover:text-white"><X size={16} /></button></div>
          <div><label className="block text-xs text-slate-400 mb-1">Nome</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Apelido</label><input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="block text-xs text-slate-400 mb-1">Posicao</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none text-sm">
                <option value="">Selecione</option><option value="goleiro">Goleiro</option><option value="zagueiro">Zagueiro</option><option value="meia">Meia</option><option value="atacante">Atacante</option></select></div>
            <div className="w-24"><label className="block text-xs text-slate-400 mb-1">Numero</label><input type="number" value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" placeholder="10" /></div>
          </div>
          <button onClick={savePlayer} disabled={saving || !name.trim() || !position} className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition disabled:opacity-50 text-sm">{saving ? 'Salvando...' : editingPlayer ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      )}

      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-3">Mensalistas ({mensalistas.filter(p => p.active).length})</h3>
        <div className="space-y-2">
          {mensalistas.filter(p => p.active).map(p => (
            <div key={p.id} className="bg-navy-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className="relative">
                {p.photo_url ? <img src={p.photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-navy-600" />
                  : <div className="w-10 h-10 rounded-full bg-navy-600 flex items-center justify-center text-gold-400 text-xs font-bold">{p.shirt_number || '?'}</div>}
                <label className="absolute -bottom-1 -right-1 w-5 h-5 bg-gold-400 rounded-full flex items-center justify-center cursor-pointer hover:bg-gold-500 transition">
                  <Camera size={10} className="text-navy-900" /><input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(p.id, e.target.files[0])} disabled={uploadingPhoto === p.id} /></label>
              </div>
              <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{p.name} {p.nickname && <span className="text-slate-400 text-xs">({p.nickname})</span>}</p>
                <div className="flex items-center gap-2"><span className="text-xs text-slate-500">{pl[p.position] || 'Sem posicao'}</span>{p.shirt_number && <span className="text-xs text-slate-500">#{p.shirt_number}</span>}</div></div>
              <div className="flex gap-1"><button onClick={() => startEdit(p)} className="text-xs p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"><Pencil size={12} /></button>
                <button onClick={() => deactivatePlayer(p.id)} className="text-xs p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"><Trash2 size={12} /></button></div>
            </div>
          ))}
        </div>
      </div>

      {avulsos.filter(p => p.active).length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-3">Avulsos ({avulsos.filter(p => p.active).length})</h3>
          <div className="space-y-2">{avulsos.filter(p => p.active).map(p => (
            <div key={p.id} className="bg-navy-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1"><p className="text-white text-sm">{p.name}</p></div>
              <button onClick={() => startEdit(p)} className="text-xs p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"><Pencil size={12} /></button>
              <button onClick={() => promoteToMensalista(p.id)} className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold">Tornar mensalista</button>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  )
}

// ============================================
// ABA: IMPORTAR HISTORICO
// ============================================
function HistoryTab({ players, onReload }) {
  const [date, setDate] = useState(''); const [selectedPlayers, setSelectedPlayers] = useState({}); const [saving, setSaving] = useState(false); const [success, setSuccess] = useState('')
  const activePlayers = players.filter(p => p.active)

  function togglePlayer(pid) {
    setSelectedPlayers(prev => { if (prev[pid]) { const c = { ...prev }; delete c[pid]; return c }; const p = activePlayers.find(pl => pl.id === pid); return { ...prev, [pid]: { name: p.nickname || p.name, goals: 0, assists: 0 } } })
  }
  function updatePlayerStat(pid, field, value) { setSelectedPlayers(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } })) }

  async function importMatch() {
    if (!date || Object.keys(selectedPlayers).length === 0) return; setSaving(true); setSuccess('')
    const { data: me } = await supabase.from('players').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    const { data: match } = await supabase.from('matches').insert({ date, status: 'finished', created_by: me.id, notes: 'Importado do historico' }).select().single()
    if (!match) { setSaving(false); alert('Erro'); return }
    await supabase.from('confirmations').insert(Object.keys(selectedPlayers).map(pid => ({ match_id: match.id, player_id: pid, status: 'confirmed' })))
    await supabase.from('match_stats').insert(Object.entries(selectedPlayers).map(([pid, s]) => ({ match_id: match.id, player_id: pid, goals: parseInt(s.goals) || 0, assists: parseInt(s.assists) || 0, present: true })))
    setDate(''); setSelectedPlayers({}); setSaving(false); setSuccess('Racha importado!'); setTimeout(() => setSuccess(''), 3000); onReload()
  }

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-1 flex items-center gap-2"><History size={14} /> Importar racha passado</h3>
        <p className="text-xs text-slate-500 mb-3">Cadastre dados de rachas anteriores.</p>
        {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg text-sm mb-3">{success}</div>}
        <div><label className="block text-xs text-slate-400 mb-1">Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" /></div>
      </div>
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Quem jogou?</h3>
        <div className="flex flex-wrap gap-1.5">{activePlayers.map(p => (
          <button key={p.id} onClick={() => togglePlayer(p.id)} className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${selectedPlayers[p.id] ? 'bg-gold-400 text-navy-900' : 'bg-navy-700 text-slate-400 hover:text-white'}`}>{p.nickname || p.name}</button>
        ))}</div>
      </div>
      {Object.keys(selectedPlayers).length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400">Gols e Assistencias</h3>
          {Object.entries(selectedPlayers).map(([pid, s]) => (
            <div key={pid} className="bg-navy-700/50 rounded-xl p-3">
              <p className="text-white text-sm font-medium mb-2">{s.name}</p>
              <div className="flex gap-3">
                <div className="flex-1"><label className="block text-xs text-slate-400 mb-1">Gols</label>
                  <div className="flex items-center gap-2"><button onClick={() => updatePlayerStat(pid, 'goals', Math.max(0, s.goals - 1))} className="bg-navy-600 text-white w-8 h-8 rounded-lg text-lg">-</button><span className="text-white font-bold text-lg w-8 text-center">{s.goals}</span><button onClick={() => updatePlayerStat(pid, 'goals', s.goals + 1)} className="bg-gold-400 text-navy-900 w-8 h-8 rounded-lg text-lg font-bold">+</button></div></div>
                <div className="flex-1"><label className="block text-xs text-slate-400 mb-1">Assist.</label>
                  <div className="flex items-center gap-2"><button onClick={() => updatePlayerStat(pid, 'assists', Math.max(0, s.assists - 1))} className="bg-navy-600 text-white w-8 h-8 rounded-lg text-lg">-</button><span className="text-white font-bold text-lg w-8 text-center">{s.assists}</span><button onClick={() => updatePlayerStat(pid, 'assists', s.assists + 1)} className="bg-blue-600 text-white w-8 h-8 rounded-lg text-lg font-bold">+</button></div></div>
              </div>
            </div>
          ))}
          <button onClick={importMatch} disabled={saving || !date} className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"><Save size={16} /> {saving ? 'Salvando...' : 'Importar Racha'}</button>
        </div>
      )}
    </div>
  )
}
