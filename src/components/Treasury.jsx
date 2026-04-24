import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  DollarSign, TrendingUp, Wallet, AlertCircle, CheckCircle2, Clock,
  Plus, X, Send, Trash2, Building2, Receipt, Check
} from 'lucide-react'

// =============================================
// TREASURY - MENSALIDADES E FINANCEIRO
// - Lista pagamentos por mes de referencia
// - Gera mensalidades em massa pra um mes
// - Registra pagamento individual
// - Notifica inadimplente via WhatsApp
// - Gestao de taxa da quadra (pitch_fees)
// =============================================

export default function Treasury() {
  const [view, setView] = useState('overview')  // overview | ledger | fees
  const [players, setPlayers] = useState([])
  const [payments, setPayments] = useState([])
  const [pitchFees, setPitchFees] = useState([])
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthKey())
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  function getCurrentMonthKey() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  async function loadAll() {
    setLoading(true)
    const { data: p } = await supabase.from('players').select('*')
      .eq('active', true).order('name')
    setPlayers(p || [])

    const { data: pay } = await supabase.from('payments')
      .select('*, players(name, nickname, photo_url, monthly_fee)')
      .order('due_date', { ascending: false })
    setPayments(pay || [])

    const { data: fees } = await supabase.from('pitch_fees')
      .select('*').order('due_date', { ascending: false })
    setPitchFees(fees || [])

    setLoading(false)
  }

  // Calcula overview do mes atual
  function getMonthStats() {
    const month = payments.filter(p => p.reference_month === currentMonth)
    const total = month.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const paid = month.filter(p => p.status === 'paid')
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const pending = month.filter(p => p.status === 'pending' || p.status === 'overdue')
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const overdue = month.filter(p => p.status === 'overdue')
    const pendingList = month.filter(p => p.status === 'pending' || p.status === 'overdue')
      .sort((a, b) => (a.status === 'overdue' ? -1 : 1))
    return { total, paid, pending, overdue, pendingList, monthItems: month }
  }

  // Gera/sincroniza mensalidades pro mes atual
  async function generateMonthlyPayments() {
    if (!confirm(`Gerar cobrancas de mensalidade para ${formatMonthLabel(currentMonth)}? Jogadores que ja tem nao serao duplicados.`)) return

    const mensalistas = players.filter(p => p.player_type === 'mensalista')
    if (mensalistas.length === 0) { alert('Nenhum mensalista ativo.'); return }

    const [year, month] = currentMonth.split('-').map(Number)
    const dueDate = new Date(year, month - 1, 5)  // dia 5 do mes
    const dueDateStr = dueDate.toISOString().split('T')[0]

    // Busca pagamentos ja existentes desse mes
    const { data: existing } = await supabase.from('payments')
      .select('player_id').eq('reference_month', currentMonth)
    const existingIds = new Set((existing || []).map(e => e.player_id))

    const toInsert = mensalistas
      .filter(p => !existingIds.has(p.id))
      .map(p => ({
        player_id: p.id,
        amount: p.monthly_fee || 50.00,
        reference_month: currentMonth,
        due_date: dueDateStr,
        status: 'pending',
      }))

    if (toInsert.length === 0) {
      alert('Todos os mensalistas ja tem cobranca para este mes.')
      return
    }

    const { error } = await supabase.from('payments').insert(toInsert)
    if (error) { alert('Erro: ' + error.message); return }

    // Marca overdue os que ja venceram
    const today = new Date().toISOString().split('T')[0]
    if (dueDateStr < today) {
      await supabase.from('payments').update({ status: 'overdue' })
        .eq('reference_month', currentMonth).eq('status', 'pending').lt('due_date', today)
    }

    alert(`${toInsert.length} cobrancas geradas para ${formatMonthLabel(currentMonth)}.`)
    loadAll()
  }

  async function markAsPaid(paymentId, method = 'pix') {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('payments').update({
      status: 'paid',
      paid_date: today,
      payment_method: method,
    }).eq('id', paymentId)
    loadAll()
  }

  async function markAsUnpaid(paymentId, due) {
    const today = new Date().toISOString().split('T')[0]
    const newStatus = due < today ? 'overdue' : 'pending'
    await supabase.from('payments').update({
      status: newStatus,
      paid_date: null,
      payment_method: null,
    }).eq('id', paymentId)
    loadAll()
  }

  async function deletePayment(paymentId) {
    if (!confirm('Excluir esta cobranca?')) return
    await supabase.from('payments').delete().eq('id', paymentId)
    loadAll()
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-on-surface-variant">
        <DollarSign size={40} className="text-primary-container/40 mx-auto mb-3 animate-pulse" />
        Carregando tesouraria...
      </div>
    )
  }

  const stats = getMonthStats()
  const nextFee = pitchFees.find(f => !f.paid) || pitchFees[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-primary-container" />
            <span className="label-caps text-primary-container">Financeiro</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Treasury Overview</h2>
          <p className="text-on-surface-variant text-sm mt-1">Gestao de mensalidades e caixa do racha</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector value={currentMonth} onChange={setCurrentMonth} />
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="glass-card p-1.5 inline-flex gap-1 overflow-x-auto w-full lg:w-auto">
        <SubTab active={view === 'overview'} onClick={() => setView('overview')} icon={TrendingUp} label="Visao geral" />
        <SubTab active={view === 'ledger'} onClick={() => setView('ledger')} icon={Receipt} label="Pagamentos" />
        <SubTab active={view === 'fees'} onClick={() => setView('fees')} icon={Building2} label="Quadra" />
      </div>

      {view === 'overview' && (
        <OverviewPane
          stats={stats}
          currentMonth={currentMonth}
          nextFee={nextFee}
          onGenerate={generateMonthlyPayments}
          onMarkPaid={markAsPaid}
        />
      )}

      {view === 'ledger' && (
        <LedgerPane
          payments={payments}
          currentMonth={currentMonth}
          players={players}
          onMarkPaid={markAsPaid}
          onMarkUnpaid={markAsUnpaid}
          onDelete={deletePayment}
          onReload={loadAll}
          onGenerate={generateMonthlyPayments}
        />
      )}

      {view === 'fees' && (
        <FeesPane pitchFees={pitchFees} onReload={loadAll} />
      )}
    </div>
  )
}

