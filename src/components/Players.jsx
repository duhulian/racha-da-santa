import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Shield, Swords, Crosshair, Goal } from 'lucide-react'

const POSITION_CONFIG = {
  goleiro: { label: 'Goleiro', short: 'GOL', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  zagueiro: { label: 'Zagueiro', short: 'ZAG', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  meia: { label: 'Meia', short: 'MEI', color: 'text-green-400', bg: 'bg-green-500/10' },
  atacante: { label: 'Atacante', short: 'ATA', color: 'text-red-400', bg: 'bg-red-500/10' },
}

export default function Players() {
  const [players, setPlayers] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('active', true)
      .eq('player_type', 'mensalista')
      .order('position')
      .order('shirt_number')
      .order('name')

    setPlayers(data || [])
    setLoading(false)
  }

  const filtered = filter === 'all' ? players : players.filter(p => p.position === filter)

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Carregando...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users size={20} className="text-green-400" />
        <h2 className="text-lg font-bold text-white">Elenco</h2>
        <span className="text-xs text-slate-500 ml-auto">{players.length} mensalistas</span>
      </div>

      {/* Filtro por posicao */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
            filter === 'all' ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
          }`}
        >
          Todos
        </button>
        {Object.entries(POSITION_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === key ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl p-6 text-center">
          <p className="text-slate-400 text-sm">Nenhum jogador cadastrado nessa posicao.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const pos = POSITION_CONFIG[p.position] || { label: '', short: '', color: 'text-slate-400', bg: 'bg-slate-700' }
            return (
              <div key={p.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${pos.bg} flex items-center justify-center ${pos.color} font-bold text-sm`}>
                  {p.shirt_number || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  {p.nickname && <p className="text-slate-500 text-xs truncate">"{p.nickname}"</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg ${pos.bg} ${pos.color} font-semibold`}>
                  {pos.short}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
