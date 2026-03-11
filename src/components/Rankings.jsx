import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Trophy, Target, HandHelping, Award } from 'lucide-react'

const PERIODS = [
  { key: 'week', label: 'Semanal', days: 7 },
  { key: 'biweek', label: 'Quinzenal', days: 15 },
  { key: 'quarter', label: 'Trimestral', days: 90 },
  { key: 'semester', label: 'Semestral', days: 180 },
  { key: 'year', label: 'Anual', days: 365 },
]

const CATEGORIES = [
  { key: 'goals', label: 'Gols', icon: Target, color: 'text-green-400' },
  { key: 'assists', label: 'Assistencias', icon: HandHelping, color: 'text-blue-400' },
  { key: 'presences', label: 'Presencas', icon: Award, color: 'text-yellow-400' },
]

export default function Rankings() {
  const [period, setPeriod] = useState('quarter')
  const [category, setCategory] = useState('goals')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRankings()
  }, [period, category])

  async function loadRankings() {
    setLoading(true)
    try {
      const selectedPeriod = PERIODS.find(p => p.key === period)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - selectedPeriod.days)
      const startDateStr = startDate.toISOString().split('T')[0]

      // Buscar matches no periodo
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'finished')
        .gte('date', startDateStr)

      if (!matches || matches.length === 0) {
        setRankings([])
        setLoading(false)
        return
      }

      const matchIds = matches.map(m => m.id)

      // Buscar stats
      const { data: stats } = await supabase
        .from('match_stats')
        .select('goals, assists, present, player_id, players(name, nickname)')
        .in('match_id', matchIds)

      if (!stats) {
        setRankings([])
        setLoading(false)
        return
      }

      // Agregar por jogador
      const playerMap = {}
      stats.forEach(s => {
        if (!playerMap[s.player_id]) {
          playerMap[s.player_id] = {
            name: s.players?.nickname || s.players?.name || 'Jogador',
            goals: 0,
            assists: 0,
            presences: 0
          }
        }
        playerMap[s.player_id].goals += s.goals
        playerMap[s.player_id].assists += s.assists
        if (s.present) playerMap[s.player_id].presences += 1
      })

      const sorted = Object.values(playerMap)
        .sort((a, b) => b[category] - a[category])
        .filter(p => p[category] > 0)

      setRankings(sorted)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  const CategoryIcon = CATEGORIES.find(c => c.key === category)?.icon || Trophy
  const categoryColor = CATEGORIES.find(c => c.key === category)?.color || 'text-green-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={20} className="text-yellow-400" />
        <h2 className="text-lg font-bold text-white">Rankings</h2>
      </div>

      {/* Filtro de periodo */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              period === p.key
                ? 'bg-green-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filtro de categoria */}
      <div className="flex gap-2">
        {CATEGORIES.map(c => {
          const Icon = c.icon
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition ${
                category === c.key
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
              {c.label}
            </button>
          )
        })}
      </div>

      {/* Tabela de ranking */}
      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando...</div>
      ) : rankings.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl p-6 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-slate-400 text-sm">Nenhum dado nesse periodo.</p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-2xl overflow-hidden">
          {rankings.map((player, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 border-b border-slate-700 last:border-0 ${
                i < 3 ? 'bg-slate-750' : ''
              }`}
            >
              {/* Posicao */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                i === 1 ? 'bg-slate-400/20 text-slate-300' :
                i === 2 ? 'bg-amber-700/20 text-amber-600' :
                'bg-slate-700 text-slate-400'
              }`}>
                {i + 1}
              </div>

              {/* Nome */}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{player.name}</p>
              </div>

              {/* Valor */}
              <div className={`text-lg font-bold ${categoryColor}`}>
                {player[category]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
