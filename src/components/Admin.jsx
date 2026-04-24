import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Shuffle, Save, Trophy, Trash2, Link as LinkIcon, Share2, Check, Pencil, Camera, X, History, Square, ChevronDown, Calendar, Users, Swords, Shield } from 'lucide-react'

const TEAM_SIZE = 6

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
    { key: 'match', label: 'Rachas', icon: Calendar },
    { key: 'games', label: 'Partidas', icon: Swords },
    { key: 'players', label: 'Jogadores', icon: Users },
    { key: 'history', label: 'Historico', icon: History },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-primary-container" />
            <span className="label-caps text-primary-container">Painel Administrativo</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Centro de Comando</h2>
          <p className="text-on-surface-variant text-sm mt-1">Gestao completa do racha</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass-card p-1.5 mb-6 inline-flex gap-1 overflow-x-auto w-full lg:w-auto">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                tab === t.key
                  ? 'bg-primary-container text-on-primary'
                  : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : (
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
// ABA: RACHAS
// ============================================
function MatchTab({ matches, onReload }) {
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [matchName, setMatchName] = useState('')
  const [location, setLocation] = useState('Arena Santa')
  const [matchTime, setMatchTime] = useState('20:00')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [numTeams, setNumTeams] = useState(2)

  async function createMatch() {
    if (!newDate) return
    setSaving(true)
    const { data: me } = await supabase.from('players').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    await supabase.from('matches').insert({
      date: newDate,
      notes: notes || null,
      name: matchName || null,
      location: location || null,
      match_time: matchTime || null,
      created_by: me.id,
      status: 'open'
    })
    setNewDate(''); setNotes(''); setMatchName(''); setLocation('Arena Santa'); setMatchTime('20:00')
    setSaving(false); onReload()
  }

  function getConfirmLink(token) { return `${window.location.origin}/confirmar/${token}` }

  function copyLink(token) {
    navigator.clipboard.writeText(getConfirmLink(token))
    setCopiedId(token)
    setTimeout(() => setCopiedId(''), 2000)
  }

  function shareWhatsApp(match) {
    const link = getConfirmLink(match.token)
    const d = new Date(match.date + 'T12:00:00')
    const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    window.open(`https://wa.me/?text=${encodeURIComponent(`⚽ *RACHA DA SANTA*\n📅 ${dateStr}\n\nConfirme sua presenca:\n${link}`)}`, '_blank')
  }

  async function sortTeams(matchId) {
    const { data: confs } = await supabase.from('confirmations').select('player_id').eq('match_id', matchId).eq('status', 'confirmed')
    if (!confs || confs.length < numTeams * 2) {
      alert(`Precisa de pelo menos ${numTeams * 2} confirmados.`)
      return
    }

    // Busca os jogadores completos com overall e posicao
    const { data: playersFull } = await supabase
      .from('players')
      .select('id, name, position, overall')
      .in('id', confs.map(c => c.player_id))

    if (!playersFull) return

    // SORTEIO BALANCEADO por overall + posicao
    // 1. Separa goleiros dos demais
    const goleiros = playersFull.filter(p => p.position === 'goleiro')
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))
    const outros = playersFull.filter(p => p.position !== 'goleiro')
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))

    // 2. Distribui 1 goleiro por time (se tiver)
    const teams = Array.from({ length: numTeams }, () => [])
    for (let i = 0; i < numTeams; i++) {
      if (goleiros[i]) teams[i].push(goleiros[i].id)
    }
    // Goleiros excedentes entram no pool geral
    const allOthers = [...outros, ...goleiros.slice(numTeams)]
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))

    // 3. Snake draft: 1->A, 2->B, 3->C, 4->C, 5->B, 6->A, 7->A, 8->B...
    // Distribui sempre pro time com menos jogadores e menor overall acumulado
    function teamOverall(teamIds) {
      return teamIds.reduce((s, id) => s + (playersFull.find(p => p.id === id)?.overall || 70), 0)
    }

    for (const player of allOthers) {
      // Times que ainda tem vaga
      const available = teams
        .map((t, idx) => ({ idx, size: t.length, overall: teamOverall(t) }))
        .filter(t => t.size < TEAM_SIZE)

      if (available.length === 0) break // Todos os times cheios, vai pra lista de espera

      // Ordena por tamanho asc, depois por overall acumulado asc (pega o time mais fraco primeiro)
      available.sort((a, b) => a.size - b.size || a.overall - b.overall)
      teams[available[0].idx].push(player.id)
    }

    // 4. Lista de espera: quem nao foi alocado
    const allocated = new Set(teams.flat())
    const waitlist = playersFull.filter(p => !allocated.has(p.id)).map(p => p.id)

    // Remove times antigos
    const { data: oldTeams } = await supabase.from('teams').select('id').eq('match_id', matchId)
    if (oldTeams) {
      for (const t of oldTeams) { await supabase.from('team_players').delete().eq('team_id', t.id) }
      await supabase.from('teams').delete().eq('match_id', matchId)
    }

    // Cria os times
    const names = ['Time A', 'Time B', 'Time C', 'Time D']
    for (let t = 0; t < numTeams; t++) {
      if (teams[t].length === 0) continue
      const { data: team } = await supabase.from('teams').insert({ match_id: matchId, name: names[t] }).select().single()
      await supabase.from('team_players').insert(teams[t].map(pid => ({ team_id: team.id, player_id: pid })))
    }

    // Lista de espera
    if (waitlist.length > 0) {
      const { data: w } = await supabase.from('teams').insert({ match_id: matchId, name: 'Lista de Espera' }).select().single()
      await supabase.from('team_players').insert(waitlist.map(pid => ({ team_id: w.id, player_id: pid })))
    }

    await supabase.from('matches').update({ status: 'sorted' }).eq('id', matchId)
    onReload()
  }

  async function deleteMatch(matchId) {
    if (!confirm('Excluir este racha?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    onReload()
  }

  const statusStyle = {
    open: 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30',
    sorted: 'bg-tertiary-container/15 text-tertiary border-tertiary-container/30',
    finished: 'bg-white/5 text-on-surface-variant border-white/10',
  }
  const statusLabel = { open: 'Aberto', sorted: 'Sorteado', finished: 'Finalizado' }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Criar novo racha */}
      <div className="lg:col-span-4">
        <div className="glass-card p-5 lg:p-6 lg:sticky lg:top-4">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Plus size={18} className="text-primary-container" /> Novo racha
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">Crie a partida e compartilhe o link</p>

          <div className="space-y-3">
            <div>
              <label className="label-caps mb-1.5 block">Nome do racha (opcional)</label>
              <input type="text" value={matchName} onChange={e => setMatchName(e.target.value)} className="input-base"
                placeholder="Ex: Racha Final, Racha do Ano..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-caps mb-1.5 block">Data</label>
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="label-caps mb-1.5 block">Horario</label>
                <input type="time" value={matchTime} onChange={e => setMatchTime(e.target.value)} className="input-base" />
              </div>
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Local</label>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="input-base"
                placeholder="Arena Santa" />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Observacoes (opcional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input-base"
                placeholder="Ex: Campo diferente" />
            </div>
            <button onClick={createMatch} disabled={saving || !newDate}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Plus size={16} /> {saving ? 'Criando...' : 'Criar Racha'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rachas */}
      <div className="lg:col-span-8 space-y-3">
        <h3 className="label-caps">Rachas ({matches.length})</h3>
        {matches.map(match => {
          const d = new Date(match.date + 'T12:00:00')
          const fmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')

          return (
            <div key={match.id} className="glass-card p-4 lg:p-5">
              <div className="flex items-start gap-4 mb-3">
                <div className="text-center shrink-0 w-14">
                  <p className="text-2xl font-extrabold text-white tabular-nums leading-none">{d.getDate()}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">{weekday}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{fmt}</p>
                  <span className={`chip mt-1 border ${statusStyle[match.status]}`}>{statusLabel[match.status]}</span>
                  {match.notes && <p className="text-xs text-on-surface-variant mt-1.5 truncate">{match.notes}</p>}
                </div>
                {match.status !== 'finished' && (
                  <button onClick={() => deleteMatch(match.id)} title="Excluir"
                    className="text-on-surface-variant/60 hover:text-error p-2 rounded-lg hover:bg-error/10 transition">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {match.status !== 'finished' && (
                <div className="space-y-2 pt-3 border-t border-white/5">
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(match.token)}
                      className="flex-1 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-on-surface-variant hover:text-white py-2 rounded-lg transition text-sm font-semibold flex items-center justify-center gap-1.5">
                      {copiedId === match.token ? <><Check size={14} /> Copiado!</> : <><LinkIcon size={14} /> Copiar link</>}
                    </button>
                    <button onClick={() => shareWhatsApp(match)}
                      className="flex-1 bg-secondary-container/15 hover:bg-secondary-container/25 border border-secondary-container/30 text-secondary-fixed py-2 rounded-lg transition text-sm font-semibold flex items-center justify-center gap-1.5">
                      <Share2 size={14} /> WhatsApp
                    </button>
                  </div>
                  {match.status === 'open' && (
                    <div className="flex gap-2">
                      <select value={numTeams} onChange={e => setNumTeams(parseInt(e.target.value))}
                        className="select-base w-32 !py-2">
                        <option value={2}>2 Times</option>
                        <option value={3}>3 Times</option>
                        <option value={4}>4 Times</option>
                      </select>
                      <button onClick={() => sortTeams(match.id)}
                        className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-1.5">
                        <Shuffle size={14} /> Sortear {numTeams} times ({TEAM_SIZE} por time)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// ABA: PARTIDAS (jogos de 7 min)
// ============================================
function GamesTab({ matches, players, onReload }) {
  const [selectedMatch, setSelectedMatch] = useState('')
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [teamPlayers, setTeamPlayers] = useState({})
  const [saving, setSaving] = useState(false)
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

    const tpMap = {}
    t?.forEach(team => { tpMap[team.id] = team.team_players?.map(tp => tp.players) || [] })
    setTeamPlayers(tpMap)

    const { data: g } = await supabase.from('games')
      .select('*, game_goals(*, scorer:scorer_id(name, nickname), assister:assist_id(name, nickname))')
      .eq('match_id', selectedMatch).order('game_number', { ascending: true })
    setGames(g || [])

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
    let winnerId = null
    if (scoreA > scoreB) winnerId = currentTeamA
    else if (scoreB > scoreA) winnerId = currentTeamB
    else winnerId = currentTeamB // empate: time A mais antigo sai, B "fica"
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
    const { data: allGoals } = await supabase.from('game_goals')
      .select('scorer_id, assist_id').in('game_id', games.map(g => g.id))
    const playerTotals = {}
    const { data: confs } = await supabase.from('confirmations')
      .select('player_id').eq('match_id', selectedMatch).eq('status', 'confirmed')
    confs?.forEach(c => { playerTotals[c.player_id] = { goals: 0, assists: 0 } })
    allGoals?.forEach(g => {
      if (!playerTotals[g.scorer_id]) playerTotals[g.scorer_id] = { goals: 0, assists: 0 }
      playerTotals[g.scorer_id].goals += 1
      if (g.assist_id) {
        if (!playerTotals[g.assist_id]) playerTotals[g.assist_id] = { goals: 0, assists: 0 }
        playerTotals[g.assist_id].assists += 1
      }
    })
    await supabase.from('match_stats').delete().eq('match_id', selectedMatch)
    const rows = Object.entries(playerTotals).map(([pid, s]) => ({
      match_id: selectedMatch, player_id: pid, goals: s.goals, assists: s.assists, present: true
    }))
    if (rows.length > 0) await supabase.from('match_stats').insert(rows)
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

  const teamAPlayers = teamPlayers[currentTeamA] || []
  const teamBPlayers = teamPlayers[currentTeamB] || []
  const teamAName = regularTeams.find(t => t.id === currentTeamA)?.name || 'Time A'
  const teamBName = regularTeams.find(t => t.id === currentTeamB)?.name || 'Time B'
  const goalsA = goals.filter(g => g.teamId === currentTeamA).length
  const goalsB = goals.filter(g => g.teamId === currentTeamB).length

  const currentMatch = matches.find(m => m.id === selectedMatch)

  return (
    <div className="space-y-6">
      {/* Seletor de racha */}
      <div className="glass-card p-5">
        <label className="label-caps mb-2 block">Selecione o racha</label>
        <select value={selectedMatch} onChange={e => { setSelectedMatch(e.target.value); setGoals([]) }}
          className="select-base">
          <option value="">Escolha um racha...</option>
          {sortedMatches.map(m => (
            <option key={m.id} value={m.id}>
              {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {m.status === 'finished' ? 'Finalizado' : 'Sorteado'}
            </option>
          ))}
        </select>
      </div>

      {/* Jogos registrados */}
      {games.length > 0 && (
        <div className="glass-card p-5 lg:p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Swords size={18} className="text-primary-container" /> Jogos registrados ({games.length})
          </h3>
          <div className="space-y-2">
            {games.map(g => {
              const tA = regularTeams.find(t => t.id === g.team_a_id)
              const tB = regularTeams.find(t => t.id === g.team_b_id)
              const winner = regularTeams.find(t => t.id === g.winner_team_id)
              return (
                <div key={g.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="label-caps">Jogo {g.game_number}</span>
                    {winner && <span className="text-xs font-semibold text-primary-container">🏆 {winner.name}</span>}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <span className={`text-sm font-bold text-right truncate ${g.winner_team_id === g.team_a_id ? 'text-primary-container' : 'text-white'}`}>{tA?.name}</span>
                    <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-extrabold text-lg tabular-nums text-white whitespace-nowrap">
                      {g.score_a} <span className="text-on-surface-variant/60 text-xs">x</span> {g.score_b}
                    </span>
                    <span className={`text-sm font-bold truncate ${g.winner_team_id === g.team_b_id ? 'text-primary-container' : 'text-white'}`}>{tB?.name}</span>
                  </div>
                  {g.game_goals?.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {g.game_goals.map((gl, i) => (
                        <p key={i} className="text-xs text-on-surface-variant">
                          ⚽ {gl.scorer?.nickname || gl.scorer?.name}
                          {gl.assister && <span className="text-on-surface-variant/60"> (assist. {gl.assister?.nickname || gl.assister?.name})</span>}
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
      {selectedMatch && currentMatch?.status === 'sorted' && regularTeams.length >= 2 && (
        <div className="glass-card p-5 lg:p-6 border-primary-container/20">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Swords size={18} className="text-primary-container" /> Registrar Jogo {games.length + 1}
          </h3>

          {/* Selecao dos times */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 mb-4">
            <div>
              <label className="label-caps mb-1.5 block">Time A</label>
              <select value={currentTeamA} onChange={e => setCurrentTeamA(e.target.value)} className="select-base !py-2 text-sm">
                <option value="">Selecione</option>
                {regularTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <span className="pb-3 text-on-surface-variant font-bold">vs</span>
            <div>
              <label className="label-caps mb-1.5 block">Time B</label>
              <select value={currentTeamB} onChange={e => setCurrentTeamB(e.target.value)} className="select-base !py-2 text-sm">
                <option value="">Selecione</option>
                {regularTeams.filter(t => t.id !== currentTeamA).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {currentTeamA && currentTeamB && (
            <>
              {/* Placar */}
              <div className="flex items-center justify-center gap-4 py-4 bg-white/[0.03] rounded-xl mb-4">
                <span className="text-white font-bold text-sm flex-1 text-right">{teamAName}</span>
                <span className="bg-primary-container/10 border border-primary-container/30 px-5 py-2 rounded-xl text-white font-extrabold text-3xl tabular-nums">
                  {goalsA} <span className="text-on-surface-variant/60 text-xl">x</span> {goalsB}
                </span>
                <span className="text-white font-bold text-sm flex-1">{teamBName}</span>
              </div>

              {/* Inputs de gol */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                <GoalInput label={teamAName} teamId={currentTeamA} players={teamAPlayers} onAddGoal={addGoal} />
                <GoalInput label={teamBName} teamId={currentTeamB} players={teamBPlayers} onAddGoal={addGoal} />
              </div>

              {/* Lista de gols */}
              {goals.length > 0 && (
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4">
                  <p className="label-caps mb-2">Gols deste jogo</p>
                  {goals.map((g, i) => {
                    const allP = [...teamAPlayers, ...teamBPlayers]
                    const scorer = allP.find(p => p.id === g.scorerId)
                    const assister = g.assistId ? allP.find(p => p.id === g.assistId) : null
                    const teamName = g.teamId === currentTeamA ? teamAName : teamBName
                    return (
                      <div key={i} className="flex items-center gap-2 py-1 text-sm">
                        <span className="text-white flex-1">
                          ⚽ {scorer?.nickname || scorer?.name} <span className="text-on-surface-variant">({teamName})</span>
                          {assister && <span className="text-on-surface-variant"> assist. {assister.nickname || assister.name}</span>}
                        </span>
                        <button onClick={() => removeGoal(i)} className="text-error hover:text-error/80">
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <button onClick={finishGame} disabled={saving}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                <Square size={16} /> {saving ? 'Salvando...' : 'Finalizar Jogo'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Finalizar racha */}
      {selectedMatch && games.length > 0 && currentMatch?.status === 'sorted' && (
        <button onClick={finalizeRacha} disabled={saving}
          className="w-full bg-error/15 hover:bg-error/25 border border-error/30 text-error font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2">
          <Trophy size={16} /> {saving ? 'Finalizando...' : 'Encerrar Racha e Calcular Resultados'}
        </button>
      )}
    </div>
  )
}

function GoalInput({ label, teamId, players, onAddGoal }) {
  const [scorerId, setScorerId] = useState('')
  const [assistId, setAssistId] = useState('')
  const [open, setOpen] = useState(false)

  function submit() {
    if (!scorerId) return
    onAddGoal(teamId, scorerId, assistId || null)
    setScorerId(''); setAssistId(''); setOpen(false)
  }

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-sm">
        <span className="text-white font-semibold flex items-center gap-2">⚽ Gol do {label}</span>
        <ChevronDown size={14} className={`text-on-surface-variant transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <div>
            <label className="label-caps mb-1 block">Autor do gol</label>
            <select value={scorerId} onChange={e => setScorerId(e.target.value)} className="select-base !py-2 text-sm">
              <option value="">Selecione</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label-caps mb-1 block">Assistencia (opcional)</label>
            <select value={assistId} onChange={e => setAssistId(e.target.value)} className="select-base !py-2 text-sm">
              <option value="">Sem assistencia</option>
              {players.filter(p => p.id !== scorerId).map(p => <option key={p.id} value={p.id}>{p.nickname || p.name}</option>)}
            </select>
          </div>
          <button onClick={submit} disabled={!scorerId} className="btn-primary w-full py-2 text-sm">
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
  const [nationality, setNationality] = useState('BR')
  const [overall, setOverall] = useState(70)
  const [pace, setPace] = useState(70)
  const [shooting, setShooting] = useState(70)
  const [passing, setPassing] = useState(70)
  const [dribbling, setDribbling] = useState(70)
  const [defending, setDefending] = useState(70)
  const [physical, setPhysical] = useState(70)
  const [saving, setSaving] = useState(false); const [uploadingPhoto, setUploadingPhoto] = useState('')

  const mensalistas = players.filter(p => p.player_type === 'mensalista')
  const avulsos = players.filter(p => p.player_type === 'avulso')
  const positionLabels = { goleiro: 'Goleiro', zagueiro: 'Zagueiro', meia: 'Meia', atacante: 'Atacante' }

  function startEdit(p) {
    setEditingPlayer(p)
    setName(p.name); setNickname(p.nickname || '')
    setPosition(p.position || ''); setShirtNumber(p.shirt_number ? String(p.shirt_number) : '')
    setNationality(p.nationality || 'BR')
    setOverall(p.overall || 70)
    setPace(p.pace || 70); setShooting(p.shooting || 70); setPassing(p.passing || 70)
    setDribbling(p.dribbling || 70); setDefending(p.defending || 70); setPhysical(p.physical || 70)
    setShowForm(true)
  }
  function startNew() {
    setEditingPlayer(null)
    setName(''); setNickname(''); setPosition(''); setShirtNumber('')
    setNationality('BR')
    setOverall(70); setPace(70); setShooting(70); setPassing(70); setDribbling(70); setDefending(70); setPhysical(70)
    setShowForm(true)
  }
  function cancelForm() {
    setEditingPlayer(null)
    setName(''); setNickname(''); setPosition(''); setShirtNumber('')
    setNationality('BR')
    setOverall(70); setPace(70); setShooting(70); setPassing(70); setDribbling(70); setDefending(70); setPhysical(70)
    setShowForm(false)
  }

  async function savePlayer() {
    if (!name.trim() || !position) return
    setSaving(true)
    const data = {
      name: name.trim(),
      nickname: nickname.trim() || null,
      position,
      shirt_number: shirtNumber ? parseInt(shirtNumber) : null,
      nationality,
      overall: parseInt(overall) || 70,
      pace: parseInt(pace) || 70,
      shooting: parseInt(shooting) || 70,
      passing: parseInt(passing) || 70,
      dribbling: parseInt(dribbling) || 70,
      defending: parseInt(defending) || 70,
      physical: parseInt(physical) || 70,
    }
    if (editingPlayer) await supabase.from('players').update(data).eq('id', editingPlayer.id)
    else await supabase.from('players').insert({ ...data, player_type: 'mensalista', role: 'player' })
    cancelForm(); setSaving(false); onReload()
  }

  async function handlePhotoUpload(playerId, file) {
    if (!file) return
    setUploadingPhoto(playerId)

    try {
      // 1. Redimensiona/comprime a foto no navegador (400x400, JPEG 80%)
      const resizedBlob = await resizeImage(file, 400, 0.8)

      // 2. Nome UNICO por upload (playerId + timestamp) -> mata cache definitivamente
      const timestamp = Date.now()
      const fileName = `${playerId}_${timestamp}.jpg`

      // 3. Remove fotos antigas do jogador (todas as variacoes)
      const { data: existing } = await supabase.storage.from('avatars').list('', { limit: 1000 })
      if (existing) {
        const toDelete = existing
          .filter(f => f.name.startsWith(`${playerId}.`) || f.name.startsWith(`${playerId}_`))
          .map(f => f.name)
        if (toDelete.length > 0) {
          await supabase.storage.from('avatars').remove(toDelete)
        }
      }

      // 4. Sobe a foto nova
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, resizedBlob, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600'
      })
      if (uploadError) {
        alert('Erro ao subir foto: ' + uploadError.message)
        setUploadingPhoto('')
        return
      }

      // 5. Atualiza URL publica no banco
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}`
      await supabase.from('players').update({ photo_url: photoUrl }).eq('id', playerId)
    } catch (err) {
      alert('Erro ao processar foto: ' + err.message)
    }

    setUploadingPhoto('')
    onReload()
  }

  // Redimensiona imagem no navegador antes de subir
  function resizeImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          // Corta quadrado no meio da imagem
          const side = Math.min(img.width, img.height)
          const sx = (img.width - side) / 2
          const sy = (img.height - side) / 2
          canvas.width = maxSize
          canvas.height = maxSize
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize)
          canvas.toBlob(
            (blob) => { if (blob) resolve(blob); else reject(new Error('Falha ao gerar imagem')) },
            'image/jpeg',
            quality
          )
        }
        img.onerror = () => reject(new Error('Falha ao ler imagem'))
        img.src = e.target.result
      }
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
      reader.readAsDataURL(file)
    })
  }

  async function promoteToMensalista(pid) {
    await supabase.from('players').update({ player_type: 'mensalista' }).eq('id', pid)
    onReload()
  }

  async function deactivatePlayer(pid) {
    if (!confirm('Desativar este jogador?')) return
    await supabase.from('players').update({ active: false }).eq('id', pid)
    onReload()
  }

  const positionChip = { goleiro: 'chip-goleiro', zagueiro: 'chip-zagueiro', meia: 'chip-meia', atacante: 'chip-atacante' }

  return (
    <div className="space-y-6">
      <button onClick={startNew} className="btn-primary w-full sm:w-auto px-6 py-3 flex items-center justify-center gap-2">
        <Plus size={16} /> Cadastrar mensalista
      </button>

      {/* Formulario */}
      {showForm && (
        <div className="glass-card p-5 lg:p-6 border-primary-container/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{editingPlayer ? 'Editar jogador' : 'Novo mensalista'}</h3>
            <button onClick={cancelForm} className="text-on-surface-variant hover:text-white p-1"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label-caps mb-1.5 block">Nome</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Apelido</label>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Posicao</label>
              <select value={position} onChange={e => setPosition(e.target.value)} className="select-base">
                <option value="">Selecione</option>
                <option value="goleiro">Goleiro</option>
                <option value="zagueiro">Zagueiro</option>
                <option value="meia">Meia</option>
                <option value="atacante">Atacante</option>
              </select>
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Numero da camisa</label>
              <input type="number" value={shirtNumber} onChange={e => setShirtNumber(e.target.value)} className="input-base" placeholder="10" />
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Nacionalidade</label>
              <select value={nationality} onChange={e => setNationality(e.target.value)} className="select-base">
                <option value="BR">🇧🇷 Brasil</option>
                <option value="PT">🇵🇹 Portugal</option>
                <option value="AR">🇦🇷 Argentina</option>
                <option value="UY">🇺🇾 Uruguai</option>
                <option value="CO">🇨🇴 Colombia</option>
                <option value="ES">🇪🇸 Espanha</option>
                <option value="IT">🇮🇹 Italia</option>
                <option value="FR">🇫🇷 Franca</option>
                <option value="DE">🇩🇪 Alemanha</option>
                <option value="NL">🇳🇱 Holanda</option>
                <option value="EN">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra</option>
                <option value="US">🇺🇸 EUA</option>
                <option value="MX">🇲🇽 Mexico</option>
                <option value="JP">🇯🇵 Japao</option>
              </select>
            </div>
            <div>
              <label className="label-caps mb-1.5 block">Overall geral (40-99)</label>
              <input type="number" min="40" max="99" value={overall} onChange={e => setOverall(e.target.value)} className="input-base" />
            </div>
          </div>

          {/* Stats FIFA */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="label-caps mb-3 text-primary-container">Stats FIFA (40-99)</p>
            <p className="text-xs text-on-surface-variant mb-3">Essas notas sao usadas para o sorteio balanceado dos times.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatInput label="PAC (Velocidade)" value={pace} onChange={setPace} />
              <StatInput label="SHO (Chute)" value={shooting} onChange={setShooting} />
              <StatInput label="PAS (Passe)" value={passing} onChange={setPassing} />
              <StatInput label="DRI (Drible)" value={dribbling} onChange={setDribbling} />
              <StatInput label="DEF (Defesa)" value={defending} onChange={setDefending} />
              <StatInput label="PHY (Fisico)" value={physical} onChange={setPhysical} />
            </div>
          </div>

          <button onClick={savePlayer} disabled={saving || !name.trim() || !position}
            className="btn-primary w-full py-3 mt-4">
            {saving ? 'Salvando...' : editingPlayer ? 'Salvar alteracoes' : 'Cadastrar jogador'}
          </button>
        </div>
      )}

      {/* Mensalistas */}
      <div>
        <h3 className="label-caps mb-3">Mensalistas ({mensalistas.filter(p => p.active).length})</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mensalistas.filter(p => p.active).map(p => (
            <div key={p.id} className="glass-card p-4 flex items-center gap-3">
              <div className="relative shrink-0">
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-sm font-bold text-primary-container">
                    {p.shirt_number || '?'}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-container rounded-full flex items-center justify-center cursor-pointer hover:bg-primary transition">
                  <Camera size={11} className="text-on-primary" />
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => handlePhotoUpload(p.id, e.target.files[0])}
                    disabled={uploadingPhoto === p.id} />
                </label>
                {uploadingPhoto === p.id && (
                  <div className="absolute inset-0 bg-background/80 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                {p.nickname && <p className="text-xs text-on-surface-variant truncate">"{p.nickname}"</p>}
                <div className="flex items-center gap-2 mt-1">
                  {p.position && <span className={`chip ${positionChip[p.position]}`}>{positionLabels[p.position]}</span>}
                  {p.shirt_number && <span className="text-[11px] text-on-surface-variant">#{p.shirt_number}</span>}
                </div>
              </div>
              <div className="text-center px-2 shrink-0">
                <p className="text-xl font-black text-primary-container tabular-nums leading-none">{p.overall || 70}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">OVR</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => startEdit(p)} className="p-2 rounded-lg bg-tertiary-container/10 text-tertiary hover:bg-tertiary-container/20">
                  <Pencil size={14} />
                </button>
                <button onClick={() => deactivatePlayer(p.id)} className="p-2 rounded-lg bg-error/10 text-error hover:bg-error/20">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Avulsos */}
      {avulsos.filter(p => p.active).length > 0 && (
        <div>
          <h3 className="label-caps mb-3">Avulsos ({avulsos.filter(p => p.active).length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {avulsos.filter(p => p.active).map(p => (
              <div key={p.id} className="glass-card p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                </div>
                <button onClick={() => startEdit(p)} className="p-2 rounded-lg bg-tertiary-container/10 text-tertiary">
                  <Pencil size={14} />
                </button>
                <button onClick={() => promoteToMensalista(p.id)}
                  className="text-xs px-3 py-2 rounded-lg bg-tertiary-container/15 text-tertiary hover:bg-tertiary-container/25 font-semibold whitespace-nowrap">
                  Tornar mensalista
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// ABA: HISTORICO
// ============================================
function HistoryTab({ players, onReload }) {
  const [date, setDate] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const activePlayers = players.filter(p => p.active)

  function togglePlayer(pid) {
    setSelectedPlayers(prev => {
      if (prev[pid]) { const c = { ...prev }; delete c[pid]; return c }
      const p = activePlayers.find(pl => pl.id === pid)
      return { ...prev, [pid]: { name: p.nickname || p.name, goals: 0, assists: 0 } }
    })
  }

  function updatePlayerStat(pid, field, value) {
    setSelectedPlayers(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))
  }

  async function importMatch() {
    if (!date || Object.keys(selectedPlayers).length === 0) return
    setSaving(true); setSuccess('')
    const { data: me } = await supabase.from('players').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    const { data: match } = await supabase.from('matches').insert({ date, status: 'finished', created_by: me.id, notes: 'Importado do historico' }).select().single()
    if (!match) { setSaving(false); alert('Erro'); return }
    await supabase.from('confirmations').insert(Object.keys(selectedPlayers).map(pid => ({ match_id: match.id, player_id: pid, status: 'confirmed' })))
    await supabase.from('match_stats').insert(Object.entries(selectedPlayers).map(([pid, s]) => ({ match_id: match.id, player_id: pid, goals: parseInt(s.goals) || 0, assists: parseInt(s.assists) || 0, present: true })))
    setDate(''); setSelectedPlayers({}); setSaving(false); setSuccess('Racha importado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
    onReload()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-4">
        <div className="glass-card p-5 lg:p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <History size={18} className="text-primary-container" /> Importar racha passado
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">Cadastre rachas anteriores para alimentar o dashboard e os rankings.</p>
          {success && (
            <div className="bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed text-sm rounded-lg px-4 py-3 mb-4">
              {success}
            </div>
          )}
          <label className="label-caps mb-1.5 block">Data do racha</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
        </div>

        <div className="glass-card p-5 lg:p-6">
          <h3 className="text-sm font-bold text-white mb-3">Quem jogou?</h3>
          <div className="flex flex-wrap gap-1.5">
            {activePlayers.map(p => (
              <button key={p.id} onClick={() => togglePlayer(p.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                  selectedPlayers[p.id]
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-white'
                }`}>
                {p.nickname || p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-7">
        {Object.keys(selectedPlayers).length > 0 ? (
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-lg font-bold text-white mb-4">Gols e assistencias</h3>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {Object.entries(selectedPlayers).map(([pid, s]) => (
                <div key={pid} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <p className="text-sm font-semibold text-white mb-2">{s.name}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-caps mb-1 block">Gols</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updatePlayerStat(pid, 'goals', Math.max(0, s.goals - 1))}
                          className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
                        <span className="text-white font-extrabold text-lg w-8 text-center tabular-nums">{s.goals}</span>
                        <button onClick={() => updatePlayerStat(pid, 'goals', s.goals + 1)}
                          className="bg-primary-container text-on-primary w-9 h-9 rounded-lg text-lg font-bold hover:bg-primary">+</button>
                      </div>
                    </div>
                    <div>
                      <label className="label-caps mb-1 block">Assist.</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updatePlayerStat(pid, 'assists', Math.max(0, s.assists - 1))}
                          className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
                        <span className="text-white font-extrabold text-lg w-8 text-center tabular-nums">{s.assists}</span>
                        <button onClick={() => updatePlayerStat(pid, 'assists', s.assists + 1)}
                          className="bg-tertiary-container text-on-tertiary w-9 h-9 rounded-lg text-lg font-bold hover:bg-tertiary">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={importMatch} disabled={saving || !date}
              className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2">
              <Save size={16} /> {saving ? 'Salvando...' : 'Importar Racha'}
            </button>
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <Users size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
            <p className="text-on-surface-variant">Selecione quem jogou para comecar.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Input numerico para stats FIFA (slider + numero)
function StatInput({ label, value, onChange }) {
  const v = parseInt(value) || 70
  const color = v >= 85 ? "text-primary-container" : v >= 75 ? "text-tertiary-container" : v >= 65 ? "text-secondary-fixed" : "text-on-surface"
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className={`text-lg font-black tabular-nums ${color}`}>{v}</span>
      </div>
      <input type="range" min="40" max="99" value={v} onChange={e => onChange(e.target.value)}
        className="w-full accent-[#d4af37] h-1" />
    </div>
  )
}

