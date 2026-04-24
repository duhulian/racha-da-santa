import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Users, Search } from 'lucide-react'

const POSITION_CONFIG = {
  goleiro: { label: 'Goleiro', short: 'GOLEIRO', chip: 'chip-goleiro', border: 'border-l-goleiro' },
  zagueiro: { label: 'Zagueiro', short: 'ZAGUEIRO', chip: 'chip-zagueiro', border: 'border-l-zagueiro' },
  meia: { label: 'Meia', short: 'MEIA', chip: 'chip-meia', border: 'border-l-meia' },
  atacante: { label: 'Atacante', short: 'ATACANTE', chip: 'chip-atacante', border: 'border-l-atacante' },
}

export default function Players() {
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('overall')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('players').select('*').eq('active', true).eq('player_type', 'mensalista')
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

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'overall') return (b.overall || 70) - (a.overall || 70)
    if (sortBy === 'number') return (a.shirt_number || 99) - (b.shirt_number || 99)
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="max-w-5xl mx-auto">
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

      <div className="flex flex-wrap gap-2 mb-3">
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>Todos</FilterPill>
        {Object.entries(POSITION_CONFIG).map(([key, cfg]) => (
          <FilterPill key={key} active={filter === key} onClick={() => setFilter(key)}>{cfg.label}</FilterPill>
        ))}
      </div>

      <div className="flex gap-2 mb-6 items-center">
        <span className="text-xs text-on-surface-variant">Ordenar por:</span>
        <button onClick={() => setSortBy('overall')}
          className={`text-xs px-3 py-1 rounded-full transition ${sortBy === 'overall' ? 'bg-white/10 text-white' : 'text-on-surface-variant hover:text-white'}`}>
          Overall
        </button>
        <button onClick={() => setSortBy('number')}
          className={`text-xs px-3 py-1 rounded-full transition ${sortBy === 'number' ? 'bg-white/10 text-white' : 'text-on-surface-variant hover:text-white'}`}>
          Numero
        </button>
        <button onClick={() => setSortBy('name')}
          className={`text-xs px-3 py-1 rounded-full transition ${sortBy === 'name' ? 'bg-white/10 text-white' : 'text-on-surface-variant hover:text-white'}`}>
          Nome
        </button>
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
            const overall = p.overall || 70
            const overallColor = overall >= 85 ? 'text-primary-container' : overall >= 75 ? 'text-tertiary-container' : overall >= 65 ? 'text-secondary-fixed' : 'text-on-surface'

            return (
              <button key={p.id} onClick={() => navigate(`/jogador/${p.id}`)}
                className={`glass-card glass-card-hover text-left p-4 flex items-center gap-3 ${pos.border} rounded-r-xl`}>
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
                <div className="text-right shrink-0">
                  <p className={`text-2xl font-black ${overallColor} tabular-nums leading-none`}>{overall}</p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant mt-0.5">OVR</p>
                </div>
              </button>
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
