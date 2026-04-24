import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Calendar, ChevronRight, Trophy, Target, Users } from 'lucide-react'

export default function MatchList() {
  const navigate = useNavigate()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMatches() }, [])

  async function loadMatches() {
    try {
      const { data: m } = await supabase
        .from('matches').select('*').order('date', { ascending: false }).limit(100)

      if (!m) { setLoading(false); return }

      const enriched = []
      for (const match of m) {
        const { data: winner } = await supabase
          .from('teams').select('name').eq('match_id', match.id).eq('won', true).limit(1)

        const { data: stats } = await supabase
          .from('match_stats').select('goals, assists, present').eq('match_id', match.id)

        const { data: topScorer } = await supabase
          .from('match_stats').select('goals, players(nickname, name)')
          .eq('match_id', match.id).order('goals', { ascending: false }).limit(1)

        const totals = stats?.reduce((acc, s) => ({
          goals: acc.goals + s.goals,
          players: acc.players + (s.present ? 1 : 0)
        }), { goals: 0, players: 0 }) || { goals: 0, players: 0 }

        enriched.push({
          ...match,
          winnerName: winner?.[0]?.name || null,
          totalGoals: totals.goals,
          playersCount: totals.players,
          topScorer: topScorer?.[0]?.goals > 0 ? {
            name: topScorer[0].players?.nickname || topScorer[0].players?.name,
            goals: topScorer[0].goals
          } : null
        })
      }
      setMatches(enriched)
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  // Agrupa por mes/ano
  const grouped = matches.reduce((acc, m) => {
    const d = new Date(m.date + 'T12:00:00')
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    if (!acc[key]) acc[key] = { label, items: [] }
    acc[key].items.push(m)
    return acc
  }, {})

  const statusLabel = { open: 'Aberto', sorted: 'Sorteado', finished: 'Finalizado' }
  const statusStyle = {
    open: 'bg-secondary-container/15 text-secondary-fixed border border-secondary-container/30',
    sorted: 'bg-tertiary-container/15 text-tertiary border border-tertiary-container/30',
    finished: 'bg-white/5 text-on-surface-variant border border-white/10',
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Rachas</h2>
        <p className="text-on-surface-variant text-sm mt-1">Historico de partidas</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
      ) : matches.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Calendar size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-on-surface-variant">Nenhum racha cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, group]) => (
            <div key={key}>
              <h3 className="label-caps text-primary-container mb-3 capitalize">{group.label}</h3>
              <div className="glass-card overflow-hidden">
                {group.items.map((m, idx) => {
                  const d = new Date(m.date + 'T12:00:00')
                  const day = d.toLocaleDateString('pt-BR', { day: '2-digit' })
                  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
                  return (
                    <button key={m.id} onClick={() => navigate(`/racha/${m.id}`)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition border-b border-white/5 last:border-0 text-left">
                      <div className="shrink-0 w-12 text-center">
                        <p className="text-2xl font-extrabold text-white leading-none tabular-nums">{day}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">{weekday}</p>
                      </div>

                      <div className="h-10 w-px bg-white/5"></div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`chip ${statusStyle[m.status]}`}>{statusLabel[m.status]}</span>
                          {m.winnerName && (
                            <span className="inline-flex items-center gap-1 text-xs text-primary-container font-semibold">
                              <Trophy size={12} /> {m.winnerName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                          {m.totalGoals > 0 && (
                            <span className="inline-flex items-center gap-1"><Target size={11} /> {m.totalGoals} gols</span>
                          )}
                          {m.playersCount > 0 && (
                            <span className="inline-flex items-center gap-1"><Users size={11} /> {m.playersCount} jog.</span>
                          )}
                          {m.topScorer && (
                            <span className="hidden sm:inline truncate">Artilheiro: {m.topScorer.name} ({m.topScorer.goals})</span>
                          )}
                        </div>
                      </div>

                      <ChevronRight size={18} className="text-on-surface-variant/50 shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
