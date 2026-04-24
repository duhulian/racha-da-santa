import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  UserPlus, Users, Search, Camera, X, Pencil, ArrowRight,
  Star, Crown, Link as LinkIcon
} from 'lucide-react'

// =============================================
// ROSTER COMMAND - Gestao de Elenco
// - Cadastro rapido de jogador
// - Grid de mensalistas com design "card"
// - Guest Pool (convidados / role='guest')
// - Upload de foto com resize browser-side
// =============================================

const POSITION_CONFIG = {
  goleiro: { short: 'GK', label: 'Goleiro', color: 'primary-container', dot: '#d4af37', chipClass: 'chip-goleiro' },
  zagueiro: { short: 'DEF', label: 'Zagueiro', color: 'tertiary', dot: '#72dcff', chipClass: 'chip-zagueiro' },
  meia: { short: 'MID', label: 'Meia', color: 'secondary-fixed', dot: '#79ff5b', chipClass: 'chip-meia' },
  atacante: { short: 'FW', label: 'Atacante', color: 'error', dot: '#ffb4ab', chipClass: 'chip-atacante' },
}

const NATIONALITIES = [
  { code: 'BR', flag: '🇧🇷', label: 'Brasil' },
  { code: 'PT', flag: '🇵🇹', label: 'Portugal' },
  { code: 'AR', flag: '🇦🇷', label: 'Argentina' },
  { code: 'UY', flag: '🇺🇾', label: 'Uruguai' },
  { code: 'CO', flag: '🇨🇴', label: 'Colombia' },
  { code: 'ES', flag: '🇪🇸', label: 'Espanha' },
  { code: 'IT', flag: '🇮🇹', label: 'Italia' },
  { code: 'FR', flag: '🇫🇷', label: 'Franca' },
  { code: 'DE', flag: '🇩🇪', label: 'Alemanha' },
  { code: 'NL', flag: '🇳🇱', label: 'Holanda' },
  { code: 'EN', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', label: 'Inglaterra' },
  { code: 'US', flag: '🇺🇸', label: 'EUA' },
  { code: 'MX', flag: '🇲🇽', label: 'Mexico' },
  { code: 'JP', flag: '🇯🇵', label: 'Japao' },
]

export default function RosterCommand() {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [uploadingId, setUploadingId] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('players').select('*').eq('active', true).order('name')
    setPlayers(data || [])
    setLoading(false)
  }

  async function promoteToMensalista(pid) {
    await supabase.from('players').update({ player_type: 'mensalista', role: 'player' }).eq('id', pid)
    load()
  }

  async function demoteToGuest(pid) {
    if (!confirm('Rebaixar para pool de convidados? Ele continua ativo mas nao tem cobranca de mensalidade automatica.')) return
    await supabase.from('players').update({ player_type: 'avulso', role: 'guest' }).eq('id', pid)
    load()
  }

  async function deactivate(pid) {
    if (!confirm('Desativar este jogador? Ele some do elenco mas historico e preservado.')) return
    await supabase.from('players').update({ active: false }).eq('id', pid)
    load()
  }

  async function handlePhotoUpload(playerId, file) {
    if (!file) return
    setUploadingId(playerId)
    try {
      const resizedBlob = await resizeImage(file, 400, 0.8)
      const timestamp = Date.now()
      const fileName = `${playerId}_${timestamp}.jpg`

      const { data: existing } = await supabase.storage.from('avatars').list('', { limit: 1000 })
      if (existing) {
        const toDelete = existing
          .filter(f => f.name.startsWith(`${playerId}.`) || f.name.startsWith(`${playerId}_`))
          .map(f => f.name)
        if (toDelete.length > 0) await supabase.storage.from('avatars').remove(toDelete)
      }

      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, resizedBlob, {
        upsert: true, contentType: 'image/jpeg', cacheControl: '3600',
      })
      if (uploadError) {
        alert('Erro ao subir foto: ' + uploadError.message)
        setUploadingId(''); return
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const photoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}`
      await supabase.from('players').update({ photo_url: photoUrl }).eq('id', playerId)
    } catch (err) {
      alert('Erro ao processar foto: ' + err.message)
    }
    setUploadingId('')
    load()
  }

  const mensalistas = players.filter(p => p.player_type === 'mensalista')
  const guests = players.filter(p => p.player_type === 'avulso' || p.role === 'guest')

  // Filtro e busca aplicados no grid de mensalistas
  let gridPlayers = filter === 'all'
    ? mensalistas
    : mensalistas.filter(p => p.position === filter)

  if (search.trim()) {
    const q = search.toLowerCase()
    gridPlayers = gridPlayers.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.nickname?.toLowerCase().includes(q)
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={16} className="text-primary-container" />
            <span className="label-caps text-primary-container">Elenco</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Roster Command</h2>
          <p className="text-on-surface-variant text-sm mt-1">Gerencie mensalistas e convidados do racha</p>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 w-full sm:w-64">
          <Search size={14} className="text-on-surface-variant" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar no elenco..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-on-surface-variant/60" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recruit Player Form */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 lg:self-start">
          <PlayerForm
            editing={editing}
            onSaved={() => { load(); setEditing(null); setShowForm(false) }}
            onCancel={() => { setEditing(null); setShowForm(false) }}
            show={showForm || !!editing}
            onOpen={() => setShowForm(true)}
          />

          {/* Guest Pool */}
          <div className="mt-5">
            <GuestPool
              guests={guests}
              onPromote={promoteToMensalista}
              onDeactivate={deactivate}
            />
          </div>
        </div>

        {/* Grid de Mensalistas */}
        <div className="lg:col-span-8">
          {/* Filtros posicao */}
          <div className="flex flex-wrap gap-2 mb-4">
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              Todos ({mensalistas.length})
            </FilterPill>
            {Object.entries(POSITION_CONFIG).map(([key, cfg]) => {
              const count = mensalistas.filter(p => p.position === key).length
              return (
                <FilterPill key={key} active={filter === key} onClick={() => setFilter(key)}>
                  {cfg.label} ({count})
                </FilterPill>
              )
            })}
          </div>

          {loading ? (
            <div className="text-center py-12 text-on-surface-variant">Carregando...</div>
          ) : gridPlayers.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Users size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-on-surface-variant">Nenhum mensalista encontrado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gridPlayers.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  onEdit={() => setEditing(p)}
                  onUpload={handlePhotoUpload}
                  uploadingId={uploadingId}
                  onDemote={demoteToGuest}
                  onDeactivate={deactivate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ PLAYER CARD ============
function PlayerCard({ player, onEdit, onUpload, uploadingId, onDemote, onDeactivate }) {
  const pos = POSITION_CONFIG[player.position] || { short: '—', label: '—', dot: '#888', chipClass: '' }
  const overall = player.overall || 70
  const overallColor = overall >= 85 ? 'text-primary-container'
    : overall >= 75 ? 'text-tertiary'
    : overall >= 65 ? 'text-secondary-fixed' : 'text-on-surface'
  const isUploading = uploadingId === player.id
  const isAdmin = player.role === 'admin'

  return (
    <div className="glass-card p-4 flex items-center gap-3 relative">
      {/* Foto com borda colorida por posicao */}
      <div className="relative shrink-0">
        <label className="relative cursor-pointer block">
          <div
            className="w-16 h-16 rounded-full overflow-hidden border-[3px] flex items-center justify-center"
            style={{ borderColor: pos.dot }}
          >
            {player.photo_url ? (
              <img src={player.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/[0.05] text-lg font-black text-on-surface-variant">
                {(player.nickname || player.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-surface-container border border-white/10 rounded-full p-1.5 hover:bg-primary-container/20 transition">
            {isUploading ? (
              <div className="w-3 h-3 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera size={11} className="text-on-surface-variant" />
            )}
          </div>
          <input type="file" accept="image/*" className="hidden"
            onChange={e => {
              if (e.target.files?.[0]) onUpload(player.id, e.target.files[0])
              e.target.value = ''
            }} />
        </label>
        {isAdmin && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary-container flex items-center justify-center">
            <Crown size={10} className="text-on-primary" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {player.nickname && (
            <p className="text-sm font-black text-white truncate">"{player.nickname}"</p>
          )}
        </div>
        <p className="text-xs text-on-surface-variant truncate">{player.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className={`chip ${pos.chipClass}`}>{pos.short}</span>
          <span className="chip bg-white/[0.05] text-on-surface-variant border border-white/10">
            REGULAR
          </span>
        </div>
      </div>

      {/* Numero e Overall */}
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        <p className="text-3xl font-black text-white/20 tabular-nums leading-none">
          {player.shirt_number || '?'}
        </p>
        <div className="flex items-center gap-1">
          <p className={`text-base font-black tabular-nums ${overallColor}`}>{overall}</p>
          <span className="text-[9px] font-bold text-on-surface-variant">OVR</span>
        </div>
      </div>

      {/* Acoes (hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        <button onClick={onEdit}
          className="p-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-on-surface-variant hover:text-white hover:bg-white/[0.08] transition">
          <Pencil size={10} />
        </button>
      </div>
    </div>
  )
}

// ============ PLAYER FORM ============
function PlayerForm({ editing, onSaved, onCancel, show, onOpen }) {
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState('')
  const [shirtNumber, setShirtNumber] = useState('')
  const [nationality, setNationality] = useState('BR')
  const [overall, setOverall] = useState(70)
  const [pace, setPace] = useState(70)
  const [shooting, setShooting] = useState(70)
  const [passing, setPassing] = useState(70)
  const [dribbling, setDribbling] = useState(70)
  const [defending, setDefending] = useState(70)
  const [physical, setPhysical] = useState(70)
  const [monthlyFee, setMonthlyFee] = useState('50')
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (editing) {
      setName(editing.name || '')
      setNickname(editing.nickname || '')
      setPosition(editing.position || '')
      setShirtNumber(editing.shirt_number ? String(editing.shirt_number) : '')
      setNationality(editing.nationality || 'BR')
      setOverall(editing.overall || 70)
      setPace(editing.pace || 70)
      setShooting(editing.shooting || 70)
      setPassing(editing.passing || 70)
      setDribbling(editing.dribbling || 70)
      setDefending(editing.defending || 70)
      setPhysical(editing.physical || 70)
      setMonthlyFee(String(editing.monthly_fee || 50))
    } else {
      resetForm()
    }
  }, [editing])

  function resetForm() {
    setName(''); setNickname(''); setPosition(''); setShirtNumber('')
    setNationality('BR'); setOverall(70); setPace(70); setShooting(70)
    setPassing(70); setDribbling(70); setDefending(70); setPhysical(70)
    setMonthlyFee('50'); setShowAdvanced(false)
  }

  async function save() {
    if (!name.trim() || !position) return
    setSaving(true)
    const data = {
      name: name.trim(),
      nickname: nickname.trim() || null,
      position,
      shirt_number: shirtNumber ? parseInt(shirtNumber) : null,
      nationality,
      overall: parseInt(overall),
      pace: parseInt(pace),
      shooting: parseInt(shooting),
      passing: parseInt(passing),
      dribbling: parseInt(dribbling),
      defending: parseInt(defending),
      physical: parseInt(physical),
      monthly_fee: parseFloat(monthlyFee) || 50,
    }
    if (editing) {
      await supabase.from('players').update(data).eq('id', editing.id)
    } else {
      await supabase.from('players').insert({ ...data, player_type: 'mensalista', role: 'player' })
    }
    resetForm()
    setSaving(false)
    onSaved()
  }

  if (!show) {
    return (
      <button onClick={onOpen} className="glass-card p-5 w-full flex items-center gap-3 hover:bg-white/[0.06] transition">
        <div className="w-12 h-12 rounded-full bg-primary-container/10 border-2 border-dashed border-primary-container/30 flex items-center justify-center">
          <UserPlus size={20} className="text-primary-container" />
        </div>
        <div className="text-left flex-1">
          <p className="text-white font-bold">Cadastrar jogador</p>
          <p className="text-xs text-on-surface-variant">Adicione novo mensalista ao elenco</p>
        </div>
        <ArrowRight size={16} className="text-on-surface-variant" />
      </button>
    )
  }

  return (
    <div className="glass-card p-5 border border-primary-container/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <UserPlus size={16} className="text-primary-container" />
          {editing ? 'Editar jogador' : 'Recruit Player'}
        </h3>
        <button onClick={onCancel} className="text-on-surface-variant hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="label-caps mb-1.5 block">Nome completo</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-base" placeholder="Ex: Carlos Eduardo" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps mb-1.5 block">Apelido</label>
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} className="input-base" placeholder="Maestro" />
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Numero</label>
            <input type="number" value={shirtNumber} onChange={e => setShirtNumber(e.target.value)} className="input-base" placeholder="10" />
          </div>
        </div>

        {/* Position chooser visual */}
        <div>
          <label className="label-caps mb-2 block">Posicao tatica</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(POSITION_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setPosition(key)}
                className={`py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition border ${
                  position === key
                    ? `bg-${cfg.color}/20 border-${cfg.color}/50 text-${cfg.color}`
                    : 'bg-white/[0.03] border-white/10 text-on-surface-variant hover:text-white hover:border-white/20'
                }`}
                style={position === key ? {
                  backgroundColor: `${cfg.dot}20`,
                  borderColor: `${cfg.dot}80`,
                  color: cfg.dot,
                } : {}}>
                {cfg.short}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-caps mb-1.5 block">Pais</label>
            <select value={nationality} onChange={e => setNationality(e.target.value)} className="select-base !py-2 text-sm">
              {NATIONALITIES.map(n => (
                <option key={n.code} value={n.code}>{n.flag} {n.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Mensalidade (R$)</label>
            <input type="number" step="0.01" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} className="input-base" />
          </div>
        </div>

        {/* Toggle stats FIFA */}
        <button onClick={() => setShowAdvanced(s => !s)}
          className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] border border-white/5 rounded-lg text-sm text-on-surface-variant hover:text-white transition">
          <span className="flex items-center gap-2">
            <Star size={12} />
            Stats FIFA (Overall: <strong className="text-white">{overall}</strong>)
          </span>
          <span>{showAdvanced ? '−' : '+'}</span>
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-2">
            <StatSlider label="OVR" value={overall} onChange={setOverall} />
            <StatSlider label="PAC" value={pace} onChange={setPace} />
            <StatSlider label="SHO" value={shooting} onChange={setShooting} />
            <StatSlider label="PAS" value={passing} onChange={setPassing} />
            <StatSlider label="DRI" value={dribbling} onChange={setDribbling} />
            <StatSlider label="DEF" value={defending} onChange={setDefending} />
            <StatSlider label="PHY" value={physical} onChange={setPhysical} />
          </div>
        )}

        <button onClick={save} disabled={saving || !name.trim() || !position}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 mt-2">
          <UserPlus size={14} />
          {saving ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Register Active'}
        </button>
      </div>
    </div>
  )
}

function StatSlider({ label, value, onChange }) {
  const v = parseInt(value) || 70
  const color = v >= 85 ? '#d4af37' : v >= 75 ? '#72dcff' : v >= 65 ? '#79ff5b' : '#d0c5af'
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</span>
        <span className="text-sm font-black tabular-nums" style={{ color }}>{v}</span>
      </div>
      <input type="range" min="40" max="99" value={v} onChange={e => onChange(e.target.value)}
        className="w-full h-1"
        style={{ accentColor: color }} />
    </div>
  )
}

// ============ GUEST POOL ============
function GuestPool({ guests, onPromote, onDeactivate }) {
  if (guests.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <LinkIcon size={14} className="text-on-surface-variant" /> Guest Pool
        </h3>
        <p className="text-xs text-on-surface-variant">Sem convidados no momento.</p>
      </div>
    )
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <LinkIcon size={14} className="text-on-surface-variant" /> Guest Pool
        </h3>
        <span className="chip bg-white/[0.05] text-on-surface-variant border border-white/10">
          {guests.length}
        </span>
      </div>
      <div className="space-y-2">
        {guests.map(g => {
          const initials = (g.nickname || g.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
          const pos = POSITION_CONFIG[g.position]
          return (
            <div key={g.id} className="flex items-center gap-2 p-2 bg-white/[0.03] border border-white/5 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {g.photo_url ? (
                  <img src={g.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold text-on-surface-variant">{initials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{g.name}</p>
                {pos && (
                  <p className="text-[10px]" style={{ color: pos.dot }}>● {pos.short}</p>
                )}
              </div>
              <button onClick={() => onPromote(g.id)} title="Promover para mensalista"
                className="p-1.5 rounded-lg bg-primary-container/15 text-primary-container hover:bg-primary-container/25 transition">
                <ArrowRight size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FilterPill({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
        active
          ? 'bg-primary-container/20 text-primary-container border border-primary-container/40'
          : 'bg-white/[0.04] text-on-surface-variant border border-white/5 hover:text-white'
      }`}>
      {children}
    </button>
  )
}

// Redimensiona imagem antes de subir
function resizeImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const side = Math.min(img.width, img.height)
        const sx = (img.width - side) / 2
        const sy = (img.height - side) / 2
        canvas.width = maxSize
        canvas.height = maxSize
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao gerar imagem')), 'image/jpeg', quality)
      }
      img.onerror = () => reject(new Error('Falha ao ler imagem'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'))
    reader.readAsDataURL(file)
  })
}
