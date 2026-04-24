import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  Play, Pause, Plus, X, Zap, Clock, Target,
  Flag, AlertCircle, Users, Activity, ArrowLeft
} from 'lucide-react'

// =============================================
// LIVE MATCH CONTROL
// Controle ao vivo de um matchday com multiplos games
// Regras:
// - 2 times jogam, resto espera na fila
// - Vencedor fica na quadra, perdedor vai pro fim da fila
// - Empate resolvido em penalties (nao automatico, admin decide vencedor)
// - Tempo padrao por game: 10 min OU 2 gols (o que vier primeiro)
// =============================================

const GAME_TIME_LIMIT_SECONDS = 600     // 10 minutos
const GOAL_LIMIT = 2                    // 2 gols encerra

export default function LiveMatchControl({ matchId, onClose }) {
  const [match, setMatch] = useState(null)
  const [teams, setTeams] = useState([])
  const [teamPlayers, setTeamPlayers] = useState({})
  const [games, setGames] = useState([])
  const [liveState, setLiveState] = useState(null)
  const [loading, setLoading] = useState(true)

  // Estado do jogo em andamento
  const [currentGame, setCurrentGame] = useState(null)
  const [currentGoals, setCurrentGoals] = useState([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal de adicionar gol
  const [addingGoal, setAddingGoal] = useState(null)  // teamId quando aberto

  const tickRef = useRef(null)

  useEffect(() => { loadAll() }, [matchId])

  // Cronometro
  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(() => {
        setElapsedSeconds(s => s + 1)
      }, 1000)
    } else if (tickRef.current) {
      clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [running])

  // Auto finalizar se atingiu limite de tempo ou gols
  useEffect(() => {
    if (!currentGame || !running) return
    const goalsA = currentGoals.filter(g => g.teamId === currentGame.team_a_id).length
    const goalsB = currentGoals.filter(g => g.teamId === currentGame.team_b_id).length
    if (goalsA >= GOAL_LIMIT || goalsB >= GOAL_LIMIT) {
      setRunning(false)
      // nao finaliza automatico, admin precisa clicar
    }
    if (elapsedSeconds >= GAME_TIME_LIMIT_SECONDS) {
      setRunning(false)
    }
  }, [elapsedSeconds, currentGoals, currentGame, running])

  async function loadAll() {
    setLoading(true)

    const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single()
    setMatch(m)

    const { data: t } = await supabase.from('teams')
      .select('*, team_players(player_id, players(id, name, nickname, position, shirt_number, photo_url, overall))')
      .eq('match_id', matchId)
    const allTeams = t || []
    setTeams(allTeams)

    const tpMap = {}
    allTeams.forEach(team => {
      tpMap[team.id] = team.team_players?.map(tp => tp.players) || []
    })
    setTeamPlayers(tpMap)

    const { data: g } = await supabase.from('games')
      .select('*, game_goals(*, scorer:scorer_id(name, nickname), assister:assist_id(name, nickname))')
      .eq('match_id', matchId).order('game_number', { ascending: true })
    setGames(g || [])

    const { data: ls } = await supabase.from('match_live_state').select('*').eq('match_id', matchId).maybeSingle()

    // Se nao tem estado ao vivo, cria com fila inicial (todos times jogaveis)
    if (!ls) {
      const regular = allTeams.filter(tm => tm.name !== 'Lista de Espera')
      const initialQueue = regular.map(tm => tm.id)
      const { data: newLs } = await supabase.from('match_live_state').insert({
        match_id: matchId,
        team_queue: initialQueue,
      }).select().single()
      setLiveState(newLs)
    } else {
      setLiveState(ls)
    }

    setLoading(false)
  }

  // Pega os 2 times do topo da fila
  function nextTwoTeams() {
    if (!liveState) return [null, null]
    const queue = liveState.team_queue || []
    return [queue[0] || null, queue[1] || null]
  }

  // Inicia um novo game com os 2 primeiros da fila
  async function startNewGame() {
    const [aId, bId] = nextTwoTeams()
    if (!aId || !bId) {
      alert('Fila de times incompleta.')
      return
    }
    setSaving(true)
    const nextNumber = games.length + 1

    const { data: game, error } = await supabase.from('games').insert({
      match_id: matchId,
      game_number: nextNumber,
      team_a_id: aId,
      team_b_id: bId,
      score_a: 0,
      score_b: 0,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    }).select().single()

    if (error || !game) {
      alert('Erro ao iniciar game: ' + (error?.message || 'desconhecido'))
      setSaving(false)
      return
    }

    await supabase.from('match_live_state').update({
      current_game_id: game.id,
      game_started_at: new Date().toISOString(),
    }).eq('match_id', matchId)

    setCurrentGame(game)
    setCurrentGoals([])
    setElapsedSeconds(0)
    setRunning(true)
    setSaving(false)
    loadAll()
  }

  function addGoalLocal(teamId, scorerId, assistId) {
    setCurrentGoals(prev => [
      ...prev,
      { teamId, scorerId, assistId: assistId || null, minute: Math.floor(elapsedSeconds / 60) }
    ])
    setAddingGoal(null)
  }

  function removeGoalLocal(idx) {
    setCurrentGoals(prev => prev.filter((_, i) => i !== idx))
  }

  // Finaliza o game atual com o placar acumulado
  async function finishCurrentGame(winnerTeamId = null) {
    if (!currentGame) return
    setSaving(true)
    setRunning(false)

    const scoreA = currentGoals.filter(g => g.teamId === currentGame.team_a_id).length
    const scoreB = currentGoals.filter(g => g.teamId === currentGame.team_b_id).length

    // Se nao passou winnerId manual, calcula automatico
    let winner = winnerTeamId
    if (!winner) {
      if (scoreA > scoreB) winner = currentGame.team_a_id
      else if (scoreB > scoreA) winner = currentGame.team_b_id
      else {
        // Empate: precisa escolher, nao finaliza
        setSaving(false)
        return
      }
    }

    await supabase.from('games').update({
      score_a: scoreA,
      score_b: scoreB,
      winner_team_id: winner,
      status: 'finished',
      finished_at: new Date().toISOString(),
      duration_seconds: elapsedSeconds,
    }).eq('id', currentGame.id)

    if (currentGoals.length > 0) {
      await supabase.from('game_goals').insert(
        currentGoals.map(g => ({
          game_id: currentGame.id,
          team_id: g.teamId,
          scorer_id: g.scorerId,
          assist_id: g.assistId,
          minute: g.minute,
        }))
      )
    }

    // Atualiza fila: vencedor vai pro topo, perdedor pro fim
    const queue = [...(liveState.team_queue || [])]
    const aId = currentGame.team_a_id
    const bId = currentGame.team_b_id
    const loser = winner === aId ? bId : aId

    // Remove os dois da posicao atual
    const newQueue = queue.filter(id => id !== aId && id !== bId)
    // Vencedor vai pro topo
    newQueue.unshift(winner)
    // Perdedor vai pro fim
    newQueue.push(loser)

    await supabase.from('match_live_state').update({
      current_game_id: null,
      team_queue: newQueue,
      game_started_at: null,
    }).eq('match_id', matchId)

    setCurrentGame(null)
    setCurrentGoals([])
    setElapsedSeconds(0)
    setSaving(false)
    loadAll()
  }

  // Finaliza todo o matchday, calcula stats e muda status pra finished
  async function finalizeMatchday() {
    if (!confirm('Encerrar o matchday e calcular resultados? Isso atualiza os rankings.')) return
    setSaving(true)

    // Pega todos os gols pra calcular stats
    const { data: allGoals } = await supabase.from('game_goals')
      .select('scorer_id, assist_id')
      .in('game_id', games.map(g => g.id))

    // Pega confirmados pra garantir que todos apareçam nas stats
    const { data: confs } = await supabase.from('confirmations')
      .select('player_id').eq('match_id', matchId).eq('status', 'confirmed')

    const playerTotals = {}
    confs?.forEach(c => {
      playerTotals[c.player_id] = { goals: 0, assists: 0, present: true }
    })

    allGoals?.forEach(g => {
      if (!playerTotals[g.scorer_id]) playerTotals[g.scorer_id] = { goals: 0, assists: 0, present: true }
      playerTotals[g.scorer_id].goals += 1
      if (g.assist_id) {
        if (!playerTotals[g.assist_id]) playerTotals[g.assist_id] = { goals: 0, assists: 0, present: true }
        playerTotals[g.assist_id].assists += 1
      }
    })

    // Limpa stats antigas
    await supabase.from('match_stats').delete().eq('match_id', matchId)

    const rows = Object.entries(playerTotals).map(([pid, s]) => ({
      match_id: matchId,
      player_id: pid,
      goals: s.goals,
      assists: s.assists,
      present: s.present,
    }))
    if (rows.length > 0) await supabase.from('match_stats').insert(rows)

    // Define campeao: time com mais vitorias
    const wins = {}
    const regular = teams.filter(t => t.name !== 'Lista de Espera')
    regular.forEach(t => { wins[t.id] = 0 })
    games.forEach(g => {
      if (g.winner_team_id && wins[g.winner_team_id] !== undefined) wins[g.winner_team_id]++
    })
    const maxWins = Math.max(0, ...Object.values(wins))
    const champId = Object.keys(wins).find(id => wins[id] === maxWins && maxWins > 0)

    for (const t of regular) {
      await supabase.from('teams').update({ won: t.id === champId }).eq('id', t.id)
    }

    await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId)
    await supabase.from('match_live_state').delete().eq('match_id', matchId)

    setSaving(false)
    alert('Matchday encerrado! Os rankings foram atualizados.')
    onClose()
  }

  async function discardCurrentGame() {
    if (!currentGame) return
    if (!confirm('Descartar este jogo? Gols nao serao salvos.')) return
    await supabase.from('games').delete().eq('id', currentGame.id)
    await supabase.from('match_live_state').update({
      current_game_id: null,
      game_started_at: null,
    }).eq('match_id', matchId)
    setCurrentGame(null)
    setCurrentGoals([])
    setElapsedSeconds(0)
    setRunning(false)
    loadAll()
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <Activity size={40} className="text-primary-container mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando controle ao vivo...</p>
      </div>
    )
  }

  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')
  const [nextAId, nextBId] = nextTwoTeams()
  const queue = liveState?.team_queue || []
  const waiting = queue.slice(2)

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const matchDate = match ? new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR') : ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-on-surface-variant hover:text-white transition">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap size={14} className="text-primary-container" />
              <span className="label-caps text-primary-container">Live Match Control</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Matchday {matchDate}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-secondary-container/10 border border-secondary-container/30 px-3 py-1.5 rounded-full">
          <span className={`w-2 h-2 rounded-full ${currentGame ? 'bg-secondary-fixed animate-pulse shadow-[0_0_8px_rgba(121,255,91,0.7)]' : 'bg-on-surface-variant/40'}`}></span>
          <span className="text-xs font-bold text-secondary-fixed uppercase tracking-wider">
            {currentGame ? 'Match in Progress' : 'Aguardando inicio'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* COLUNA PRINCIPAL: game atual */}
        <div className="lg:col-span-2 space-y-4">
          {currentGame ? (
            <CurrentGameCard
              game={currentGame}
              teams={regularTeams}
              teamPlayers={teamPlayers}
              goals={currentGoals}
              onAddGoal={(teamId) => setAddingGoal(teamId)}
              onRemoveGoal={removeGoalLocal}
              elapsedSeconds={elapsedSeconds}
              running={running}
              onStartStop={() => setRunning(r => !r)}
              onFinish={finishCurrentGame}
              onDiscard={discardCurrentGame}
              saving={saving}
              timeStr={timeStr}
              timeLimit={GAME_TIME_LIMIT_SECONDS}
              goalLimit={GOAL_LIMIT}
            />
          ) : (
            <NoActiveGameCard
              nextA={regularTeams.find(t => t.id === nextAId)}
              nextB={regularTeams.find(t => t.id === nextBId)}
              onStart={startNewGame}
              saving={saving}
              gameNumber={games.length + 1}
            />
          )}

          {/* Record Event */}
          {currentGame && (
            <RecordEventCard
              game={currentGame}
              teams={regularTeams}
              teamPlayers={teamPlayers}
              onAddGoal={addGoalLocal}
              addingGoal={addingGoal}
              setAddingGoal={setAddingGoal}
            />
          )}

          {/* Botao encerrar matchday */}
          {games.length > 0 && !currentGame && (
            <button onClick={finalizeMatchday} disabled={saving}
              className="w-full bg-error/15 hover:bg-error/25 border border-error/30 text-error font-bold py-4 rounded-xl transition flex items-center justify-center gap-2">
              <Flag size={16} /> {saving ? 'Finalizando...' : 'Encerrar Matchday e Calcular Resultados'}
            </button>
          )}
        </div>

        {/* COLUNA LATERAL */}
        <div className="space-y-4">
          {/* System Suggestion */}
          <SystemSuggestionCard
            currentGame={currentGame}
            currentGoals={currentGoals}
            teams={regularTeams}
            queue={queue}
          />

          {/* Match Log */}
          <MatchLogCard games={games} teams={regularTeams} />

          {/* Fila de times */}
          <TeamQueueCard
            queue={queue}
            teams={regularTeams}
            currentGame={currentGame}
          />
        </div>
      </div>
    </div>
  )
}

