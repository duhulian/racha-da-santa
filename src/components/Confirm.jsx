import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, X, UserPlus, Users, Eye, Calendar, UserX } from 'lucide-react'

export default function Confirm() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [match, setMatch] = useState(null)
  const [mensalistas, setMensalistas] = useState([])
  const [confirmations, setConfirmations] = useState([])
  const [avulsoName, setAvulsoName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { loadMatch() }, [token])

  async function loadMatch() {
    try {
      const { data: matches } = await supabase
        .from('matches').select('*').eq('token', token).limit(1)

      if (!matches || matches.length === 0) {
        setError('Link invalido ou racha nao encontrado.')
        setLoading(false)
        return
      }

      const currentMatch = matches[0]
      setMatch(currentMatch)

      const { data: players } = await supabase
        .from('players').select('*').eq('player_type', 'mensalista').eq('active', true).order('name')
      setMensalistas(players || [])

      await loadConfirmations(currentMatch.id)
    } catch (err) {
      setError('Erro ao carregar. Tente novamente.')
    }
    setLoading(false)
  }

  async function loadConfirmations(matchId) {
    const { data } = await supabase
      .from('confirmations')
      .select('*, players(name, nickname, player_type, position)')
      .eq('match_id', matchId || match.id)
      .order('confirmed_at', { ascending: true })
    setConfirmations(data || [])
  }

  async function toggleConfirmation(playerId, currentStatus) {
    setActionLoading(playerId)
    if (currentStatus === 'confirmed') {
      await supabase.from('confirmations').update({ status: 'declined' }).eq('match_id', match.id).eq('player_id', playerId)
    } else if (currentStatus === 'declined') {
      await supabase.from('confirmations').update({ status: 'confirmed' }).eq('match_id', match.id).eq('player_id', playerId)
    } else {
      await supabase.from('confirmations').insert({ match_id: match.id, player_id: playerId, status: 'confirmed' })
    }
    await loadConfirmations(match.id)
    setActionLoading('')
  }

  async function declinePlayer(playerId) {
    setActionLoading(playerId)
    const existing = confirmations.find(c => c.player_id === playerId)
    if (existing) {
      await supabase.from('confirmations').update({ status: 'declined' }).eq('match_id', match.id).eq('player_id', playerId)
    } else {
      await supabase.from('confirmations').insert({ match_id: match.id, player_id: playerId, status: 'declined' })
    }
    await loadConfirmations(match.id)
    setActionLoading('')
  }

  async function addAvulso() {
    if (!avulsoName.trim()) return
    setActionLoading('avulso')
    const trimmedName = avulsoName.trim()

    const { data: existing } = await supabase
      .from('players').select('id').eq('player_type', 'avulso').ilike('name', trimmedName).limit(1)

    let playerId
    if (existing && existing.length > 0) {
      playerId = existing[0].id
    } else {
      const { data: newPlayer } = await supabase
        .from('players').insert({ name: trimmedName, player_type: 'avulso', role: 'player' }).select().single()
      if (!newPlayer) { setActionLoading(''); return }
      playerId = newPlayer.id
    }

    const alreadyConfirmed = confirmations.find(c => c.player_id === playerId)
    if (!alreadyConfirmed) {
      await supabase.from('confirmations').insert({ match_id: match.id, player_id: playerId, status: 'confirmed' })
    }

    setAvulsoName('')
    await loadConfirmations(match.id)
    setActionLoading('')
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando racha...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">😕</div>
        <p className="text-on-surface-variant">{error}</p>
      </div>
    )
  }

  const matchDate = new Date(match.date + 'T12:00:00')
  const formattedDate = matchDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const confirmedList = confirmations.filter(c => c.status === 'confirmed')
  const declinedList = confirmations.filter(c => c.status === 'declined')
  const positionLabels = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }

  const isSortedOrFinished = match.status === 'sorted' || match.status === 'finished'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Cabecalho */}
      <div className="glass-card p-6 text-center relative overflow-hidden">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary-container/10 rounded-full blur-3xl"></div>
        <div className="relative">
          <span className="label-caps text-primary-container flex items-center justify-center gap-2">
            <Calendar size={14} /> Confirmacao de Presenca
          </span>
          <h2 className="text-2xl lg:text-3xl font-extrabold text-white capitalize mt-2 tracking-tight">{formattedDate}</h2>
          {match.notes && <p className="text-on-surface-variant text-sm mt-2">{match.notes}</p>}
        </div>
      </div>

      {/* Botao ver escalacao se sorteado/finalizado */}
      {isSortedOrFinished && (
        <button onClick={() => navigate(`/racha/${match.id}`)} className="btn-primary w-full py-3.5 flex items-center justify-center gap-2">
          <Eye size={18} />
          {match.status === 'finished' ? 'Ver Escalacao e Resultados' : 'Ver Escalacao dos Times'}
        </button>
      )}

      {/* Confirmacao de mensalistas (so se aberto) */}
      {match.status === 'open' && (
        <>
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users size={18} className="text-primary-container" /> Mensalistas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mensalistas.map(p => {
                const conf = confirmations.find(c => c.player_id === p.id)
                const status = conf?.status || 'pending'
                const isLoading = actionLoading === p.id
                const isConfirmed = status === 'confirmed'
                const isDeclined = status === 'declined'

                return (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                    isConfirmed ? 'bg-secondary-container/5 border-secondary-container/20' :
                    isDeclined ? 'bg-error/5 border-error/20' :
                    'bg-white/[0.03] border-white/5'
                  }`}>
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-on-surface-variant shrink-0">
                      {p.shirt_number || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDeclined ? 'text-on-surface-variant line-through' : 'text-white'}`}>
                        {p.nickname || p.name}
                      </p>
                      {p.position && <p className="text-[11px] text-on-surface-variant">{positionLabels[p.position]}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => toggleConfirmation(p.id, isConfirmed ? 'confirmed' : null)} disabled={isLoading}
                        className={`p-2 rounded-lg transition ${
                          isConfirmed ? 'bg-secondary-container text-on-secondary' : 'bg-white/[0.05] text-on-surface-variant hover:text-secondary-container'
                        }`}>
                        <Check size={16} />
                      </button>
                      <button onClick={() => declinePlayer(p.id)} disabled={isLoading}
                        className={`p-2 rounded-lg transition ${
                          isDeclined ? 'bg-error text-on-error' : 'bg-white/[0.05] text-on-surface-variant hover:text-error'
                        }`}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Avulso */}
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <UserPlus size={18} className="text-primary-container" /> Avulsos
            </h3>
            <p className="text-sm text-on-surface-variant mb-3">Convidado? Adicione seu nome para entrar na lista.</p>
            <div className="flex gap-2">
              <input type="text" value={avulsoName} onChange={e => setAvulsoName(e.target.value)}
                placeholder="Digite seu nome"
                className="input-base flex-1"
                onKeyDown={e => e.key === 'Enter' && addAvulso()} />
              <button onClick={addAvulso} disabled={actionLoading === 'avulso' || !avulsoName.trim()}
                className="btn-primary px-5 text-sm">
                {actionLoading === 'avulso' ? '...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirmados + Recusados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Confirmados */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-secondary-fixed flex items-center gap-2">
              <Users size={16} /> Confirmados ({confirmedList.length})
            </h3>
          </div>
          {confirmedList.length === 0 ? (
            <p className="text-on-surface-variant/70 text-sm">Ninguem confirmou ainda.</p>
          ) : (
            <ol className="space-y-2">
              {confirmedList.map((c, i) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="text-on-surface-variant/60 w-5 tabular-nums">{i + 1}.</span>
                  <span className="text-white flex-1 truncate">{c.players?.nickname || c.players?.name}</span>
                  {c.players?.position === 'goleiro' && <span className="chip chip-goleiro">GOL</span>}
                  {c.players?.player_type === 'avulso' && (
                    <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-on-surface-variant uppercase">avulso</span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Recusados */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-error flex items-center gap-2">
              <UserX size={16} /> Nao vou ({declinedList.length})
            </h3>
          </div>
          {declinedList.length === 0 ? (
            <p className="text-on-surface-variant/70 text-sm">Ninguem recusou ainda.</p>
          ) : (
            <ol className="space-y-2">
              {declinedList.map(c => (
                <li key={c.id} className="text-sm text-on-surface-variant truncate">
                  {c.players?.nickname || c.players?.name}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
