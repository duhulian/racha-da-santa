import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Plus, Shuffle, Link as LinkIcon, Check, Trash2,
  Calendar, MapPin, FileText, Play, Eye,
  MessageCircle, Target, Activity
} from 'lucide-react'

// =============================================
// MATCH OPERATIONS
// Esquerda: "Deploy Match" (criar novo racha)
// Direita: "Active Log" (lista dos rachas com acoes)
// =============================================

const TEAM_SIZE = 6

export default function MatchOperations({ onStartLive }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [copiedToken, setCopiedToken] = useState('')

  // Deploy Match form
  const [date, setDate] = useState('')
  const [time, setTime] = useState('20:00')
  const [location, setLocation] = useState('Arena Santa')
  const [name, setName] = useState('')
  const [tacticalNotes, setTacticalNotes] = useState('')
  const [teamMatrix, setTeamMatrix] = useState(2)
  const [creating, setCreating] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('matches').select('*')
      .order('date', { ascending: false }).limit(50)

    // Enrich com count de confirmacoes e teams
    const enriched = []
    for (const m of (data || [])) {
      const [{ count: confirmedCount }, { count: teamsCount }] = await Promise.all([
        supabase.from('confirmations').select('*', { count: 'exact', head: true })
          .eq('match_id', m.id).eq('status', 'confirmed'),
        supabase.from('teams').select('*', { count: 'exact', head: true })
          .eq('match_id', m.id).neq('name', 'Lista de Espera'),
      ])
      enriched.push({
        ...m,
        confirmedCount: confirmedCount || 0,
        teamsCount: teamsCount || 0,
      })
    }
    setMatches(enriched)
    setLoading(false)
  }

  async function createMatch() {
    if (!date) return
    setCreating(true)
    const { data: me } = await supabase.from('players').select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    const { error } = await supabase.from('matches').insert({
      date,
      match_time: time,
      location: location || null,
      name: name || null,
      tactical_notes: tacticalNotes || null,
      created_by: me?.id,
      status: 'open',
    })
    if (error) { alert('Erro: ' + error.message); setCreating(false); return }
    // Reset form
    setDate(''); setTime('20:00'); setName(''); setTacticalNotes('')
    setCreating(false)
    load()
  }

  function getConfirmLink(token) {
    return `${window.location.origin}/confirmar/${token}`
  }

  function copyLink(token) {
    navigator.clipboard.writeText(getConfirmLink(token))
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(''), 2000)
  }

  function shareWhatsApp(match) {
    const link = getConfirmLink(match.token)
    const d = new Date(match.date + 'T12:00:00')
    const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const time = (match.match_time || '20:00').substring(0, 5)
    const location = match.location || 'Arena Santa'
    const msg = `⚽ *RACHA DA SANTA*%0A%0A📅 ${dateStr}%0A⏰ ${time}%0A📍 ${location}${match.tactical_notes ? '%0A%0A📝 ' + encodeURIComponent(match.tactical_notes) : ''}%0A%0AConfirme sua presenca:%0A${encodeURIComponent(link)}`
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  async function sortTeams(matchId, numTeams) {
    const { data: confs } = await supabase.from('confirmations')
      .select('player_id').eq('match_id', matchId).eq('status', 'confirmed')
    if (!confs || confs.length < numTeams * 2) {
      alert(`Precisa de pelo menos ${numTeams * 2} confirmados.`)
      return
    }

    const { data: playersFull } = await supabase.from('players')
      .select('id, name, position, overall').in('id', confs.map(c => c.player_id))
    if (!playersFull) return

    // 1. Separa goleiros
    const goleiros = playersFull.filter(p => p.position === 'goleiro')
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))
    const outros = playersFull.filter(p => p.position !== 'goleiro')
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))

    // 2. Distribui 1 goleiro por time
    const teams = Array.from({ length: numTeams }, () => [])
    for (let i = 0; i < numTeams; i++) {
      if (goleiros[i]) teams[i].push(goleiros[i].id)
    }
    const allOthers = [...outros, ...goleiros.slice(numTeams)]
      .sort((a, b) => (b.overall || 70) - (a.overall || 70))

    function teamOverall(teamIds) {
      return teamIds.reduce((s, id) => s + (playersFull.find(p => p.id === id)?.overall || 70), 0)
    }

    // 3. Snake draft
    for (const player of allOthers) {
      const available = teams
        .map((t, idx) => ({ idx, size: t.length, overall: teamOverall(t) }))
        .filter(t => t.size < TEAM_SIZE)
      if (available.length === 0) break
      available.sort((a, b) => a.size - b.size || a.overall - b.overall)
      teams[available[0].idx].push(player.id)
    }

    const allocated = new Set(teams.flat())
    const waitlist = playersFull.filter(p => !allocated.has(p.id)).map(p => p.id)

    // Apaga times antigos
    const { data: oldTeams } = await supabase.from('teams').select('id').eq('match_id', matchId)
    if (oldTeams) {
      for (const t of oldTeams) await supabase.from('team_players').delete().eq('team_id', t.id)
      await supabase.from('teams').delete().eq('match_id', matchId)
    }

    const names = ['Alpha', 'Bravo', 'Charlie', 'Delta']
    for (let t = 0; t < numTeams; t++) {
      if (teams[t].length === 0) continue
      const { data: team } = await supabase.from('teams').insert({
        match_id: matchId,
        name: `Team ${names[t]}`,
      }).select().single()
      await supabase.from('team_players').insert(
        teams[t].map(pid => ({ team_id: team.id, player_id: pid }))
      )
    }

    if (waitlist.length > 0) {
      const { data: w } = await supabase.from('teams').insert({
        match_id: matchId,
        name: 'Lista de Espera',
      }).select().single()
      await supabase.from('team_players').insert(
        waitlist.map(pid => ({ team_id: w.id, player_id: pid }))
      )
    }

    await supabase.from('matches').update({ status: 'sorted' }).eq('id', matchId)
    load()
  }

  async function deleteMatch(matchId) {
    if (!confirm('Excluir este racha e todos os dados associados?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    load()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Target size={16} className="text-primary-container" />
          <span className="label-caps text-primary-container">Logistica</span>
        </div>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Match Operations</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Configure logistica, gerencie entradas e execute o algoritmo de times.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Deploy Match */}
        <div className="lg:col-span-4">
          <div className="glass-card p-5 lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary-container/20 flex items-center justify-center">
                <Plus size={14} className="text-primary-container" />
              </div>
              <h3 className="text-lg font-bold text-white">Deploy Match</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label-caps mb-1.5 block">Nome do racha (opcional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="input-base" placeholder="Final de ano, Racha de gala..." />
              </div>

              <div>
                <label className="label-caps mb-1.5 block">Data & horario</label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
                  <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input-base w-28" />
                </div>
              </div>

              <div>
                <label className="label-caps mb-1.5 block">Local</label>
                <input type="text" value={location} onChange={e => setLocation(e.target.value)}
                  className="input-base" placeholder="Arena Santa" />
              </div>

              <div>
                <label className="label-caps mb-1.5 block">Team Matrix (times padrao)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map(n => (
                    <button key={n} onClick={() => setTeamMatrix(n)}
                      className={`py-2 rounded-lg text-sm font-bold transition ${
                        teamMatrix === n
                          ? 'bg-primary-container/20 border border-primary-container/50 text-primary-container'
                          : 'bg-white/[0.03] border border-white/10 text-on-surface-variant hover:text-white'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1.5">
                  Voce pode mudar na hora do sorteio.
                </p>
              </div>

              <div>
                <label className="label-caps mb-1.5 block">Tactical Notes</label>
                <textarea value={tacticalNotes} onChange={e => setTacticalNotes(e.target.value)}
                  rows={3} className="input-base resize-none"
                  placeholder="Trazer camisa clara e escura, chuteira society..." />
              </div>

              <button onClick={createMatch} disabled={creating || !date}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                <Play size={14} /> {creating ? 'Criando...' : 'Initialize Event'}
              </button>
            </div>
          </div>
        </div>

        {/* Active Log */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Active Log</h3>
            <span className="text-xs text-on-surface-variant">{matches.length} rachas cadastrados</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
          ) : matches.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Calendar size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-on-surface-variant">Nenhum racha cadastrado. Inicie o primeiro ao lado.</p>
            </div>
          ) : (
            matches.map(m => (
              <MatchLogItem
                key={m.id}
                match={m}
                teamMatrix={teamMatrix}
                copiedToken={copiedToken}
                onCopyLink={() => copyLink(m.token)}
                onShare={() => shareWhatsApp(m)}
                onSort={(n) => sortTeams(m.id, n)}
                onDelete={() => deleteMatch(m.id)}
                onStartLive={() => onStartLive(m.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ============ MATCH LOG ITEM ============
function MatchLogItem({ match, teamMatrix, copiedToken, onCopyLink, onShare, onSort, onDelete, onStartLive }) {
  const [numTeams, setNumTeams] = useState(teamMatrix)

  useEffect(() => { setNumTeams(teamMatrix) }, [teamMatrix])

  const d = new Date(match.date + 'T12:00:00')
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
  const dayMonth = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()

  const statusConfig = {
    open: {
      label: 'OPEN ENTRY',
      chip: 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30',
      stripe: 'bg-secondary-container',
    },
    sorted: {
      label: 'SORTED',
      chip: 'bg-primary-container/15 text-primary-container border-primary-container/30',
      stripe: 'bg-primary-container',
    },
    finished: {
      label: 'FINISHED',
      chip: 'bg-white/5 text-on-surface-variant border-white/10',
      stripe: 'bg-white/10',
    },
  }
  const sc = statusConfig[match.status] || statusConfig.open

  return (
    <div className="glass-card overflow-hidden relative">
      {/* Stripe colorido */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${sc.stripe}`}></div>

      <div className="flex items-start gap-4 p-4 pl-5">
        {/* Status chip */}
        <div className="shrink-0">
          <span className={`chip border ${sc.chip}`}>{sc.label}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-white">
            {match.name || `${weekday}, ${dayMonth}`}
            <span className="text-on-surface-variant font-normal">
              {' | '}{(match.match_time || '20:00').substring(0, 5)}
            </span>
          </h4>
          <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-0.5 flex-wrap">
            <span className="flex items-center gap-1"><MapPin size={11} /> {match.location || 'Arena Santa'}</span>
          </div>
          {match.tactical_notes && (
            <p className="text-xs text-on-surface-variant/80 mt-1.5 flex items-start gap-1 italic">
              <FileText size={11} className="shrink-0 mt-0.5" /> {match.tactical_notes}
            </p>
          )}
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <p className="text-xl font-black text-white tabular-nums leading-none">{match.confirmedCount}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">PLAYERS</p>
          </div>
          {match.teamsCount > 0 && (
            <div className="text-center">
              <p className="text-xl font-black text-primary-container tabular-nums leading-none">{match.teamsCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">TEAMS</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 px-4 pb-4 pl-5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {match.status !== 'finished' && (
            <>
              <button onClick={onCopyLink} title="Copiar link"
                className={`p-2 rounded-lg border transition ${
                  copiedToken === match.token
                    ? 'bg-secondary-container/20 border-secondary-container/50 text-secondary-fixed'
                    : 'bg-white/[0.04] border-white/10 text-on-surface-variant hover:text-white hover:bg-white/[0.08]'
                }`}>
                {copiedToken === match.token ? <Check size={13} /> : <LinkIcon size={13} />}
              </button>
              <button onClick={onShare} title="Compartilhar WhatsApp"
                className="p-2 rounded-lg bg-secondary-container/15 border border-secondary-container/30 text-secondary-fixed hover:bg-secondary-container/25 transition">
                <MessageCircle size={13} />
              </button>
            </>
          )}
          {match.status === 'finished' && (
            <a href={`/racha/${match.id}`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/[0.08] transition font-semibold">
              <Eye size={12} /> Results Log
            </a>
          )}
          {match.status === 'sorted' && (
            <a href={`/racha/${match.id}`}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/[0.08] transition font-semibold">
              <Eye size={12} /> View Matrix
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {match.status === 'open' && (
            <div className="flex items-center gap-1.5">
              <select value={numTeams} onChange={e => setNumTeams(parseInt(e.target.value))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none">
                <option value={2}>2 Teams</option>
                <option value={3}>3 Teams</option>
                <option value={4}>4 Teams</option>
              </select>
              <button onClick={() => onSort(numTeams)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-container/15 border border-primary-container/40 text-primary-container hover:bg-primary-container/25 rounded-lg transition font-bold">
                <Shuffle size={12} /> Draw Teams
              </button>
            </div>
          )}
          {match.status === 'sorted' && (
            <button onClick={onStartLive}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary-container/15 border border-primary-container/40 text-primary-container hover:bg-primary-container/25 rounded-lg transition font-bold">
              <Activity size={12} /> Live Match Control
            </button>
          )}
          {match.status !== 'finished' && (
            <button onClick={onDelete} title="Excluir"
              className="p-2 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
