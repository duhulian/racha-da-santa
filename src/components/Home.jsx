import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Target, HandHelping, Users, Calendar } from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function Home() {
  const { player } = useAuth()
  const [stats, setStats] = useState(null)
  const [topScorers, setTopScorers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      // Stats do jogador logado
      const { data: myStats } = await supabase
        .from('match_stats')
        .select('goals, assists, present')
        .eq('player_id', player.id)

      const totalGoals = myStats?.reduce((s, m) => s + m.goals, 0) || 0
      const totalAssists = myStats?.reduce((s, m) => s + m.assists, 0) || 0
      const totalPresences = myStats?.filter(m => m.present).length || 0

      // Total de rachas
      const { count: totalMatches } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finished')

      setStats({ totalGoals, totalAssists, totalPresences, totalMatches: totalMatches || 0 })

      // Top 5 artilheiros geral
      const { data: allStats } = await supabase
        .from('match_stats')
        .select('goals, player_id, players(name, nickname)')

      if (allStats) {
        const playerGoals = {}
        allStats.forEach(s => {
          const key = s.player_id
          if (!playerGoals[key]) {
            playerGoals[key] = {
              name: s.players?.nickname || s.players?.name || 'Jogador',
              goals: 0
            }
          }
          playerGoals[key].goals += s.goals
        })
        const sorted = Object.values(playerGoals)
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 5)
        setTopScorers(sorted)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Carregando dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Saudacao */}
      <div>
        <h2 className="text-xl font-bold text-white">
          Fala, {player.nickname || player.name?.split(' ')[0]}! 👋
        </h2>
        <p className="text-slate-400 text-sm mt-1">Seus numeros no Racha Da Santa</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Target} label="Gols" value={stats?.totalGoals || 0} color="text-green-400" />
        <StatCard icon={HandHelping} label="Assistencias" value={stats?.totalAssists || 0} color="text-blue-400" />
        <StatCard icon={Calendar} label="Presencas" value={stats?.totalPresences || 0} color="text-yellow-400" />
        <StatCard icon={Users} label="Rachas jogados" value={stats?.totalMatches || 0} color="text-purple-400" />
      </div>

      {/* Grafico de artilheiros */}
      {topScorers.length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Top 5 Artilheiros</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topScorers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" width={80} tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Bar dataKey="goals" fill="#22c55e" radius={[0, 4, 4, 0]} name="Gols" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grafico de pizza: participacao */}
      {stats && stats.totalMatches > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Sua presenca nos rachas</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={[
                  { name: 'Presente', value: stats.totalPresences },
                  { name: 'Ausente', value: stats.totalMatches - stats.totalPresences }
                ]}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                dataKey="value"
              >
                <Cell fill="#22c55e" />
                <Cell fill="#334155" />
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="text-center text-slate-400 text-sm">
            {stats.totalPresences} de {stats.totalMatches} rachas ({stats.totalMatches > 0 ? Math.round((stats.totalPresences / stats.totalMatches) * 100) : 0}%)
          </p>
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
    <div className="bg-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className={color} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}
