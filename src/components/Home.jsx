import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Target, HandHelping, Users, Calendar, TrendingUp } from 'lucide-react'

export default function Home() {
  const [topScorers, setTopScorers] = useState([])
  const [topAssists, setTopAssists] = useState([])
  const [generalStats, setGeneralStats] = useState({ totalMatches: 0, totalPlayers: 0, totalGoals: 0 })
  const [nextMatch, setNextMatch] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      // Proximo racha aberto
      const { data: openMatches } = await supabase
        .from('matches')
        .select('*, confirmations(count)')
        .in('status', ['open', 'sorted'])
        .order('date', { ascending: true })
        .limit(1)

      if (openMatches && openMatches.length > 0) {
        const m = openMatches[0]
        const { count } = await supabase
          .from('confirmations')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id)
          .eq('status', 'confirmed')
        setNextMatch({ ...m, confirmedCount: count || 0 })
      }

      // Stats gerais
      const { count: totalMatches } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finished')

      const { count: totalPlayers } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      // Todos os stats
      const { data: allStats } = await supabase
        .from('match_stats')
        .select('goals, assists, player_id, players(name, nickname)')

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

      setGeneralStats({
        totalMatches: totalMatches || 0,
        totalPlayers: totalPlayers || 0,
        totalGoals
      })

      setTopScorers(
        Object.values(playerGoals).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5)
      )
      setTopAssists(
        Object.values(playerAssists).sort((a, b) => b.value - a.value).filter(p => p.value > 0).slice(0, 5)
      )
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Carregando dashboard...</div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <p className="text-slate-400 text-sm mt-1">Numeros gerais do Racha Da Santa</p>
      </div>

      {/* Proximo racha */}
      {nextMatch && (
        <div className="bg-gradient-to-r from-green-900/40 to-green-800/20 border border-green-700/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={16} className="text-green-400" />
            <span className="text-xs text-green-400 font-semibold uppercase">Proximo Racha</span>
          </div>
          <p className="text-white font-bold capitalize">
            {new Date(nextMatch.date + 'T12:00:00').toLocaleDateString('pt-BR', {
              weekday: 'long', day: '2-digit', month: 'long'
            })}
          </p>
          <p className="text-green-300 text-sm mt-1">
            {nextMatch.confirmedCount} confirmado{nextMatch.confirmedCount !== 1 ? 's' : ''}
          </p>
          {nextMatch.notes && <p className="text-slate-400 text-xs mt-1">{nextMatch.notes}</p>}
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Calendar} label="Rachas" value={generalStats.totalMatches} color="text-green-400" />
        <StatCard icon={Users} label="Jogadores" value={generalStats.totalPlayers} color="text-blue-400" />
        <StatCard icon={Target} label="Gols total" value={generalStats.totalGoals} color="text-yellow-400" />
      </div>

      {/* Grafico artilheiros */}
      {topScorers.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Target size={14} className="text-green-400" />
            Top Artilheiros
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topScorers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} name="Gols" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grafico assistencias */}
      {topAssists.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <HandHelping size={14} className="text-blue-400" />
            Top Assistencias
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topAssists} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Assist." />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {topScorers.length === 0 && (
        <div className="bg-slate-800 rounded-2xl p-6 text-center">
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
    <div className="bg-slate-800 rounded-xl p-3 text-center">
      <Icon size={18} className={`${color} mx-auto mb-1`} />
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}