// ============ CURRENT GAME CARD ============
function CurrentGameCard({ game, teams, teamPlayers, goals, onAddGoal, onRemoveGoal,
  elapsedSeconds, running, onStartStop, onFinish, onDiscard, saving, timeStr, timeLimit, goalLimit }) {
  const tA = teams.find(t => t.id === game.team_a_id)
  const tB = teams.find(t => t.id === game.team_b_id)
  const scoreA = goals.filter(g => g.teamId === game.team_a_id).length
  const scoreB = goals.filter(g => g.teamId === game.team_b_id).length

  const timeReached = elapsedSeconds >= timeLimit
  const goalsReached = scoreA >= goalLimit || scoreB >= goalLimit
  const canFinishAuto = scoreA !== scoreB
  const pctTime = Math.min(100, (elapsedSeconds / timeLimit) * 100)

  return (
    <div className="glass-card p-5 lg:p-6 border border-primary-container/30 shadow-[0_0_30px_rgba(212,175,55,0.08)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-error animate-pulse"></div>
          <span className="label-caps text-error">Game {game.game_number} - AO VIVO</span>
        </div>
        <button onClick={onDiscard}
          className="text-xs text-on-surface-variant hover:text-error px-2 py-1 rounded hover:bg-error/10 transition">
          Descartar
        </button>
      </div>

      {/* Placar */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-4">
        <div className="text-center">
          <Shield className="mx-auto mb-2 text-primary-container" />
          <p className="text-lg font-bold text-white truncate">{tA?.name || 'Time A'}</p>
          <p className="text-6xl lg:text-7xl font-black text-white tabular-nums leading-none mt-2">{scoreA}</p>
        </div>
        <div className="flex flex-col items-center gap-2 px-3">
          <span className="text-on-surface-variant font-bold">VS</span>
          <div className={`bg-white/[0.06] border ${running ? 'border-error/40 shadow-[0_0_20px_rgba(255,180,171,0.15)]' : 'border-white/10'} px-3 py-1.5 rounded-lg`}>
            <span className="text-white font-black text-lg tabular-nums">{timeStr}</span>
          </div>
          <button onClick={onStartStop}
            className={`p-2 rounded-full transition ${running
              ? 'bg-error/15 text-error hover:bg-error/25'
              : 'bg-secondary-container/15 text-secondary-fixed hover:bg-secondary-container/25'}`}>
            {running ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
        <div className="text-center">
          <FlameIcon className="mx-auto mb-2 text-error" />
          <p className="text-lg font-bold text-white truncate">{tB?.name || 'Time B'}</p>
          <p className="text-6xl lg:text-7xl font-black text-white tabular-nums leading-none mt-2">{scoreB}</p>
        </div>
      </div>

      {/* Progress bar do tempo */}
      <div className="w-full bg-white/[0.05] rounded-full h-1.5 overflow-hidden mb-4">
        <div className={`h-full transition-all duration-500 ${timeReached ? 'bg-error' : 'bg-primary-container'}`}
          style={{ width: `${pctTime}%` }}></div>
      </div>

      {/* Alertas */}
      {(timeReached || goalsReached) && (
        <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-lg px-3 py-2 mb-4 text-sm">
          <AlertCircle size={16} className="text-error shrink-0" />
          <span className="text-error font-semibold">
            {timeReached && 'Tempo limite atingido.'}
            {goalsReached && !timeReached && 'Gol limite atingido.'}
            {' '}Finalize o game.
          </span>
        </div>
      )}

      {/* Artilheiros deste game */}
      {goals.length > 0 && (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-4">
          <p className="label-caps mb-2">Gols deste game</p>
          <div className="space-y-1">
            {goals.map((g, i) => {
              const allP = [...(teamPlayers[game.team_a_id] || []), ...(teamPlayers[game.team_b_id] || [])]
              const scorer = allP.find(p => p.id === g.scorerId)
              const assister = g.assistId ? allP.find(p => p.id === g.assistId) : null
              const teamName = g.teamId === game.team_a_id ? tA?.name : tB?.name
              return (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <span className="text-primary-container">⚽</span>
                  <span className="text-white font-semibold">{scorer?.nickname || scorer?.name}</span>
                  <span className="text-on-surface-variant text-xs">({teamName})</span>
                  {assister && (
                    <span className="text-on-surface-variant text-xs">
                      assist. {assister.nickname || assister.name}
                    </span>
                  )}
                  <span className="text-on-surface-variant/60 text-xs ml-auto">{g.minute}'</span>
                  <button onClick={() => onRemoveGoal(i)}
                    className="text-error/70 hover:text-error p-1">
                    <X size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Acoes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button onClick={() => onAddGoal(game.team_a_id)}
          className="bg-secondary-container/15 hover:bg-secondary-container/25 border border-secondary-container/30 text-secondary-fixed font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm">
          <Target size={14} /> + Gol {tA?.name}
        </button>
        <button onClick={() => onAddGoal(game.team_b_id)}
          className="bg-secondary-container/15 hover:bg-secondary-container/25 border border-secondary-container/30 text-secondary-fixed font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm">
          <Target size={14} /> + Gol {tB?.name}
        </button>
      </div>

      {/* Finalizar game */}
      {(timeReached || goalsReached || elapsedSeconds > 30) && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          {canFinishAuto ? (
            <button onClick={() => onFinish()} disabled={saving}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2">
              <Flag size={16} /> {saving ? 'Salvando...' : `Finalizar game - Vencedor: ${scoreA > scoreB ? tA?.name : tB?.name}`}
            </button>
          ) : (
            <div>
              <p className="text-xs text-on-surface-variant text-center mb-2">
                Empate no placar. Resolveram no penalti? Escolha o vencedor:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onFinish(game.team_a_id)} disabled={saving}
                  className="bg-primary-container/15 border border-primary-container/30 hover:bg-primary-container/25 text-primary-container py-2.5 rounded-lg transition text-sm font-bold">
                  {tA?.name} venceu
                </button>
                <button onClick={() => onFinish(game.team_b_id)} disabled={saving}
                  className="bg-primary-container/15 border border-primary-container/30 hover:bg-primary-container/25 text-primary-container py-2.5 rounded-lg transition text-sm font-bold">
                  {tB?.name} venceu
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ NO ACTIVE GAME ============
function NoActiveGameCard({ nextA, nextB, onStart, saving, gameNumber }) {
  return (
    <div className="glass-card p-8 lg:p-10 text-center">
      <div className="inline-flex items-center gap-2 mb-4 bg-primary-container/10 border border-primary-container/30 px-3 py-1.5 rounded-full">
        <Play size={12} className="text-primary-container" />
        <span className="label-caps text-primary-container">Proximo: Game {gameNumber}</span>
      </div>

      {nextA && nextB ? (
        <>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-6 max-w-lg mx-auto">
            <div>
              <Shield className="mx-auto mb-2 text-primary-container" size={32} />
              <p className="text-xl font-bold text-white">{nextA.name}</p>
            </div>
            <span className="text-on-surface-variant font-bold text-sm">VS</span>
            <div>
              <FlameIcon className="mx-auto mb-2 text-error" size={32} />
              <p className="text-xl font-bold text-white">{nextB.name}</p>
            </div>
          </div>
          <button onClick={onStart} disabled={saving}
            className="btn-primary px-8 py-3.5 flex items-center gap-2 mx-auto">
            <Play size={16} /> {saving ? 'Iniciando...' : 'Iniciar Game'}
          </button>
        </>
      ) : (
        <div className="py-6">
          <Users size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-on-surface-variant">Precisa de pelo menos 2 times na fila.</p>
        </div>
      )}
    </div>
  )
}

// ============ RECORD EVENT (modal de gol) ============
function RecordEventCard({ game, teams, teamPlayers, onAddGoal, addingGoal, setAddingGoal }) {
  const [scorerId, setScorerId] = useState('')
  const [assistId, setAssistId] = useState('')

  if (!addingGoal) return null

  const team = teams.find(t => t.id === addingGoal)
  const players = teamPlayers[addingGoal] || []

  function submit() {
    if (!scorerId) return
    onAddGoal(addingGoal, scorerId, assistId || null)
    setScorerId(''); setAssistId('')
  }

  function cancel() {
    setScorerId(''); setAssistId('')
    setAddingGoal(null)
  }

  return (
    <div className="glass-card p-5 border border-secondary-container/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Target size={16} className="text-secondary-fixed" /> Registrar gol - {team?.name}
        </h3>
        <button onClick={cancel} className="text-on-surface-variant hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="label-caps mb-1.5 block">Time</label>
          <div className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-semibold">
            {team?.name}
          </div>
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Autor</label>
          <select value={scorerId} onChange={e => setScorerId(e.target.value)} className="select-base !py-2.5 text-sm">
            <option value="">Selecionar jogador</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Assistencia (opcional)</label>
          <select value={assistId} onChange={e => setAssistId(e.target.value)} className="select-base !py-2.5 text-sm">
            <option value="">Sem assistencia</option>
            {players.filter(p => p.id !== scorerId).map(p => (
              <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={cancel}
          className="flex-1 bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-white py-2.5 rounded-lg transition text-sm font-bold">
          Cancelar
        </button>
        <button onClick={submit} disabled={!scorerId}
          className="flex-1 bg-secondary-container hover:bg-secondary text-on-surface py-2.5 rounded-lg transition text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">
          Registrar gol
        </button>
      </div>
    </div>
  )
}

// ============ SYSTEM SUGGESTION ============
function SystemSuggestionCard({ currentGame, currentGoals, teams, queue }) {
  if (!currentGame) {
    return (
      <div className="glass-card p-4 border border-tertiary-container/20">
        <div className="flex items-center gap-2 mb-2">
          <BotIcon />
          <h4 className="text-sm font-bold text-white">System Suggestion</h4>
        </div>
        <p className="text-xs text-on-surface-variant">
          Inicie o proximo game pra ver sugestoes automaticas do fluxo.
        </p>
      </div>
    )
  }

  const tA = teams.find(t => t.id === currentGame.team_a_id)
  const tB = teams.find(t => t.id === currentGame.team_b_id)
  const scoreA = currentGoals.filter(g => g.teamId === currentGame.team_a_id).length
  const scoreB = currentGoals.filter(g => g.teamId === currentGame.team_b_id).length
  const nextChallenger = queue.find(id => id !== currentGame.team_a_id && id !== currentGame.team_b_id)
  const challenger = teams.find(t => t.id === nextChallenger)

  let leader = null, loser = null
  if (scoreA > scoreB) { leader = tA; loser = tB }
  else if (scoreB > scoreA) { leader = tB; loser = tA }

  return (
    <div className="glass-card p-4 border border-tertiary-container/20">
      <div className="flex items-center gap-2 mb-3">
        <BotIcon />
        <h4 className="text-sm font-bold text-white">System Suggestion</h4>
      </div>
      {leader ? (
        <p className="text-xs text-on-surface leading-relaxed">
          Se <span className="text-primary-container font-bold">{leader.name}</span> vencer,
          eles ficam na quadra. <span className="text-error font-bold">{loser.name}</span> sai.
          {challenger && <> Proximo: <span className="text-tertiary font-bold">{challenger.name}</span>.</>}
        </p>
      ) : (
        <p className="text-xs text-on-surface-variant">
          Empate por enquanto. Se terminar assim, resolvem no penalti.
        </p>
      )}

      {challenger && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="label-caps mb-1.5">Next Game Preview</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-primary-container font-bold truncate">
              {leader ? leader.name : 'Vencedor'}
            </span>
            <span className="text-on-surface-variant">vs</span>
            <span className="text-tertiary font-bold truncate">{challenger.name}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ MATCH LOG ============
function MatchLogCard({ games, teams }) {
  if (games.length === 0) return null

  const finished = games.filter(g => g.status === 'finished')

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-primary-container" />
        <h4 className="text-sm font-bold text-white">Match Log</h4>
      </div>
      <div className="space-y-2">
        {finished.slice().reverse().map(g => {
          const tA = teams.find(t => t.id === g.team_a_id)
          const tB = teams.find(t => t.id === g.team_b_id)
          const aWon = g.winner_team_id === g.team_a_id
          const bWon = g.winner_team_id === g.team_b_id

          return (
            <div key={g.id} className="text-xs py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-on-surface-variant font-semibold">G{g.game_number}</span>
                {g.duration_seconds && (
                  <span className="text-on-surface-variant/60 text-[10px] tabular-nums">
                    {Math.floor(g.duration_seconds / 60)}:{String(g.duration_seconds % 60).padStart(2, '0')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`truncate ${aWon ? 'text-primary-container font-bold' : 'text-on-surface'}`}>
                  {tA?.name} ({g.score_a})
                </span>
                <span className="text-on-surface-variant text-[10px]">x</span>
                <span className={`truncate ${bWon ? 'text-primary-container font-bold' : 'text-on-surface'}`}>
                  ({g.score_b}) {tB?.name}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ TEAM QUEUE ============
function TeamQueueCard({ queue, teams, currentGame }) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={14} className="text-primary-container" />
        <h4 className="text-sm font-bold text-white">Fila de Times</h4>
      </div>
      <div className="space-y-1.5">
        {queue.map((teamId, idx) => {
          const team = teams.find(t => t.id === teamId)
          if (!team) return null
          const isPlaying = currentGame && (currentGame.team_a_id === teamId || currentGame.team_b_id === teamId)
          return (
            <div key={teamId}
              className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg text-xs ${
                isPlaying
                  ? 'bg-primary-container/15 border border-primary-container/30 text-primary-container font-bold'
                  : 'bg-white/[0.03] text-on-surface'
              }`}>
              <span className="label-caps w-4">#{idx + 1}</span>
              <span className="font-semibold flex-1 truncate">{team.name}</span>
              {isPlaying && <span className="text-[10px] uppercase">jogando</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ ICONES LOCAIS ============
function Shield({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-0.5 8-5 8-10V6l-8-4z" />
    </svg>
  )
}

function FlameIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}

function BotIcon({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#72dcff" strokeWidth="2" className={className}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M8 16h.01M16 16h.01" />
    </svg>
  )
}
