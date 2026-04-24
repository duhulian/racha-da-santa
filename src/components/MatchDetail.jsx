import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Trophy, Target, Handshake, ArrowLeft, Shield, Swords, Calendar } from 'lucide-react'

const POSITION_ORDER = { goleiro: 0, zagueiro: 1, meia: 2, atacante: 3 }
const POSITION_LABELS = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }
const POSITION_CHIP = { goleiro: 'chip-goleiro', zagueiro: 'chip-zagueiro', meia: 'chip-meia', atacante: 'chip-atacante' }

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
      <div className="text-center py-16">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando racha...</p>
      </div>
    )
  }

  if (!match) return <div className="text-center py-12 text-on-surface-variant">Racha nao encontrado.</div>

  const matchDate = new Date(match.date + 'T12:00:00')
  const dayFormat = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const weekdayFormat = matchDate.toLocaleDateString('pt-BR', { weekday: 'long' })

  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')
  const waitlist = teams.find(t => t.name === 'Lista de Espera')
  const winnerTeam = regularTeams.find(t => t.won)

  // Classificacao
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
      gamesPlayed, wins, draws, losses, goalsFor, goalsAgainst,
      goalDiff: goalsFor - goalsAgainst,
      points: wins * 3 + draws
    }
  }).sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)

  const topScorers = [...stats].sort((a, b) => b.goals - a.goals).filter(s => s.goals > 0).slice(0, 3)
  const topAssist = [...stats].sort((a, b) => b.assists - a.assists).filter(s => s.assists > 0).slice(0, 1)
  const totalGoals = stats.reduce((sum, s) => sum + s.goals, 0)
  const totalAssists = stats.reduce((sum, s) => sum + s.assists, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-white transition text-sm">
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Cabecalho */}
      <div className="glass-card p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary-container/10 rounded-full blur-3xl"></div>
        <div className="relative">
          <span className="label-caps text-primary-container flex items-center gap-2">
            <Calendar size={14} /> Sumula do Racha
          </span>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white capitalize mt-2 tracking-tight">{weekdayFormat}</h2>
          <p className="text-on-surface-variant text-lg mt-1 capitalize">{dayFormat}</p>
          {match.notes && match.notes !== 'Importado do historico' && (
            <p className="text-on-surface-variant/80 text-sm mt-2 italic">{match.notes}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Esquerda: Campeao + classificacao + jogos */}
        <div className="lg:col-span-8 space-y-6">
          {/* Campeao */}
          {match.status === 'finished' && winnerTeam && (
            <div className="glass-card p-6 lg:p-8 relative overflow-hidden border-primary-container/30">
              <Trophy size={120} className="absolute -bottom-8 -right-4 text-primary-container/10" />
              <span className="label-caps text-primary-container">Campeao da Noite</span>
              <p className="text-3xl lg:text-4xl font-extrabold text-white mt-2 tracking-tight">{winnerTeam.name}</p>
              <div className="flex gap-6 mt-5 pt-5 border-t border-white/5">
                <Metric value={classification[0]?.wins || 0} label="Vitorias" />
                <Metric value={classification[0]?.goalsFor || 0} label="Gols Pro" />
                <Metric value={totalGoals} label="Total Gols" highlight />
              </div>
            </div>
          )}

          {/* Classificacao */}
          {games.length > 0 && classification.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="p-5 lg:p-6 border-b border-white/5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy size={18} className="text-primary-container" /> Classificacao
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm tabular-nums">
                  <thead className="bg-white/[0.02]">
                    <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      <th className="px-4 py-3 w-8">#</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-2 py-3 text-center w-10">J</th>
                      <th className="px-2 py-3 text-center w-10">V</th>
                      <th className="px-2 py-3 text-center w-10">E</th>
                      <th className="px-2 py-3 text-center w-10">D</th>
                      <th className="px-2 py-3 text-center w-12">SG</th>
                      <th className="px-4 py-3 text-center w-14 text-primary-container">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classification.map((t, i) => (
                      <tr key={t.id} className={`border-b border-white/5 last:border-0 ${t.won ? 'bg-primary-container/5' : ''}`}>
                        <td className="px-4 py-3 font-bold text-on-surface-variant">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-white">
                          {t.name} {t.won && <span className="text-primary-container">🏆</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-on-surface-variant">{t.gamesPlayed}</td>
                        <td className="px-2 py-3 text-center text-secondary-fixed font-semibold">{t.wins}</td>
                        <td className="px-2 py-3 text-center text-on-surface-variant">{t.draws}</td>
                        <td className="px-2 py-3 text-center text-error">{t.losses}</td>
                        <td className={`px-2 py-3 text-center ${t.goalDiff > 0 ? 'text-secondary-fixed' : t.goalDiff < 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {t.goalDiff > 0 ? '+' : ''}{t.goalDiff}
                        </td>
                        <td className="px-4 py-3 text-center font-extrabold text-primary-container">{t.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Jogos */}
          {games.length > 0 && (
            <div className="glass-card p-5 lg:p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Swords size={18} className="text-primary-container" /> Jogos ({games.length})
              </h3>
              <div className="space-y-3">
                {games.map(g => {
                  const tA = regularTeams.find(t => t.id === g.team_a_id)
                  const tB = regularTeams.find(t => t.id === g.team_b_id)
                  return (
                    <div key={g.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-caps">Jogo {g.game_number}</span>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <span className={`text-sm lg:text-base font-bold text-right truncate ${g.score_a > g.score_b ? 'text-primary-container' : g.score_a < g.score_b ? 'text-on-surface-variant' : 'text-white'}`}>
                          {tA?.name}
                        </span>
                        <span className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg font-extrabold text-xl lg:text-2xl tabular-nums text-white whitespace-nowrap">
                          {g.score_a} <span className="text-on-surface-variant/60 text-sm">x</span> {g.score_b}
                        </span>
                        <span className={`text-sm lg:text-base font-bold truncate ${g.score_b > g.score_a ? 'text-primary-container' : g.score_b < g.score_a ? 'text-on-surface-variant' : 'text-white'}`}>
                          {tB?.name}
                        </span>
                      </div>
                      {g.game_goals?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                          {g.game_goals.map((gl, i) => (
                            <p key={i} className="text-xs text-on-surface-variant">
                              <Target size={10} className="inline mr-1 text-primary-container" />
                              {gl.scorer?.nickname || gl.scorer?.name}
                              {gl.assister && (
                                <span className="text-on-surface-variant/70"> (assist. {gl.assister?.nickname || gl.assister?.name})</span>
                              )}
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
        </div>

        {/* Direita: destaques + escalacoes */}
        <div className="lg:col-span-4 space-y-6">
          {/* Destaques individuais */}
          {match.status === 'finished' && stats.length > 0 && (
            <div className="glass-card p-5 lg:p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy size={18} className="text-primary-container" /> Destaques
              </h3>

              {topScorers.length > 0 && (
                <div className="mb-4">
                  <p className="label-caps mb-2 flex items-center gap-1.5">
                    <Target size={11} className="text-primary-container" /> Artilheiros
                  </p>
                  <div className="space-y-2">
                    {topScorers.map((s, i) => (
                      <HighlightRow key={s.id} pos={i + 1} player={s.players} value={s.goals} unit="G" color="primary-container" />
                    ))}
                  </div>
                </div>
              )}

              {topAssist.length > 0 && (
                <div>
                  <p className="label-caps mb-2 flex items-center gap-1.5">
                    <Handshake size={11} className="text-tertiary-container" /> Assistencias
                  </p>
                  <HighlightRow pos={1} player={topAssist[0].players} value={topAssist[0].assists} unit="A" color="tertiary-container" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/5">
                <Metric small value={totalGoals} label="Gols" />
                <Metric small value={totalAssists} label="Assist" />
                <Metric small value={games.length} label="Jogos" />
              </div>
            </div>
          )}

          {/* Escalacoes */}
          {regularTeams.length > 0 && (
            <>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield size={18} className="text-primary-container" /> Escalacao
              </h3>
              {regularTeams.map(team => {
                const sorted = [...(team.team_players || [])].sort((a, b) =>
                  (POSITION_ORDER[a.players?.position] ?? 99) - (POSITION_ORDER[b.players?.position] ?? 99)
                )
                const hasGk = sorted.some(tp => tp.players?.position === 'goleiro')
                const getPS = (pid) => stats.find(s => s.player_id === pid)

                return (
                  <div key={team.id} className={`glass-card p-5 ${team.won ? 'border-primary-container/40' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-bold">{team.name} {team.won && '🏆'}</h4>
                      <span className="text-xs text-on-surface-variant">{sorted.length} jog.</span>
                    </div>
                    {!hasGk && (
                      <p className="text-xs text-primary-container/80 bg-primary-container/5 rounded-lg px-2 py-1.5 mb-3 border border-primary-container/15">
                        Sem goleiro fixo. Gol revezado entre jogadores de linha.
                      </p>
                    )}
                    <div className="space-y-1.5">
                      {sorted.map(tp => {
                        const p = tp.players
                        const pS = getPS(tp.player_id)
                        const chipClass = POSITION_CHIP[p?.position] || ''
                        return (
                          <div key={tp.player_id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.03] last:border-0">
                            {p?.photo_url ? (
                              <img src={p.photo_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-xs font-bold text-on-surface-variant">
                                {p?.shirt_number || '?'}
                              </div>
                            )}
                            <span className={`chip ${chipClass} shrink-0`}>{POSITION_LABELS[p?.position] || '---'}</span>
                            <span className="text-sm text-white flex-1 truncate">{p?.nickname || p?.name}</span>
                            {pS && (pS.goals > 0 || pS.assists > 0) && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                {pS.goals > 0 && <span className="text-xs font-bold text-primary-container">{pS.goals}G</span>}
                                {pS.assists > 0 && <span className="text-xs font-bold text-tertiary-container">{pS.assists}A</span>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Lista de espera */}
          {waitlist && waitlist.team_players?.length > 0 && (
            <div className="glass-card p-5">
              <h4 className="label-caps mb-3">Lista de Espera ({waitlist.team_players.length})</h4>
              <div className="flex flex-wrap gap-1.5">
                {waitlist.team_players.map(tp => (
                  <span key={tp.player_id} className="text-xs bg-white/[0.04] border border-white/10 text-on-surface-variant px-2.5 py-1 rounded-md">
                    {tp.players?.nickname || tp.players?.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Metric({ value, label, highlight, small }) {
  return (
    <div>
      <p className={`${small ? 'text-lg' : 'text-2xl lg:text-3xl'} font-extrabold tabular-nums ${highlight ? 'text-primary-container' : 'text-white'}`}>
        {value}
      </p>
      <p className="label-caps mt-0.5">{label}</p>
    </div>
  )
}

function HighlightRow({ pos, player, value, unit, color }) {
  const badgeColors = {
    1: 'bg-primary-container/20 text-primary-container',
    2: 'bg-white/10 text-white/80',
    3: 'bg-amber-700/20 text-amber-700',
  }
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${badgeColors[pos] || badgeColors[3]}`}>{pos}</div>
      {player?.photo_url ? (
        <img src={player.photo_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-[10px] font-bold text-on-surface-variant">
          {(player?.nickname || player?.name || '?').slice(0, 2).toUpperCase()}
        </div>
      )}
      <span className="text-sm text-white flex-1 truncate">{player?.nickname || player?.name}</span>
      <span className={`text-sm font-bold text-${color} tabular-nums`}>{value}{unit}</span>
    </div>
  )
}
