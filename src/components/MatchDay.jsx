import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { Check, X, Users, Clock } from 'lucide-react'

export default function MatchDay() {
  const { player } = useAuth()
  const [match, setMatch] = useState(null)
  const [confirmations, setConfirmations] = useState([])
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadMatchDay()
  }, [])

  async function loadMatchDay() {
    try {
      // Buscar o racha mais recente que esteja aberto ou sorteado
      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['open', 'sorted'])
        .order('date', { ascending: false })
        .limit(1)

      if (matches && matches.length > 0) {
        const currentMatch = matches[0]
        setMatch(currentMatch)

        // Buscar confirmacoes
        const { data: confs } = await supabase
          .from('confirmations')
          .select('*, players(name, nickname)')
          .eq('match_id', currentMatch.id)
          .order('confirmed_at', { ascending: true })

        setConfirmations(confs || [])
        setIsConfirmed(confs?.some(c => c.player_id === player.id) || false)

        // Buscar times se ja foram sorteados
        if (currentMatch.status === 'sorted') {
          const { data: teamsData } = await supabase
            .from('teams')
            .select('*, team_players(*, players(name, nickname))')
            .eq('match_id', currentMatch.id)

          setTeams(teamsData || [])
        }
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  async function toggleConfirmation() {
    if (!match) return

    if (isConfirmed) {
      await supabase
        .from('confirmations')
        .delete()
        .eq('match_id', match.id)
        .eq('player_id', player.id)
    } else {
      await supabase
        .from('confirmations')
        .insert({ match_id: match.id, player_id: player.id })
    }

    setIsConfirmed(!isConfirmed)
    loadMatchDay()
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Carregando...</div>
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">📅</div>
        <h3 className="text-lg font-semibold text-white mb-2">Nenhum racha aberto</h3>
        <p className="text-slate-400 text-sm">Aguarde o admin criar o proximo racha.</p>
      </div>
    )
  }

  const matchDate = new Date(match.date + 'T12:00:00')
  const formattedDate = matchDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })

  return (
    <div className="space-y-4">
      {/* Info do Racha */}
      <div className="bg-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={16} className="text-green-400" />
          <span className="text-xs text-green-400 font-semibold uppercase">
            {match.status === 'open' ? 'Aberto para confirmacao' : 'Times sorteados'}
          </span>
        </div>
        <h2 className="text-lg font-bold text-white capitalize">{formattedDate}</h2>
        {match.notes && <p className="text-slate-400 text-sm mt-1">{match.notes}</p>}
      </div>

      {/* Botao de confirmacao */}
      {match.status === 'open' && (
        <button
          onClick={toggleConfirmation}
          className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition ${
            isConfirmed
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isConfirmed ? (
            <>
              <X size={20} />
              Cancelar presenca
            </>
          ) : (
            <>
              <Check size={20} />
              Confirmar presenca
            </>
          )}
        </button>
      )}

      {/* Lista de confirmados */}
      <div className="bg-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Confirmados</h3>
          <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
            <Users size={12} />
            {confirmations.length}
          </span>
        </div>

        {confirmations.length === 0 ? (
          <p className="text-slate-500 text-sm">Ninguem confirmou ainda.</p>
        ) : (
          <div className="space-y-2">
            {confirmations.map((conf, i) => (
              <div key={conf.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    {conf.players?.nickname || conf.players?.name}
                    {conf.player_id === player.id && (
                      <span className="text-green-400 text-xs ml-2">(voce)</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Times sorteados */}
      {teams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Times Sorteados</h3>
          {teams.map((team, idx) => (
            <div key={team.id} className="bg-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white">{team.name}</h4>
                {team.won && (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs font-semibold px-2 py-1 rounded-full">
                    Vencedor
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {team.team_players?.map(tp => (
                  <p key={tp.id} className="text-slate-300 text-sm">
                    {tp.players?.nickname || tp.players?.name}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