function SubTab({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
        active
          ? 'bg-primary-container text-on-primary'
          : 'text-on-surface-variant hover:text-white hover:bg-white/5'
      }`}>
      <Icon size={14} />
      {label}
    </button>
  )
}

function MonthSelector({ value, onChange }) {
  // Gera 12 meses (6 antes, 6 depois do atual)
  const months = []
  const now = new Date()
  for (let offset = 6; offset >= -5; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(key)
  }

  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="select-base !py-2 !pr-8 text-sm w-48">
      {months.map(m => (
        <option key={m} value={m}>{formatMonthLabel(m)}</option>
      ))}
    </select>
  )
}

function formatMonthLabel(key) {
  const [year, month] = key.split('-')
  const names = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
                 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${names[parseInt(month) - 1]}/${year}`
}

// ============ OVERVIEW PANE ============
function OverviewPane({ stats, currentMonth, nextFee, onGenerate, onMarkPaid }) {
  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label="Total do Mes"
          value={`R$ ${stats.total.toFixed(2).replace('.', ',')}`}
          icon={DollarSign}
          color="primary-container"
          subtitle={`${stats.monthItems.length} cobrancas`}
        />
        <KpiCard
          label="Arrecadado"
          value={`R$ ${stats.paid.toFixed(2).replace('.', ',')}`}
          icon={CheckCircle2}
          color="secondary-fixed"
          subtitle={stats.total > 0 ? `${((stats.paid / stats.total) * 100).toFixed(0)}% do total` : 'Sem cobrancas'}
        />
        <KpiCard
          label="Pendente"
          value={`R$ ${stats.pending.toFixed(2).replace('.', ',')}`}
          icon={AlertCircle}
          color={stats.overdue.length > 0 ? 'error' : 'on-surface'}
          subtitle={`${stats.overdue.length} em atraso`}
        />
      </div>

      {/* Gerar cobrancas se mes nao tem nenhuma */}
      {stats.monthItems.length === 0 && (
        <div className="glass-card p-6 text-center border border-primary-container/20">
          <DollarSign size={40} className="text-primary-container mx-auto mb-3" />
          <h4 className="text-lg font-bold text-white mb-1">Nenhuma cobranca em {formatMonthLabel(currentMonth)}</h4>
          <p className="text-sm text-on-surface-variant mb-4">
            Gere as mensalidades deste mes em 1 clique. Os valores seguem o cadastro de cada jogador.
          </p>
          <button onClick={onGenerate} className="btn-primary px-6 py-2.5 flex items-center gap-2 mx-auto">
            <Plus size={14} /> Gerar cobrancas de {formatMonthLabel(currentMonth)}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Outstanding Dues (pendentes) */}
        <div className="lg:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-error" />
              Pendentes
            </h3>
            <span className="chip bg-error/15 text-error border border-error/30">
              {stats.pendingList.length}
            </span>
          </div>
          {stats.pendingList.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={32} className="text-secondary-fixed/40 mx-auto mb-2" />
              <p className="text-sm text-on-surface-variant">Todas as mensalidades estao em dia!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.pendingList.map(p => (
                <PendingRow key={p.id} payment={p} onMarkPaid={onMarkPaid} />
              ))}
            </div>
          )}
        </div>

        {/* Next Pitch Fee */}
        <div>
          <div className="glass-card p-5 border border-tertiary-container/20">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={16} className="text-tertiary" />
              <h4 className="text-sm font-bold text-white">Proxima taxa da quadra</h4>
            </div>
            {nextFee ? (
              <>
                <p className="text-3xl font-black text-white tabular-nums leading-none mt-2">
                  R$ {parseFloat(nextFee.total_amount).toFixed(2).replace('.', ',')}
                </p>
                <p className="text-xs text-on-surface-variant mt-2">
                  Vence em {new Date(nextFee.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </p>
                {nextFee.description && (
                  <p className="text-xs text-on-surface-variant mt-1 truncate">{nextFee.description}</p>
                )}
                {nextFee.per_player_amount && (
                  <p className="text-xs text-tertiary mt-3 pt-3 border-t border-white/5">
                    R$ {parseFloat(nextFee.per_player_amount).toFixed(2).replace('.', ',')} por jogador
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-on-surface-variant mt-2">
                Nenhuma taxa cadastrada. Adicione na aba "Quadra".
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon: Icon, color, subtitle }) {
  return (
    <div className="glass-card p-5 relative overflow-hidden">
      <Icon size={18} className={`text-${color}/40 absolute top-3 right-3`} />
      <span className="label-caps">{label}</span>
      <p className={`text-3xl font-extrabold mt-2 tabular-nums ${
        color === 'primary-container' ? 'text-primary-container' :
        color === 'secondary-fixed' ? 'text-secondary-fixed' :
        color === 'error' ? 'text-error' : 'text-white'
      }`}>{value}</p>
      {subtitle && <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>}
    </div>
  )
}

function PendingRow({ payment, onMarkPaid }) {
  const overdue = payment.status === 'overdue'
  const due = new Date(payment.due_date + 'T12:00:00')
  const today = new Date()
  const diffDays = Math.floor((today - due) / (1000 * 60 * 60 * 24))
  const p = payment.players

  const initials = (p?.nickname || p?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  function notifyWhatsApp() {
    const amount = parseFloat(payment.amount).toFixed(2).replace('.', ',')
    const msg = `⚽ *Racha da Santa*%0A%0AOi ${p?.nickname || p?.name}! Tudo bem?%0A%0ASua mensalidade de R$ ${amount} (${formatMonthLabel(payment.reference_month)}) ${overdue ? 'esta em atraso' : 'vence em breve'}.%0A%0APix da tesouraria ou combine via DM. Valeu!`
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      overdue
        ? 'bg-error/5 border-error/20'
        : 'bg-white/[0.03] border-white/5'
    }`}>
      <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {p?.photo_url ? (
          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-on-surface-variant">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{p?.nickname || p?.name || 'Jogador'}</p>
        <p className={`text-xs ${overdue ? 'text-error' : 'text-on-surface-variant'}`}>
          {overdue
            ? `Vencido ha ${diffDays} dia${diffDays !== 1 ? 's' : ''}`
            : `Vence ${due.toLocaleDateString('pt-BR')}`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white tabular-nums">
          R$ {parseFloat(payment.amount).toFixed(2).replace('.', ',')}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={notifyWhatsApp} title="Notificar via WhatsApp"
          className="p-2 rounded-lg bg-secondary-container/15 text-secondary-fixed hover:bg-secondary-container/25 transition">
          <Send size={14} />
        </button>
        <button onClick={() => onMarkPaid(payment.id)} title="Marcar como pago"
          className="p-2 rounded-lg bg-primary-container/15 text-primary-container hover:bg-primary-container/25 transition">
          <Check size={14} />
        </button>
      </div>
    </div>
  )
}

// ============ LEDGER PANE ============
function LedgerPane({ payments, currentMonth, players, onMarkPaid, onMarkUnpaid, onDelete, onReload, onGenerate }) {
  const [showAdd, setShowAdd] = useState(false)
  const monthPayments = payments.filter(p => p.reference_month === currentMonth)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold text-white">
          Cobrancas de {formatMonthLabel(currentMonth)} ({monthPayments.length})
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-ghost-gold px-3 py-1.5 text-sm flex items-center gap-1.5">
            <Plus size={14} /> Adicionar cobranca
          </button>
          <button onClick={onGenerate} className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5">
            <Plus size={14} /> Gerar do mes
          </button>
        </div>
      </div>

      {showAdd && (
        <AddPaymentForm
          players={players}
          currentMonth={currentMonth}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onReload() }}
        />
      )}

      {monthPayments.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Receipt size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
          <p className="text-on-surface-variant">Nenhuma cobranca cadastrada para {formatMonthLabel(currentMonth)}.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {monthPayments.map(p => (
            <LedgerRow key={p.id} payment={p} onMarkPaid={onMarkPaid} onMarkUnpaid={onMarkUnpaid} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function LedgerRow({ payment, onMarkPaid, onMarkUnpaid, onDelete }) {
  const p = payment.players
  const statusConfig = {
    paid: { label: 'Pago', chip: 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30' },
    pending: { label: 'Pendente', chip: 'bg-white/[0.05] text-on-surface-variant border-white/10' },
    overdue: { label: 'Atrasado', chip: 'bg-error/15 text-error border-error/30' },
    waived: { label: 'Dispensado', chip: 'bg-tertiary-container/15 text-tertiary border-tertiary-container/30' },
  }
  const sc = statusConfig[payment.status] || statusConfig.pending
  const initials = (p?.nickname || p?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex items-center gap-3 p-4 border-b border-white/5 last:border-0">
      <div className="w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
        {p?.photo_url ? (
          <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-bold text-on-surface-variant">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{p?.nickname || p?.name || 'Jogador'}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`chip border ${sc.chip}`}>{sc.label}</span>
          {payment.paid_date && (
            <span className="text-[10px] text-on-surface-variant">
              Pago em {new Date(payment.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')}
              {payment.payment_method && ` via ${payment.payment_method}`}
            </span>
          )}
        </div>
      </div>
      <span className="text-base font-bold text-white tabular-nums shrink-0">
        R$ {parseFloat(payment.amount).toFixed(2).replace('.', ',')}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        {payment.status === 'paid' ? (
          <button onClick={() => onMarkUnpaid(payment.id, payment.due_date)} title="Desfazer"
            className="p-2 rounded-lg bg-white/[0.05] text-on-surface-variant hover:bg-white/[0.08] transition">
            <X size={14} />
          </button>
        ) : (
          <button onClick={() => onMarkPaid(payment.id)} title="Marcar como pago"
            className="p-2 rounded-lg bg-primary-container/15 text-primary-container hover:bg-primary-container/25 transition">
            <Check size={14} />
          </button>
        )}
        <button onClick={() => onDelete(payment.id)} title="Excluir"
          className="p-2 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function AddPaymentForm({ players, currentMonth, onClose, onSaved }) {
  const [playerId, setPlayerId] = useState('')
  const [amount, setAmount] = useState('50.00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (playerId) {
      const p = players.find(pl => pl.id === playerId)
      if (p?.monthly_fee) setAmount(String(p.monthly_fee))
    }
  }, [playerId, players])

  async function save() {
    if (!playerId || !amount) return
    setSaving(true)
    const [year, month] = currentMonth.split('-').map(Number)
    const dueDate = new Date(year, month - 1, 5).toISOString().split('T')[0]
    const { error } = await supabase.from('payments').insert({
      player_id: playerId,
      amount: parseFloat(amount),
      reference_month: currentMonth,
      due_date: dueDate,
      status: 'pending',
    })
    if (error) alert('Erro: ' + error.message)
    setSaving(false)
    if (!error) onSaved()
  }

  const mensalistas = players.filter(p => p.player_type === 'mensalista')

  return (
    <div className="glass-card p-5 border border-primary-container/30">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-white">Nova cobranca - {formatMonthLabel(currentMonth)}</h4>
        <button onClick={onClose} className="text-on-surface-variant hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label-caps mb-1.5 block">Jogador</label>
          <select value={playerId} onChange={e => setPlayerId(e.target.value)} className="select-base !py-2.5 text-sm">
            <option value="">Selecione</option>
            {mensalistas.map(p => (
              <option key={p.id} value={p.id}>{p.nickname || p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Valor (R$)</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="input-base" />
        </div>
      </div>
      <button onClick={save} disabled={saving || !playerId}
        className="btn-primary w-full py-2.5 text-sm">
        {saving ? 'Salvando...' : 'Cadastrar cobranca'}
      </button>
    </div>
  )
}

// ============ FEES PANE ============
function FeesPane({ pitchFees, onReload }) {
  const [showAdd, setShowAdd] = useState(false)

  async function markPaid(id) {
    await supabase.from('pitch_fees').update({
      paid: true,
      paid_date: new Date().toISOString().split('T')[0]
    }).eq('id', id)
    onReload()
  }

  async function deleteFee(id) {
    if (!confirm('Excluir esta taxa?')) return
    await supabase.from('pitch_fees').delete().eq('id', id)
    onReload()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Taxas da quadra ({pitchFees.length})</h3>
        <button onClick={() => setShowAdd(true)} className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Plus size={14} /> Nova taxa
        </button>
      </div>

      {showAdd && <AddFeeForm onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); onReload() }} />}

      {pitchFees.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Building2 size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
          <p className="text-on-surface-variant">Nenhuma taxa cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pitchFees.map(f => (
            <div key={f.id} className={`glass-card p-4 flex items-center gap-3 ${
              !f.paid && new Date(f.due_date) < new Date() ? 'border-error/30' : ''
            }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`chip border ${f.paid
                    ? 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30'
                    : 'bg-white/[0.05] text-on-surface-variant border-white/10'}`}>
                    {f.paid ? 'Pago' : 'A pagar'}
                  </span>
                  {f.description && (
                    <span className="text-sm font-semibold text-white truncate">{f.description}</span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant">
                  Vence em {new Date(f.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  {f.per_player_amount && ` | R$ ${parseFloat(f.per_player_amount).toFixed(2).replace('.', ',')}/jogador`}
                </p>
              </div>
              <span className="text-base font-bold text-white tabular-nums shrink-0">
                R$ {parseFloat(f.total_amount).toFixed(2).replace('.', ',')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {!f.paid && (
                  <button onClick={() => markPaid(f.id)} title="Marcar como pago"
                    className="p-2 rounded-lg bg-primary-container/15 text-primary-container hover:bg-primary-container/25 transition">
                    <Check size={14} />
                  </button>
                )}
                <button onClick={() => deleteFee(f.id)} title="Excluir"
                  className="p-2 rounded-lg text-on-surface-variant/60 hover:text-error hover:bg-error/10 transition">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddFeeForm({ onClose, onSaved }) {
  const [dueDate, setDueDate] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [perPlayer, setPerPlayer] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!dueDate || !totalAmount) return
    setSaving(true)
    const { error } = await supabase.from('pitch_fees').insert({
      due_date: dueDate,
      total_amount: parseFloat(totalAmount),
      per_player_amount: perPlayer ? parseFloat(perPlayer) : null,
      description: description || null,
    })
    if (error) alert('Erro: ' + error.message)
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="glass-card p-5 border border-tertiary-container/20">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-white">Nova taxa da quadra</h4>
        <button onClick={onClose} className="text-on-surface-variant hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label-caps mb-1.5 block">Data de vencimento</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input-base" />
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Valor total (R$)</label>
          <input type="number" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} className="input-base" placeholder="800.00" />
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Por jogador (opcional)</label>
          <input type="number" step="0.01" value={perPlayer} onChange={e => setPerPlayer(e.target.value)} className="input-base" placeholder="50.00" />
        </div>
        <div>
          <label className="label-caps mb-1.5 block">Descricao</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input-base" placeholder="Aluguel novembro" />
        </div>
      </div>
      <button onClick={save} disabled={saving || !dueDate || !totalAmount}
        className="btn-primary w-full py-2.5 text-sm">
        {saving ? 'Salvando...' : 'Cadastrar taxa'}
      </button>
    </div>
  )
}
