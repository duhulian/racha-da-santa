import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Check, X, UserPlus, Users } from 'lucide-react'

export default function Confirm() {
  const { token } = useParams()
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
      <div className="text-center py-12">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-slate-400">Carregando racha...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">😕</div>
        <p className="text-slate-400">{error}</p>
      </div>
    )
  }

  if (match.status === 'finished') {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-white font-bold">Racha finalizado</p>
        <p className="text-slate-400 text-sm mt-1">Esse racha ja aconteceu.</p>
      </div>
    )
  }

  const matchDate = new Date(match.date + 'T12:00:00')
  const formattedDate = matchDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const confirmedList = confirmations.filter(c => c.status === 'confirmed')
  const declinedList = confirmations.filter(c => c.status === 'declined')
  const positionLabels = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }

  return (
    <div className="space-y-4">
      {/* Info do Racha */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-800 border border-gold-400/20 rounded-2xl p-4 text-center">
        <img src="/logo.png" alt="" className="w-14 h-14 rounded-full mx-auto mb-2 border-2 border-gold-400/30" />
        <p className="text-xs text-gold-400 font-semibold uppercase mb-1">Racha Da Santa</p>
        <h2 className="text-lg font-bold text-white capitalize">{formattedDate}</h2>
        {match.notes && <p className="text-slate-400 text-sm mt-1">{match.notes}</p>}
      </div>

      {/* Mensalistas */}
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-3">Mensalistas</h3>
        <div className="space-y-2">
          {mensalistas.map(p => {
            const conf = confirmations.find(c => c.player_id === p.id)
            const status = conf?.status || 'pending'
            const isLoading = actionLoading === p.id

            return (
              <div key={p.id} className="flex items-center gap-2 py-2 border-b border-navy-700/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {p.shirt_number ? `${p.shirt_number}. ` : ''}{p.nickname || p.name}
                  </p>
                  {p.position && <span className="text-xs text-slate-500">{positionLabels[p.position]}</span>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => toggleConfirmation(p.id, status === 'confirmed' ? 'confirmed' : null)}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition text-sm ${
                      status === 'confirmed' ? 'bg-green-600 text-white' : 'bg-navy-700 text-slate-400 hover:bg-green-600/20 hover:text-green-400'
                    }`}>
                    <Check size={16} />
                  </button>
                  <button onClick={() => declinePlayer(p.id)}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition text-sm ${
                      status === 'declined' ? 'bg-red-600 text-white' : 'bg-navy-700 text-slate-400 hover:bg-red-600/20 hover:text-red-400'
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
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
          <UserPlus size={14} /> Jogador avulso
        </h3>
        <div className="flex gap-2">
          <input type="text" value={avulsoName} onChange={(e) => setAvulsoName(e.target.value)}
            placeholder="Digite seu nome"
            className="flex-1 bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && addAvulso()} />
          <button onClick={addAvulso} disabled={actionLoading === 'avulso' || !avulsoName.trim()}
            className="bg-gold-400 hover:bg-gold-500 text-navy-900 px-4 rounded-lg transition disabled:opacity-50 text-sm font-bold">
            {actionLoading === 'avulso' ? '...' : 'Confirmar'}
          </button>
        </div>
      </div>

      {/* Confirmados */}
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Confirmados</h3>
          <span className="bg-green-500/20 text-green-400 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Users size={12} /> {confirmedList.length}
          </span>
        </div>
        {confirmedList.length === 0 ? (
          <p className="text-slate-500 text-sm">Ninguem confirmou ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {confirmedList.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 py-1">
                <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">{i + 1}</div>
                <span className="text-white text-sm">{c.players?.nickname || c.players?.name}</span>
                {c.players?.player_type === 'avulso' && (
                  <span className="text-xs text-slate-500 bg-navy-700 px-1.5 py-0.5 rounded">avulso</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recusados */}
      {declinedList.length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Nao vao</h3>
          <div className="space-y-1.5">
            {declinedList.map(c => (
              <div key={c.id} className="flex items-center gap-2 py-1">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 text-xs"><X size={12} /></div>
                <span className="text-slate-400 text-sm">{c.players?.nickname || c.players?.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
