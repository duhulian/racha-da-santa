import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Zap, Building2, DollarSign, Users, Calendar,
  Shuffle, Plus, ChevronRight, Shield, Send, Check,
  Activity, Trophy
} from 'lucide-react'

// =============================================
// COMMAND CENTER - Dashboard principal do admin
// Agrupa:
// - Quick Entry (adiciona stats rapidas fora de match)
// - Treasury Overview (resumo financeiro)
// - Tactical Draw Engine (sorteio rapido)
// - Proximo racha + Fluxo ao vivo
// =============================================

export default function CommandCenter({ onNavigate }) {
  const [stats, setStats] = useState({ totalPlayers: 0, totalMatches: 0, thisMonth: 0 })
  const [nextMatch, setNextMatch] = useState(null)
  const [treasury, setTreasury] = useState({ collected: 0, pending: 0, pendingCount: 0 })
  const [pitchFee, setPitchFee] = useState(null)
  const [overdueList, setOverdueList] = useState([])
  const [players, setPlayers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [sessionCode] = useState(generateSessionCode())

  useEffect(() => { loadDashboard() }, [])

  function generateSessionCode() {
    const d = new Date()
    const hex = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    return `RDST-${hex}-${String.fromCharCode(65 + d.getDay())}`
  }

  async function loadDashboard() {
    setLoading(true)
    try {
      // Totals
      const { count: totalPlayers } = await supabase.from('players')
        .select('*', { count: 'exact', head: true }).eq('active', true).eq('player_type', 'mensalista')
      const { count: totalMatches } = await supabase.from('matches')
        .select('*', { count: 'exact', head: true }).eq('status', 'finished')

      // Next match
      const { data: openMatches } = await supabase.from('matches')
        .select('*').in('status', ['open', 'sorted']).order('date', { ascending: true }).limit(1)
      if (openMatches?.[0]) {
        const m = openMatches[0]
        const { count } = await supabase.from('confirmations')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', m.id).eq('status', 'confirmed')
        setNextMatch({ ...m, confirmedCount: count || 0 })
      }

      // Players pra quick entry
      const { data: p } = await supabase.from('players').select('*')
        .eq('active', true).order('name')
      setPlayers(p || [])

      // Treasury do mes atual
      const monthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
      const { data: payments } = await supabase.from('payments').select('amount, status, player_id, players(name, nickname, photo_url)')
        .eq('reference_month', monthKey)

      let collected = 0, pending = 0, pendingCount = 0
      const overdue = []
      if (payments) {
        payments.forEach(pay => {
          const amt = parseFloat(pay.amount || 0)
          if (pay.status === 'paid') collected += amt
          else if (pay.status === 'pending' || pay.status === 'overdue') {
            pending += amt
            pendingCount += 1
            if (pay.status === 'overdue') overdue.push(pay)
          }
        })
      }
      setTreasury({ collected, pending, pendingCount })
      setOverdueList(overdue.slice(0, 3))

      // Proxima taxa da quadra
      const { data: fees } = await supabase.from('pitch_fees')
        .select('*').eq('paid', false).order('due_date', { ascending: true }).limit(1)
      if (fees?.[0]) setPitchFee(fees[0])

      // Recent activity (ultimos 3 games finalizados deste mes)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { count: thisMonth } = await supabase.from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'finished')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

      setStats({
        totalPlayers: totalPlayers || 0,
        totalMatches: totalMatches || 0,
        thisMonth: thisMonth || 0,
      })
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <Activity size={40} className="text-primary-container mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando Command Center...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={16} className="text-primary-container" />
            <span className="label-caps text-primary-container">Admin Command</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Command Center</h2>
          <p className="text-on-surface-variant text-sm mt-1">System status optimal. Ready for tactical input.</p>
        </div>
        <div className="text-right">
          <p className="label-caps">Current Session</p>
          <p className="text-primary-container font-black text-lg tabular-nums">{sessionCode}</p>
        </div>
      </div>

      {/* Stats rapidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniKpi icon={Users} label="Elenco" value={stats.totalPlayers} color="primary-container" />
        <MiniKpi icon={Calendar} label="Rachas" value={stats.totalMatches} color="tertiary" />
        <MiniKpi icon={Trophy} label="Mes atual" value={stats.thisMonth} color="secondary-fixed" />
        <MiniKpi icon={DollarSign} label="Pendentes" value={treasury.pendingCount} color="error" />
      </div>

      {/* Next Match + Live CTA */}
      {nextMatch && (
        <NextMatchBanner
          match={nextMatch}
          onOpenLive={() => onNavigate('games', nextMatch.id)}
          onOpenRacha={() => onNavigate('matches')}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Treasury Overview */}
        <div className="lg:col-span-2">
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 size={16} className="text-primary-container" />
                Treasury Overview
              </h3>
              <button onClick={() => onNavigate('treasury')}
                className="text-xs text-primary-container hover:text-primary font-semibold flex items-center gap-1">
                FULL LEDGER <ChevronRight size={12} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <TreasuryBox
                label="Arrecadado"
                value={`R$ ${treasury.collected.toFixed(2).replace('.', ',')}`}
                color="primary-container"
              />
              <TreasuryBox
                label="Pendente"
                value={`R$ ${treasury.pending.toFixed(2).replace('.', ',')}`}
                color={treasury.pendingCount > 0 ? 'error' : 'on-surface'}
                subtitle={`${treasury.pendingCount} pendentes`}
              />
              <TreasuryBox
                label="Proxima Quadra"
                value={pitchFee
                  ? new Date(pitchFee.due_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                  : '—'}
                color="tertiary"
                subtitle={pitchFee ? `R$ ${parseFloat(pitchFee.total_amount).toFixed(2).replace('.', ',')}` : 'Sem taxa'}
                isText
              />
            </div>

            {overdueList.length > 0 && (
              <>
                <p className="label-caps mb-2">Inadimplentes</p>
                <div className="space-y-2">
                  {overdueList.map(p => (
                    <OverdueItem key={p.id} payment={p} onReload={loadDashboard} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Entry */}
        <div>
          <QuickEntryCard players={players} onSaved={loadDashboard} />
        </div>
      </div>

      {/* Tactical Draw Engine */}
      <TacticalDrawEngine players={players} nextMatch={nextMatch} onNavigate={onNavigate} />
    </div>
  )
}

// ============ MINI KPI ============
function MiniKpi({ icon: Icon, label, value, color }) {
  const colorClass = {
    'primary-container': 'text-primary-container',
    'tertiary': 'text-tertiary',
    'secondary-fixed': 'text-secondary-fixed',
    'error': 'text-error',
  }[color] || 'text-white'

  return (
    <div className="glass-card p-3 lg:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="label-caps">{label}</span>
        <Icon size={14} className={colorClass} />
      </div>
      <p className={`text-xl lg:text-2xl font-black tabular-nums ${colorClass}`}>{value}</p>
    </div>
  )
}

// ============ NEXT MATCH BANNER ============
function NextMatchBanner({ match, onOpenLive, onOpenRacha }) {
  const d = new Date(match.date + 'T12:00:00')
  const day = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' })

  return (
    <div className="glass-card p-5 lg:p-6 relative overflow-hidden border border-primary-container/20">
      <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary-container/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-primary-container" />
            <span className="label-caps text-primary-container">Proximo Racha</span>
            <span className={`chip border ${match.status === 'open'
              ? 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30'
              : 'bg-tertiary-container/15 text-tertiary border-tertiary-container/30'}`}>
              {match.status === 'open' ? 'Aberto' : 'Sorteado'}
            </span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-extrabold text-white capitalize">
            {match.name || `${weekday}, ${day}`}
          </h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {match.location || 'Arena Santa'} | {match.match_time?.substring(0, 5) || '20:00'}
            {' | '}<span className="text-white font-semibold">{match.confirmedCount}</span> confirmados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenRacha}
            className="bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-white hover:bg-white/[0.08] px-4 py-2.5 rounded-lg transition text-sm font-semibold flex items-center gap-2">
            Gerenciar
          </button>
          {match.status === 'sorted' && (
            <button onClick={onOpenLive}
              className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2">
              <Zap size={14} /> Live Match Control
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ TREASURY BOX ============
function TreasuryBox({ label, value, color, subtitle, isText = false }) {
  const colorClass = {
    'primary-container': 'text-primary-container',
    'tertiary': 'text-tertiary',
    'error': 'text-error',
    'on-surface': 'text-white',
  }[color] || 'text-white'

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <p className="label-caps mb-1">{label}</p>
      <p className={`font-black tabular-nums ${colorClass} ${isText ? 'text-base' : 'text-lg lg:text-xl'}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-on-surface-variant mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ============ OVERDUE ITEM ============
function OverdueItem({ payment, onReload }) {
  const p = payment.players
  const initials = (p?.nickname || p?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  function notify() {
    const amount = parseFloat(payment.amount).toFixed(2).replace('.', ',')
    const msg = `⚽ *Racha da Santa*%0A%0AOi ${p?.nickname || p?.name}! Sua mensalidade de R$ ${amount} esta em atraso. Quando puder, acerta com a tesouraria. Valeu!`
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  async function markPaid() {
    await supabase.from('payments').update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
      payment_method: 'pix',
    }).eq('id', payment.id)
    onReload()
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 bg-error/5 border border-error/20 rounded-xl">
      <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {p?.photo_url ? (
          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-on-surface-variant">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{p?.nickname || p?.name}</p>
        <p className="text-[10px] text-error">Em atraso</p>
      </div>
      <span className="text-sm font-bold text-error tabular-nums shrink-0">
        R$ {parseFloat(payment.amount).toFixed(2).replace('.', ',')}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={notify} title="Notificar via WhatsApp"
          className="p-1.5 rounded-lg bg-secondary-container/15 text-secondary-fixed hover:bg-secondary-container/25 transition">
          <Send size={12} />
        </button>
        <button onClick={markPaid} title="Marcar como pago"
          className="p-1.5 rounded-lg bg-primary-container/15 text-primary-container hover:bg-primary-container/25 transition">
          <Check size={12} />
        </button>
      </div>
    </div>
  )
}

// ============ QUICK ENTRY ============
function QuickEntryCard({ players, onSaved }) {
  const [playerId, setPlayerId] = useState('')
  const [goals, setGoals] = useState(0)
  const [assists, setAssists] = useState(0)
  const [matches, setMatches] = useState([])
  const [matchId, setMatchId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('matches').select('id, date, status').order('date', { ascending: false }).limit(10)
      .then(({ data }) => setMatches(data || []))
  }, [])

  async function save() {
    if (!playerId || !matchId) return
    setSaving(true)
    // Upsert: se ja tem stat desse player neste match, soma
    const { data: existing } = await supabase.from('match_stats')
      .select('*').eq('match_id', matchId).eq('player_id', playerId).maybeSingle()
    if (existing) {
      await supabase.from('match_stats').update({
        goals: (existing.goals || 0) + parseInt(goals),
        assists: (existing.assists || 0) + parseInt(assists),
      }).eq('id', existing.id)
    } else {
      await supabase.from('match_stats').insert({
        match_id: matchId,
        player_id: playerId,
        goals: parseInt(goals),
        assists: parseInt(assists),
        present: true,
      })
    }
    setGoals(0); setAssists(0); setPlayerId('')
    setSaving(false)
    onSaved()
  }

  return (
    <div className="glass-card p-5 h-full">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <Zap size={16} className="text-secondary-fixed" /> Quick Entry
      </h3>
      <p className="text-xs text-on-surface-variant mb-4">
        Adicione gols ou assistencias rapido pra um racha especifico.
      </p>

      <div className="space-y-3">
        <div>
          <label className="label-caps mb-1.5 block">Racha</label>
          <select value={matchId} onChange={e => setMatchId(e.target.value)} className="select-base !py-2 text-sm">
            <option value="">Selecione</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {m.status}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-caps mb-1.5 block">Jogador</label>
          <select value={playerId} onChange={e => setPlayerId(e.target.value)} className="select-base !py-2 text-sm">
            <option value="">Selecione</option>
            {players.map(p => (
              <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label-caps mb-1.5 block">Gols</label>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setGoals(g => Math.max(0, g - 1))}
                className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
              <span className="text-white font-extrabold text-lg flex-1 text-center tabular-nums">{goals}</span>
              <button onClick={() => setGoals(g => g + 1)}
                className="bg-primary-container text-on-primary w-9 h-9 rounded-lg text-lg font-bold hover:bg-primary">+</button>
            </div>
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Assists</label>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setAssists(a => Math.max(0, a - 1))}
                className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
              <span className="text-white font-extrabold text-lg flex-1 text-center tabular-nums">{assists}</span>
              <button onClick={() => setAssists(a => a + 1)}
                className="bg-tertiary-container text-on-surface w-9 h-9 rounded-lg text-lg font-bold hover:bg-tertiary">+</button>
            </div>
          </div>
        </div>

        <button onClick={save} disabled={saving || !playerId || !matchId}
          className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2">
          <Check size={14} /> {saving ? 'Salvando...' : 'Commit Stats'}
        </button>
      </div>
    </div>
  )
}

// ============ TACTICAL DRAW ENGINE ============
function TacticalDrawEngine({ players, nextMatch, onNavigate }) {
  const attackers = players.filter(p => p.position === 'atacante' && p.active && p.player_type === 'mensalista')
    .sort((a, b) => (b.overall || 70) - (a.overall || 70))
  const defenders = players.filter(p => p.position === 'zagueiro' && p.active && p.player_type === 'mensalista')
    .sort((a, b) => (b.overall || 70) - (a.overall || 70))
  const midfielders = players.filter(p => p.position === 'meia' && p.active && p.player_type === 'mensalista')
    .sort((a, b) => (b.overall || 70) - (a.overall || 70))
  const goalkeepers = players.filter(p => p.position === 'goleiro' && p.active && p.player_type === 'mensalista')
    .sort((a, b) => (b.overall || 70) - (a.overall || 70))

  const total = players.filter(p => p.active && p.player_type === 'mensalista').length

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Shuffle size={16} className="text-tertiary" /> Tactical Draw Engine
        </h3>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          <span>Elenco disponivel: <span className="text-white font-bold">{total}</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <PositionColumn label="Atacantes" color="error" players={attackers} />
        <PositionColumn label="Meias" color="secondary-fixed" players={midfielders} />
        <PositionColumn label="Zagueiros" color="tertiary" players={defenders} />
        <PositionColumn label="Goleiros" color="primary-container" players={goalkeepers} />
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-on-surface-variant">
          Sorteio balanceado por overall e posicao acontece diretamente na aba "Rachas" apos confirmacoes.
        </p>
        <button onClick={() => onNavigate('matches')} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Shuffle size={14} /> Ir pra sorteio
        </button>
      </div>
    </div>
  )
}

function PositionColumn({ label, color, players }) {
  const colorClass = {
    'primary-container': 'text-primary-container',
    'tertiary': 'text-tertiary',
    'secondary-fixed': 'text-secondary-fixed',
    'error': 'text-error',
  }[color] || 'text-white'

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`label-caps ${colorClass}`}>{label}</span>
        <span className="text-[10px] text-on-surface-variant tabular-nums">({players.length})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {players.slice(0, 12).map(p => (
          <span key={p.id}
            className={`text-[11px] px-2 py-0.5 rounded border border-white/10 bg-white/[0.02] text-white font-semibold`}>
            {(p.nickname || p.name).split(' ')[0]} <span className={`${colorClass} font-bold`}>{p.overall || 70}</span>
          </span>
        ))}
        {players.length > 12 && (
          <span className="text-[11px] text-on-surface-variant px-2 py-0.5">+{players.length - 12}</span>
        )}
        {players.length === 0 && (
          <span className="text-[11px] text-on-surface-variant italic">Nenhum cadastrado</span>
        )}
      </div>
    </div>
  )
}
