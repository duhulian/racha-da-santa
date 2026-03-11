import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Target, HandHelping, Users, Calendar, ChevronRight, Trophy } from 'lucide-react'

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

      // Rachas recentes finalizados (ultimos 5)
      const { data: recent } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished')
        .order('date', { ascending: false })
        .limit(5)

      // Para cada racha, buscar time vencedor e top scorer
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
      <div className="text-center py-12">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400">Carregando dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <img src="/logo.png" alt="" className="w-20 h-20 rounded-full mx-auto mb-2 border-2 border-gold-400/30" />
        <h2 className="text-xl font-bold text-white">Racha Da Santa</h2>
        <p className="text-slate-400 text-sm mt-1">Dashboard geral</p>
      </div>

      {/* Proximo racha */}
      {nextMatch && (
        <div className="bg-gradient-to-r from-navy-700 to-navy-800 border border-gold-400/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-gold-400" />
            <span className="text-xs text-gold-400 font-semibold uppercase">Proximo Racha</span>
          </div>
          <p className="text-white font-bold capitalize">
            {new Date(nextMatch.date + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long'
            })}
          </p>
          <p className="text-gold-300 text-sm mt-1">
            {nextMatch.confirmedCount} confirmado{nextMatch.confirmedCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Calendar} label="Rachas" value={generalStats.totalMatches} color="text-gold-400" />
        <StatCard icon={Users} label="Jogadores" value={generalStats.totalPlayers} color="text-blue-400" />
        <StatCard icon={Target} label="Gols total" value={generalStats.totalGoals} color="text-green-400" />
      </div>

      {/* Rachas recentes */}
      {recentMatches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
            <Calendar size={14} /> Rachas Recentes
          </h3>
          <div className="space-y-2">
            {recentMatches.map(m => {
              const d = new Date(m.date + 'T12:00:00')
              return (
                <button key={m.id} onClick={() => navigate(`/racha/${m.id}`)}
                  className="w-full bg-navy-800 rounded-xl p-3 border border-navy-700 flex items-center gap-3 hover:border-gold-400/30 transition text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium capitalize">
                      {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {m.winnerName && (
                        <span className="text-xs text-gold-400 flex items-center gap-1">
                          🏆 {m.winnerName}
                        </span>
                      )}
                      {m.topScorer && (
                        <span className="text-xs text-slate-400">
                          ⚽ {m.topScorer.name} ({m.topScorer.goals})
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500" />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Grafico artilheiros */}
      {topScorers.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-4 flex items-center gap-2">
            <Target size={14} /> Top Artilheiros
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topScorers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#152546" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111d38', border: '1px solid #1a2f5a', borderRadius: '8px', color: '#e2e8f0' }} />
              <Bar dataKey="value" fill="#c9a84c" radius={[0, 4, 4, 0]} name="Gols" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grafico assistencias */}
      {topAssists.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-blue-400 mb-4 flex items-center gap-2">
            <HandHelping size={14} /> Top Assistencias
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topAssists} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#152546" />
              <XAxis type="number" stroke="#64748b" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#111d38', border: '1px solid #1a2f5a', borderRadius: '8px', color: '#e2e8f0' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Assist." />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {topScorers.length === 0 && recentMatches.length === 0 && (
        <div className="bg-navy-800 rounded-2xl p-6 text-center border border-navy-700">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-slate-400">Nenhum racha registrado ainda.</p>
          <p className="text-slate-500 text-sm mt-1">Os graficos aparecem quando o admin registrar os primeiros dados.</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-navy-800 rounded-xl p-3 text-center border border-navy-700">
      <Icon size={18} className={`${color} mx-auto mb-1`} />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
