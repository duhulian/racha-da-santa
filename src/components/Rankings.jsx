import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Trophy, Target, Handshake, Award } from 'lucide-react'

const PERIODS = [
  { key: 'week', label: '7 dias', days: 7 },
  { key: 'biweek', label: '15 dias', days: 15 },
  { key: 'quarter', label: '90 dias', days: 90 },
  { key: 'semester', label: '180 dias', days: 180 },
  { key: 'year', label: '365 dias', days: 365 },
]

const CATEGORIES = [
  { key: 'goals', label: 'Gols', icon: Target, abbr: 'GOLS' },
  { key: 'assists', label: 'Assistencias', icon: Handshake, abbr: 'ASSIST' },
  { key: 'presences', label: 'Presencas', icon: Award, abbr: 'PRESENCAS' },
]

const POSITION_LABELS = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }

export default function Rankings() {
  const [period, setPeriod] = useState('quarter')
  const [category, setCategory] = useState('goals')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadRankings() }, [period, category])

  async function loadRankings() {
    setLoading(true)
    try {
      const selectedPeriod = PERIODS.find(p => p.key === period)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - selectedPeriod.days)
      const startDateStr = startDate.toISOString().split('T')[0]

      const { data: matches } = await supabase
        .from('matches').select('id').eq('status', 'finished').gte('date', startDateStr)

      if (!matches || matches.length === 0) { setRankings([]); setLoading(false); return }

      const { data: stats } = await supabase
        .from('match_stats')
        .select('goals, assists, present, player_id, players(name, nickname, position, shirt_number, photo_url)')
        .in('match_id', matches.map(m => m.id))

      if (!stats) { setRankings([]); setLoading(false); return }

      const playerMap = {}
      stats.forEach(s => {
        if (!playerMap[s.player_id]) {
          playerMap[s.player_id] = {
            id: s.player_id,
            name: s.players?.nickname || s.players?.name || 'Jogador',
            position: s.players?.position || '',
            number: s.players?.shirt_number,
            photo: s.players?.photo_url,
            goals: 0, assists: 0, presences: 0
          }
        }
        playerMap[s.player_id].goals += s.goals
        playerMap[s.player_id].assists += s.assists
        if (s.present) playerMap[s.player_id].presences += 1
      })

      setRankings(Object.values(playerMap).sort((a, b) => b[category] - a[category]).filter(p => p[category] > 0))
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const activeCategory = CATEGORIES.find(c => c.key === category)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Rankings</h2>
        <p className="text-on-surface-variant text-sm mt-1">Desempenho individual nos ultimos periodos</p>
      </div>

      {/* Filtros de categoria */}
      <div className="flex flex-wrap gap-2 mb-3">
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCategory(c.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
              category === c.key
                ? 'bg-primary-container/20 text-primary-container border border-primary-container/40'
                : 'bg-white/[0.04] text-on-surface-variant border border-white/5 hover:text-white'
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Filtros de periodo */}
      <div className="flex flex-wrap gap-2 mb-6">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
              period === p.key
                ? 'bg-white/10 text-white border border-white/20'
                : 'bg-transparent text-on-surface-variant border border-white/5 hover:border-white/15'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : rankings.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trophy size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-on-surface-variant">Nenhum dado nesse periodo.</p>
        </div>
      ) : (
        <>
          {/* Podio top 3 */}
          {rankings.length >= 3 && <Podio top3={rankings.slice(0, 3)} abbr={activeCategory.abbr} />}

          {/* Lista dos demais */}
          {rankings.length > 3 && (
            <div className="glass-card overflow-hidden mt-6">
              <div className="px-4 lg:px-6 py-3 border-b border-white/5 bg-white/[0.02] flex items-center gap-3">
                <span className="text-xs font-semibold text-on-surface-variant w-8">#</span>
                <span className="text-xs font-semibold text-on-surface-variant flex-1">Jogador</span>
                <span className="text-xs font-semibold text-on-surface-variant">{activeCategory.abbr}</span>
              </div>
              {rankings.slice(3).map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                  <span className="text-lg font-bold text-on-surface-variant w-8 tabular-nums">{idx + 4}</span>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[11px] font-bold text-on-surface-variant">
                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {POSITION_LABELS[p.position] || ''} {p.number ? `#${p.number}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white tabular-nums">{p[category]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Se tiver menos de 3 mas mais de 0 */}
          {rankings.length < 3 && rankings.length > 0 && (
            <div className="glass-card overflow-hidden">
              {rankings.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-white/5 last:border-0">
                  <span className={`text-xl font-bold w-8 tabular-nums ${
                    idx === 0 ? 'text-primary-container' : idx === 1 ? 'text-white/80' : 'text-amber-700'
                  }`}>{idx + 1}</span>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-xs font-bold text-on-surface-variant">
                        {p.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-white">{p.name}</p>
                      <p className="text-[11px] text-on-surface-variant">{POSITION_LABELS[p.position] || ''}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-white tabular-nums">{p[category]}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Podio({ top3, abbr }) {
  // ordem visual: 2, 1, 3 (com o 1 ao centro e maior)
  const [p1, p2, p3] = top3
  const initials = (name) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="grid grid-cols-3 gap-3 items-end mb-6">
      {/* 2 lugar */}
      <PodioCard place={2} player={p2} abbr={abbr} height="h-32 lg:h-40" />
      {/* 1 lugar (centro, maior) */}
      <PodioCard place={1} player={p1} abbr={abbr} height="h-40 lg:h-52" featured />
      {/* 3 lugar */}
      <PodioCard place={3} player={p3} abbr={abbr} height="h-28 lg:h-36" />
    </div>
  )
}

function PodioCard({ place, player, abbr, height, featured }) {
  const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const badgeColor = place === 1 ? 'bg-primary-container text-on-primary' : place === 2 ? 'bg-white/80 text-background' : 'bg-amber-700 text-white'
  const cardStyle = featured
    ? 'bg-gradient-to-b from-primary-container/20 to-primary-container/5 border-primary-container/40'
    : 'bg-white/[0.04] border-white/10'

  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="relative mb-2">
        <div className={`${featured ? 'w-20 h-20 lg:w-24 lg:h-24' : 'w-14 h-14 lg:w-20 lg:h-20'} rounded-full border-2 ${
          featured ? 'border-primary-container shadow-[0_0_30px_rgba(212,175,55,0.3)]' : 'border-white/20'
        } overflow-hidden bg-white/5`}>
          {player.photo ? (
            <img src={player.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-on-surface-variant">{initials}</div>
          )}
        </div>
        <span className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${badgeColor} text-xs font-bold flex items-center justify-center`}>
          {place}
        </span>
      </div>

      {/* Card numerico */}
      <div className={`w-full ${height} ${cardStyle} border rounded-t-xl rounded-b-md flex flex-col items-center justify-center p-3`}>
        <p className="text-sm font-bold text-white truncate max-w-full px-1">{player.name}</p>
        <p className={`${featured ? 'text-3xl lg:text-4xl' : 'text-2xl lg:text-3xl'} font-extrabold text-white mt-1 tabular-nums`}>
          {player[abbr === 'GOLS' ? 'goals' : abbr === 'ASSIST' ? 'assists' : 'presences']}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">{abbr}</p>
      </div>
    </div>
  )
}
