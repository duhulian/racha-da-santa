import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, Target, HandHelping, Users, ArrowLeft, Shield, Swords } from 'lucide-react'

const POSITION_ORDER = { goleiro: 0, zagueiro: 1, meia: 2, atacante: 3 }
const POSITION_LABELS = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }

export default function MatchDetail() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [teams, setTeams] = useState([])
  const [games, setGames] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMatch() }, [matchId])

  async function loadMatch() {
    try {
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).single()
      setMatch(m)

      const { data: teamsData } = await supabase
        .from('teams')
        .select('*, team_players(player_id, players(id, name, nickname, position, shirt_number, photo_url))')
        .eq('match_id', matchId)
      setTeams(teamsData || [])

      const { data: gamesData } = await supabase
        .from('games')
        .select('*, game_goals(*, scorer:scorer_id(name, nickname), assister:assist_id(name, nickname))')
        .eq('match_id', matchId)
        .order('game_number', { ascending: true })
      setGames(gamesData || [])

      const { data: statsData } = await supabase
        .from('match_stats')
        .select('*, players(name, nickname, photo_url, position)')
        .eq('match_id', matchId)
      setStats(statsData || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400">Carregando racha...</p>
      </div>
    )
  }

  if (!match) return <div className="text-center py-12"><p className="text-slate-400">Racha nao encontrado.</p></div>

  const matchDate = new Date(match.date + 'T12:00:00')
  const formattedDate = matchDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')
  const waitlist = teams.find(t => t.name === 'Lista de Espera')
  const winnerTeam = regularTeams.find(t => t.won)

  // Calcular classificacao a partir dos jogos
  const classification = regularTeams.map(team => {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, gamesPlayed = 0

    games.filter(g => g.status === 'finished').forEach(g => {
      if (g.team_a_id === team.id) {
        gamesPlayed++
        goalsFor += g.score_a; goalsAgainst += g.score_b
        if (g.score_a > g.score_b) wins++
        else if (g.score_a < g.score_b) losses++
        else draws++
      } else if (g.team_b_id === team.id) {
        gamesPlayed++
        goalsFor += g.score_b; goalsAgainst += g.score_a
        if (g.score_b > g.score_a) wins++
        else if (g.score_b < g.score_a) losses++
        else draws++
      }
    })

    return {
      id: team.id, name: team.name, won: team.won,
      gamesPlayed, wins, draws, losses,
      goalsFor, goalsAgainst,
      goalDiff: goalsFor - goalsAgainst,
      points: wins * 3 + draws
    }
  }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)

  // Top artilheiros e assistencias do racha
  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).filter(s => s.goals > 0).slice(0, 3)
  const topAssist = [...stats].sort((a, b) => b.assists - a.assists).filter(s => s.assists > 0).slice(0, 1)
  const totalGoals = stats.reduce((sum, s) => sum + s.goals, 0)
  const totalAssists = stats.reduce((sum, s) => sum + s.assists, 0)

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition text-sm">
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Info do racha */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-800 border border-gold-400/20 rounded-2xl p-4 text-center">
        <img src="/logo.png" alt="" className="w-14 h-14 rounded-full mx-auto mb-2 border-2 border-gold-400/30" />
        <h2 className="text-lg font-bold text-white capitalize">{formattedDate}</h2>
        {match.notes && match.notes !== 'Importado do historico' && <p className="text-slate-400 text-sm mt-1">{match.notes}</p>}
      </div>

      {/* Destaques */}
      {match.status === 'finished' && stats.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-gold-400/20">
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2"><Trophy size={14} /> Destaques</h3>

          {winnerTeam && (
            <div className="bg-gold-400/10 rounded-xl p-3 mb-3 flex items-center gap-3">
              <div className="text-2xl">🏆</div>
              <div><p className="text-gold-400 text-xs font-semibold uppercase">Time Campeao</p><p className="text-white font-bold">{winnerTeam.name}</p></div>
            </div>
          )}

          {topScorers.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5"><Target size={12} className="text-gold-400" /> Artilheiros</p>
              {topScorers.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 py-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-gold-400/20 text-gold-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : 'bg-amber-700/20 text-amber-600'}`}>{i + 1}</div>
                  {s.players?.photo_url && <img src={s.players.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />}
                  <span className="text-white text-sm flex-1">{s.players?.nickname || s.players?.name}</span>
                  <span className="text-gold-400 font-bold text-sm">{s.goals} gol{s.goals !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}

          {topAssist.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-slate-400 mb-2 flex items-center gap-1.5"><HandHelping size={12} className="text-blue-400" /> Lider em Assistencias</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">1</div>
                {topAssist[0].players?.photo_url && <img src={topAssist[0].players.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />}
                <span className="text-white text-sm flex-1">{topAssist[0].players?.nickname || topAssist[0].players?.name}</span>
                <span className="text-blue-400 font-bold text-sm">{topAssist[0].assists} assist.</span>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-3 pt-3 border-t border-navy-700">
            <div className="flex-1 text-center"><p className="text-lg font-bold text-white">{totalGoals}</p><p className="text-xs text-slate-500">Gols</p></div>
            <div className="flex-1 text-center"><p className="text-lg font-bold text-white">{totalAssists}</p><p className="text-xs text-slate-500">Assist.</p></div>
            <div className="flex-1 text-center"><p className="text-lg font-bold text-white">{games.length}</p><p className="text-xs text-slate-500">Jogos</p></div>
            <div className="flex-1 text-center"><p className="text-lg font-bold text-white">{stats.filter(s => s.present).length}</p><p className="text-xs text-slate-500">Jogadores</p></div>
          </div>
        </div>
      )}

      {/* Tabela de classificacao */}
      {games.length > 0 && classification.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2"><Trophy size={14} /> Classificacao</h3>

          {/* Header */}
          <div className="flex items-center gap-1 pb-2 border-b border-navy-700 text-xs text-slate-500">
            <span className="w-5 text-center">#</span>
            <span className="flex-1">Time</span>
            <span className="w-6 text-center">J</span>
            <span className="w-6 text-center">V</span>
            <span className="w-6 text-center">E</span>
            <span className="w-6 text-center">D</span>
            <span className="w-8 text-center">SG</span>
            <span className="w-8 text-center font-bold text-gold-400">Pts</span>
          </div>

          {classification.map((t, i) => (
            <div key={t.id} className={`flex items-center gap-1 py-2 text-sm border-b border-navy-700/30 last:border-0 ${t.won ? 'bg-gold-400/5' : ''}`}>
              <span className={`w-5 text-center text-xs font-bold ${i === 0 ? 'text-gold-400' : 'text-slate-500'}`}>{i + 1}</span>
              <span className="flex-1 text-white font-medium truncate">{t.name} {t.won ? '🏆' : ''}</span>
              <span className="w-6 text-center text-slate-400">{t.gamesPlayed}</span>
              <span className="w-6 text-center text-green-400">{t.wins}</span>
              <span className="w-6 text-center text-slate-400">{t.draws}</span>
              <span className="w-6 text-center text-red-400">{t.losses}</span>
              <span className={`w-8 text-center ${t.goalDiff > 0 ? 'text-green-400' : t.goalDiff < 0 ? 'text-red-400' : 'text-slate-400'}`}>{t.goalDiff > 0 ? '+' : ''}{t.goalDiff}</span>
              <span className="w-8 text-center font-bold text-gold-400">{t.points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lista de jogos */}
      {games.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2"><Swords size={14} /> Jogos ({games.length})</h3>
          <div className="space-y-2">
            {games.map(g => {
              const tA = regularTeams.find(t => t.id === g.team_a_id)
              const tB = regularTeams.find(t => t.id === g.team_b_id)
              return (
                <div key={g.id} className="bg-navy-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Jogo {g.game_number}</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <span className={`text-sm font-semibold flex-1 text-right ${g.score_a > g.score_b ? 'text-gold-400' : g.score_a < g.score_b ? 'text-slate-400' : 'text-white'}`}>{tA?.name}</span>
                    <span className="bg-navy-600 px-3 py-1 rounded-lg text-white font-bold">{g.score_a} x {g.score_b}</span>
                    <span className={`text-sm font-semibold flex-1 ${g.score_b > g.score_a ? 'text-gold-400' : g.score_b < g.score_a ? 'text-slate-400' : 'text-white'}`}>{tB?.name}</span>
                  </div>
                  {g.game_goals?.length > 0 && (
                    <div className="mt-1.5 space-y-0.5">
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

      {/* Escalacao */}
      {regularTeams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gold-400 flex items-center gap-2"><Shield size={14} /> Escalacao</h3>
          {regularTeams.map(team => {
            const sorted = [...(team.team_players || [])].sort((a, b) => {
              return (POSITION_ORDER[a.players?.position] ?? 99) - (POSITION_ORDER[b.players?.position] ?? 99)
            })
            const hasGk = sorted.some(tp => tp.players?.position === 'goleiro')
            const getPS = (pid) => stats.find(s => s.player_id === pid)

            return (
              <div key={team.id} className={`bg-navy-800 rounded-2xl p-4 border ${team.won ? 'border-gold-400/40' : 'border-navy-700'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">{team.name} {team.won ? '🏆' : ''}</h4>
                  <span className="text-xs text-slate-500">{sorted.length} jogadores</span>
                </div>
                {!hasGk && <p className="text-xs text-yellow-400/80 bg-yellow-400/10 rounded-lg px-2 py-1 mb-2">Sem goleiro fixo. Gol revezado.</p>}
                <div className="space-y-1.5">
                  {sorted.map(tp => {
                    const p = tp.players; const pS = getPS(tp.player_id)
                    return (
                      <div key={tp.player_id} className="flex items-center gap-2 py-1 border-b border-navy-700/30 last:border-0">
                        {p?.photo_url ? <img src={p.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center text-slate-400 text-xs font-bold">{p?.shirt_number || '?'}</div>}
                        <span className="text-xs text-slate-500 w-8">{POSITION_LABELS[p?.position] || '---'}</span>
                        <span className="text-white text-sm flex-1 truncate">{p?.nickname || p?.name}</span>
                        {pS && (pS.goals > 0 || pS.assists > 0) && (
                          <div className="flex items-center gap-2">
                            {pS.goals > 0 && <span className="text-gold-400 text-xs font-bold">{pS.goals}⚽</span>}
                            {pS.assists > 0 && <span className="text-blue-400 text-xs font-bold">{pS.assists}🅰️</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lista de espera */}
      {waitlist && waitlist.team_players?.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h4 className="text-slate-400 text-sm font-semibold mb-2">Lista de Espera ({waitlist.team_players.length})</h4>
          <div className="flex flex-wrap gap-1.5">
            {waitlist.team_players.map(tp => (
              <span key={tp.player_id} className="text-xs bg-navy-700 text-slate-400 px-2 py-1 rounded">{tp.players?.nickname || tp.players?.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
