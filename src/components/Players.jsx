import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Search } from 'lucide-react'

const POSITION_CONFIG = {
  goleiro: { label: 'Goleiro', short: 'GOLEIRO', chip: 'chip-goleiro', border: 'border-l-goleiro' },
  zagueiro: { label: 'Zagueiro', short: 'ZAGUEIRO', chip: 'chip-zagueiro', border: 'border-l-zagueiro' },
  meia: { label: 'Meia', short: 'MEIA', chip: 'chip-meia', border: 'border-l-meia' },
  atacante: { label: 'Atacante', short: 'ATACANTE', chip: 'chip-atacante', border: 'border-l-atacante' },
}

export default function Players() {
  const [players, setPlayers] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('players').select('*').eq('active', true).eq('player_type', 'mensalista')
      .order('position').order('shirt_number').order('name')
      .then(({ data }) => { setPlayers(data || []); setLoading(false) })
  }, [])

  let filtered = filter === 'all' ? players : players.filter(p => p.position === filter)
  if (search.trim()) {
    const q = search.toLowerCase()
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.nickname && p.nickname.toLowerCase().includes(q))
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Cabecalho */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
        <div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Elenco</h2>
          <p className="text-on-surface-variant text-sm mt-1">{players.length} mensalistas ativos</p>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 w-full sm:w-64">
          <Search size={16} className="text-on-surface-variant" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar no elenco..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-on-surface-variant/60" />
        </div>
      </div>

      {/* Filtros de posicao */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterPill>
        {Object.entries(POSITION_CONFIG).map(([key, cfg]) => (
          <FilterPill key={key} active={filter === key} onClick={() => setFilter(key)}>{cfg.label}</FilterPill>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Users size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-on-surface-variant">Nenhum jogador encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(p => {
            const pos = POSITION_CONFIG[p.position] || { label: '', short: '', chip: '', border: '' }
            return (
              <div key={p.id} className={`glass-card p-4 flex items-center gap-3 ${pos.border} rounded-r-xl`}>
                {p.photo_url ? (
                  <img src={p.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-on-surface-variant font-bold shrink-0">
                    {p.shirt_number || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">{p.name}</p>
                  {p.nickname && <p className="text-on-surface-variant text-xs truncate">"{p.nickname}"</p>}
                  {pos.short && (
                    <span className={`chip ${pos.chip} mt-1.5`}>{pos.short}</span>
                  )}
                </div>
                {p.shirt_number && (
                  <div className="text-right shrink-0">
                    <span className="text-xl font-extrabold text-on-surface-variant/80 tabular-nums">
                      {String(p.shirt_number).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition ${
        active
          ? 'bg-primary-container/20 text-primary-container border border-primary-container/40'
          : 'bg-white/[0.04] text-on-surface-variant border border-white/5 hover:text-white'
      }`}>
      {children}
    </button>
  )
}
