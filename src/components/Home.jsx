import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Target, Handshake, Users, Calendar, ChevronRight, MapPin, History, Trophy } from 'lucide-react'

export default function Home() {
  const navigate = useNavigate()
  const [topScorers, setTopScorers] = useState([])
  const [topAssists, setTopAssists] = useState([])
  const [generalStats, setGeneralStats] = useState({ totalMatches: 0, totalPlayers: 0, totalGoals: 0 })
  const [recentMatches, setRecentMatches] = useState([])
  const [nextMatch, setNextMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    try {
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

      const { data: recent } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('date', { ascending: false })
        .limit(5)

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

      const { count: totalMatches } = await supabase
        .from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished')
      const { count: totalPlayers } = await supabase
        .from('players').select('*', { count: 'exact', head: true }).eq('active', true)

      const { data: allStats } = await supabase
        .from('match_stats').select('goals, assists, player_id, players(name, nickname)')

      let totalGoals = 0
      const playerGoals = {}
      const playerAssists = {}

      if (allStats) {
        allStats.forEach(s => {
          totalGoals += s.goals
          const pName = s.players?.nickname || s.players?.name || 'Jogador'
          if (!playerGoals[s.player_id]) playerGoals[s.player_id] = { name: pName, value: 0 }
          playerGoals[s.player_id].value += s.goals
          if (!playerAssists[s.player_id]) playerAssists[s.player_id] = { name: pName, value: 0 }
          playerAssists[s.player_id].value += s.assists
        })
      }

      setGeneralStats({ totalMatches: totalMatches || 0, totalPlayers: totalPlayers || 0, totalGoals })
      setTopScorers(Object.values(playerGoals).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5))
      setTopAssists(Object.values(playerAssists).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5))
    } catch (err) {
      console.error(err)
    }
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

  const matchDate = nextMatch ? new Date(nextMatch.date + 'T12:00:00') : null
  const matchDateLabel = matchDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const maxGoals = topScorers[0]?.value || 1
  const maxAssists = topAssists[0]?.value || 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      {/* Coluna esquerda (principal) */}
      <div className="lg:col-span-7 space-y-4 lg:space-y-6">
        {/* Card: Proximo Racha */}
        {nextMatch ? (
          <div className="glass-card p-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary-container/10 rounded-full blur-3xl"></div>

            <div className="flex items-start justify-between mb-4 relative">
              <div>
                <span className="label-caps text-primary-container">Proximo Racha</span>
                <p className="text-2xl lg:text-3xl font-bold text-white capitalize mt-1 tracking-tight">
                  {matchDateLabel}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-primary-container/15 border border-primary-container/30 px-3 py-1.5 rounded-full whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed shadow-[0_0_8px_rgba(121,255,91,0.7)]"></span>
                <span className="text-xs font-bold text-primary-container">{nextMatch.confirmedCount} Confirmados</span>
              </div>
            </div>

            {nextMatch.notes && (
              <div className="flex items-center gap-2 text-on-surface-variant mb-5 relative">
                <MapPin size={16} />
                <span className="text-sm">{nextMatch.notes}</span>
              </div>
            )}

            <button onClick={() => navigate(`/confirmar/${nextMatch.token}`)}
              className="btn-primary w-full py-3 relative">
              Ver confirmacoes
            </button>
          </div>
        ) : (
          <div className="glass-card p-6 text-center">
            <Calendar size={32} className="text-on-surface-variant/60 mx-auto mb-2" />
            <p className="text-on-surface-variant">Nenhum racha aberto no momento.</p>
          </div>
        )}

        {/* Stats Row */}
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
                    className="w-full flex items-center justify-between py-3 group hover:bg-white/[0.02] transition -mx-5 lg:-mx-6 px-5 lg:px-6 text-left relative">
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container opacity-0 group-hover:opacity-100 transition-opacity"></span>
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

      {/* Coluna direita (rankings rapidos) */}
      <div className="lg:col-span-5 space-y-4 lg:space-y-6">
        {topScorers.length > 0 && (
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <Target size={18} className="text-primary-container" />
              Top 5 Artilheiros
            </h3>
            <div className="space-y-4">
              {topScorers.map((p, i) => (
                <BarItem key={i} name={p.name} value={p.value} max={maxGoals} color="primary-container" />
              ))}
            </div>
          </div>
        )}

        {topAssists.length > 0 && (
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <Handshake size={18} className="text-tertiary-container" />
              Top 5 Assistencias
            </h3>
            <div className="space-y-4">
              {topAssists.map((p, i) => (
                <BarItem key={i} name={p.name} value={p.value} max={maxAssists} color="tertiary-container" />
              ))}
            </div>
          </div>
        )}

        {topScorers.length === 0 && topAssists.length === 0 && (
          <div className="glass-card p-6 text-center">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-on-surface-variant text-sm">Os rankings aparecem quando o primeiro racha for finalizado.</p>
          </div>
        )}
      </div>
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
