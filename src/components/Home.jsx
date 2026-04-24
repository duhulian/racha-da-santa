import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Target, Handshake, Users, Calendar, ChevronRight, MapPin, History, Trophy, Clock, Star } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const [topScorers, setTopScorers] = useState([])
  const [topAssists, setTopAssists] = useState([])
  const [generalStats, setGeneralStats] = useState({ totalMatches: 0, totalPlayers: 0, totalGoals: 0 })
  const [recentMatches, setRecentMatches] = useState([])
  const [nextMatch, setNextMatch] = useState(null)
  const [playerOfTheMonth, setPlayerOfTheMonth] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
      // Proximo racha aberto
      const { data: openMatches } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['open', 'sorted'])
        .order('date', { ascending: true })
        .limit(1)

      if (openMatches && openMatches.length > 0) {
        const m = openMatches[0]
        const { count } = await supabase
          .from('confirmations').select('*', { count: 'exact', head: true })
          .eq('match_id', m.id).eq('status', 'confirmed')
        setNextMatch({ ...m, confirmedCount: count || 0 })
      }

      // Rachas recentes finalizados
      const { data: recent } = await supabase
        .from('matches').select('*').eq('status', 'finished')
        .order('date', { ascending: false }).limit(5)

      const enriched = []
      if (recent) {
        for (const m of recent) {
          const { data: winner } = await supabase
            .from('teams').select('name').eq('match_id', m.id).eq('won', true).limit(1)
          const { data: mStats } = await supabase
            .from('match_stats').select('goals, players(nickname, name)')
            .eq('match_id', m.id).order('goals', { ascending: false }).limit(1)
          enriched.push({
            ...m,
            winnerName: winner?.[0]?.name || null,
            topScorer: mStats?.[0]?.goals > 0 ? {
              name: mStats[0].players?.nickname || mStats[0].players?.name,
              goals: mStats[0].goals
            } : null
          })
        }
      }
      setRecentMatches(enriched)

      // Stats gerais
      const { count: totalMatches } = await supabase
        .from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished')
      const { count: totalPlayers } = await supabase
        .from('players').select('*', { count: 'exact', head: true }).eq('active', true)

      const { data: allStats } = await supabase
        .from('match_stats').select('goals, assists, player_id, players(name, nickname, position, shirt_number, photo_url, overall)')

      let totalGoals = 0
      const playerGoals = {}
      const playerAssists = {}
      const playerTotalGoals = {}

      if (allStats) {
        allStats.forEach(s => {
          totalGoals += s.goals
          const pName = s.players?.nickname || s.players?.name || 'Jogador'
          if (!playerGoals[s.player_id]) playerGoals[s.player_id] = { name: pName, value: 0 }
          playerGoals[s.player_id].value += s.goals
          if (!playerAssists[s.player_id]) playerAssists[s.player_id] = { name: pName, value: 0 }
          playerAssists[s.player_id].value += s.assists

          if (!playerTotalGoals[s.player_id]) {
            playerTotalGoals[s.player_id] = {
              id: s.player_id,
              name: s.players?.name,
              nickname: s.players?.nickname,
              photo: s.players?.photo_url,
              position: s.players?.position,
              overall: s.players?.overall || 70,
              goals: 0, assists: 0
            }
          }
          playerTotalGoals[s.player_id].goals += s.goals
          playerTotalGoals[s.player_id].assists += s.assists
        })
      }

      // Player of the Month: maior artilheiro dos ultimos 30 dias
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = thirtyDaysAgo.toISOString().split('T')[0]

      const { data: monthMatches } = await supabase
        .from('matches').select('id').eq('status', 'finished').gte('date', startDate)
      if (monthMatches && monthMatches.length > 0) {
        const { data: monthStats } = await supabase.from('match_stats')
          .select('goals, assists, motm, player_id, players(name, nickname, position, photo_url, overall)')
          .in('match_id', monthMatches.map(m => m.id))

        const pMap = {}
        monthStats?.forEach(s => {
          if (!pMap[s.player_id]) pMap[s.player_id] = {
            id: s.player_id,
            name: s.players?.nickname || s.players?.name,
            position: s.players?.position,
            photo: s.players?.photo_url,
            overall: s.players?.overall || 70,
            goals: 0, assists: 0, motm: 0
          }
          pMap[s.player_id].goals += (s.goals || 0)
          pMap[s.player_id].assists += (s.assists || 0)
          if (s.motm) pMap[s.player_id].motm += 1
        })
        const sorted = Object.values(pMap).sort((a, b) => (b.goals * 2 + b.assists + b.motm * 3) - (a.goals * 2 + a.assists + a.motm * 3))
        if (sorted.length > 0 && sorted[0].goals > 0) setPlayerOfTheMonth(sorted[0])
      }

      setGeneralStats({ totalMatches: totalMatches || 0, totalPlayers: totalPlayers || 0, totalGoals })
      setTopScorers(Object.values(playerGoals).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5))
      setTopAssists(Object.values(playerAssists).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando...</p>
      </div>
    )
  }

  const maxGoals = topScorers[0]?.value || 1
  const maxAssists = topAssists[0]?.value || 1

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* ============ NEXT MATCH HERO ============ */}
      {nextMatch ? (
        <NextMatchHero match={nextMatch} onClick={() => navigate(`/confirmar/${nextMatch.token}`)} />
      ) : (
        <div className="glass-card p-6 text-center">
          <Calendar size={32} className="text-on-surface-variant/60 mx-auto mb-2" />
          <p className="text-on-surface-variant">Nenhum racha aberto no momento.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        {/* Coluna esquerda */}
        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            <StatBentoCard icon={Calendar} value={generalStats.totalMatches} label="Rachas" color="primary-container" />
            <StatBentoCard icon={Users} value={generalStats.totalPlayers} label="Jogadores" color="tertiary-container" />
            <StatBentoCard icon={Target} value={generalStats.totalGoals} label="Gols" color="secondary-fixed" />
          </div>

          {/* Rachas Recentes */}
          {recentMatches.length > 0 && (
            <div className="glass-card p-5 lg:p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <History size={18} className="text-primary-container" />
                Rachas Recentes
              </h3>
              <div className="divide-y divide-white/5">
                {recentMatches.map(m => {
                  const d = new Date(m.date + 'T12:00:00')
                  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  return (
                    <button key={m.id} onClick={() => navigate(`/racha/${m.id}`)}
                      className="w-full flex items-center justify-between py-3 group hover:bg-white/[0.02] transition -mx-5 lg:-mx-6 px-5 lg:px-6 text-left">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="text-sm text-on-surface-variant w-12 shrink-0 tabular-nums">{dateStr}</span>
                        <div className="flex items-center gap-2 min-w-0">
                          {m.winnerName && (
                            <>
                              <Trophy size={14} className="text-primary-container shrink-0" />
                              <span className="text-sm font-semibold text-white truncate">{m.winnerName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {m.topScorer && (
                        <span className="text-xs text-on-surface-variant whitespace-nowrap hidden sm:flex items-center gap-1">
                          <Target size={12} className="text-primary-container" />
                          {m.topScorer.name} ({m.topScorer.goals})
                        </span>
                      )}
                      <ChevronRight size={16} className="text-on-surface-variant/50 ml-2 shrink-0" />
                    </button>
                  )
                })}
              </div>
              <button onClick={() => navigate('/rachas')}
                className="w-full mt-4 py-2 border border-white/10 rounded-lg text-sm text-on-surface-variant hover:bg-white/5 hover:text-white transition">
                Ver todos
              </button>
            </div>
          )}
        </div>

        {/* Coluna direita */}
        <div className="lg:col-span-4 space-y-4 lg:space-y-6">
          {/* Player of the Month */}
          {playerOfTheMonth && (
            <PlayerOfTheMonthCard player={playerOfTheMonth} onClick={() => navigate(`/jogador/${playerOfTheMonth.id}`)} />
          )}

          {/* Top Scorers */}
          {topScorers.length > 0 && (
            <div className="glass-card p-5 lg:p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Target size={16} className="text-primary-container" />
                Top Artilheiros
              </h3>
              <div className="space-y-3">
                {topScorers.map((p, i) => (
                  <BarItem key={i} name={p.name} value={p.value} max={maxGoals} color="primary-container" />
                ))}
              </div>
            </div>
          )}

          {/* Top Assists */}
          {topAssists.length > 0 && (
            <div className="glass-card p-5 lg:p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Handshake size={16} className="text-tertiary-container" />
                Top Assistencias
              </h3>
              <div className="space-y-3">
                {topAssists.map((p, i) => (
                  <BarItem key={i} name={p.name} value={p.value} max={maxAssists} color="tertiary-container" />
                ))}
              </div>
            </div>
          )}

          {topScorers.length === 0 && !playerOfTheMonth && (
            <div className="glass-card p-6 text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-on-surface-variant text-sm">Os rankings aparecem quando o primeiro racha for finalizado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ NEXT MATCH HERO ============
function NextMatchHero({ match, onClick }) {
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 })

  useEffect(() => {
    function updateCountdown() {
      const matchDateTime = new Date(`${match.date}T${match.match_time || '20:00'}:00`)
      const now = new Date()
      const diff = matchDateTime - now

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0 })
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setCountdown({ days, hours, minutes })
    }
    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // atualiza a cada minuto
    return () => clearInterval(interval)
  }, [match.date, match.match_time])

  const d = new Date(match.date + 'T12:00:00')
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' })
  const dayFormat = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="glass-card p-6 lg:p-8 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="label-caps text-primary-container">Proximo Racha</span>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white mt-2 tracking-tight">
            {match.name || `Racha ${dayFormat}`}
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-on-surface-variant text-sm">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-primary-container" />
              {match.location || 'Arena Santa'}
            </span>
            <span className="text-on-surface-variant/40">|</span>
            <span className="flex items-center gap-1.5 capitalize">
              <Calendar size={14} className="text-primary-container" />
              {weekday}, {(match.match_time || '20:00').substring(0, 5)}
            </span>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex gap-2">
          <CountdownBlock value={countdown.days} label="DIAS" />
          <CountdownBlock value={countdown.hours} label="HRS" />
          <CountdownBlock value={countdown.minutes} label="MIN" />
        </div>
      </div>

      {/* Match Status */}
      <div className="relative mt-6 pt-5 border-t border-white/5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-secondary-container/15 border border-secondary-container/30 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-secondary-fixed shadow-[0_0_8px_rgba(121,255,91,0.7)]"></span>
            <span className="text-xs font-bold text-secondary-fixed">
              {match.status === 'open' ? 'CONFIRMACAO ABERTA' : 'TIMES SORTEADOS'}
            </span>
          </div>
          <span className="text-sm text-on-surface-variant">
            <strong className="text-white">{match.confirmedCount}</strong> confirmados
          </span>
        </div>
        <button onClick={onClick} className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2">
          {match.status === 'open' ? 'Ver Confirmacoes' : 'Ver Escalacao'}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function CountdownBlock({ value, label }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-center min-w-[60px]">
      <p className="text-2xl lg:text-3xl font-black text-white tabular-nums leading-none">
        {String(value).padStart(2, '0')}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">{label}</p>
    </div>
  )
}

// ============ PLAYER OF THE MONTH ============
function PlayerOfTheMonthCard({ player, onClick }) {
  const overallColor = player.overall >= 85 ? 'text-primary-container' : player.overall >= 75 ? 'text-tertiary-container' : 'text-on-surface'
  const positionMap = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'FW' }

  return (
    <button onClick={onClick}
      className="w-full relative rounded-3xl overflow-hidden border border-primary-container/30 bg-gradient-to-b from-primary-container/15 to-surface/80 p-5 text-left hover:shadow-[0_0_40px_rgba(212,175,55,0.25)] transition-shadow">
      <div className="flex items-center gap-1.5 mb-3 text-primary-container">
        <Star size={14} />
        <span className="text-[11px] font-bold uppercase tracking-wider">Jogador do Mes</span>
      </div>

      <div className="flex items-center justify-center mb-3">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-2 border-primary-container overflow-hidden bg-surface-container-high shadow-[0_0_30px_rgba(212,175,55,0.4)]">
            {player.photo ? (
              <img src={player.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-black text-on-surface-variant">
                {(player.name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
          </div>
          <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary-container text-on-primary text-xs font-black px-2 py-0.5 rounded-full tabular-nums`}>
            {player.overall}
          </span>
        </div>
      </div>

      <h4 className="text-center text-lg font-black text-white">{player.name}</h4>
      <div className="flex items-center justify-center gap-1 mt-0.5">
        <span className="chip chip-atacante">{positionMap[player.position] || 'JOG'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-white/5">
        <MiniStat label="GLS" value={player.goals} />
        <MiniStat label="AST" value={player.assists} />
        <MiniStat label="MOTM" value={player.motm} />
      </div>
    </button>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-lg font-black text-white tabular-nums">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">{label}</p>
    </div>
  )
}

function StatBentoCard({ icon: Icon, value, label, color }) {
  return (
    <div className="glass-card p-4 lg:p-5 flex flex-col items-center justify-center relative overflow-hidden text-center">
      <Icon size={22} className={`text-${color}/40 absolute top-2 right-2 lg:top-3 lg:right-3`} />
      <span className="text-3xl lg:text-4xl font-extrabold text-white tabular-nums">{value}</span>
      <span className="label-caps mt-1">{label}</span>
    </div>
  )
}

function BarItem({ name, value, max, color }) {
  const pct = Math.max(5, (value / max) * 100)
  const textColor = color === 'primary-container' ? 'text-primary-container' : 'text-tertiary-container'
  const barGradient = color === 'primary-container'
    ? 'from-primary-container/40 to-primary-container'
    : 'from-tertiary-container/40 to-tertiary-container'
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span className="text-sm font-semibold text-white truncate">{name}</span>
        <span className={`text-sm font-bold ${textColor} tabular-nums shrink-0 ml-2`}>{value}</span>
      </div>
      <div className="w-full bg-white/[0.06] rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${barGradient}`} style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  )
}
