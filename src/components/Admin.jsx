import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Shuffle, Save, Trophy, UserCog, Trash2, Link, Share2, Check, Users } from 'lucide-react'

const TEAM_SIZE = 7 // 6 linha + 1 goleiro

export default function Admin() {
  const [tab, setTab] = useState('match')
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: m } = await supabase.from('matches').select('*').order('date', { ascending: false }).limit(20)
    setMatches(m || [])
    const { data: p } = await supabase.from('players').select('*').order('player_type').order('name')
    setPlayers(p || [])
    setLoading(false)
  }

  const tabs = [
    { key: 'match', label: 'Rachas' },
    { key: 'stats', label: 'Estatisticas' },
    { key: 'players', label: 'Jogadores' },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <UserCog size={20} className="text-gold-400" /> Painel Admin
      </h2>

      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t.key ? 'bg-gold-400 text-navy-900' : 'bg-navy-800 text-slate-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-8 text-slate-400">Carregando...</div> : (
        <>
          {tab === 'match' && <MatchTab matches={matches} onReload={loadData} />}
          {tab === 'stats' && <StatsTab matches={matches} players={players} onReload={loadData} />}
          {tab === 'players' && <PlayersTab players={players} onReload={loadData} />}
        </>
      )}
    </div>
  )
}

// ============================================
// ABA: RACHAS
// ============================================
function MatchTab({ matches, onReload }) {
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [copiedId, setCopiedId] = useState('')
  const [numTeams, setNumTeams] = useState(2)

  async function createMatch() {
    if (!newDate) return
    setSaving(true)
    const { data: me } = await supabase
      .from('players').select('id').eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    await supabase.from('matches').insert({ date: newDate, notes: notes || null, created_by: me.id, status: 'open' })
    setNewDate(''); setNotes(''); setSaving(false); onReload()
  }

  function getConfirmLink(token) { return `${window.location.origin}/confirmar/${token}` }

  function copyLink(token) {
    navigator.clipboard.writeText(getConfirmLink(token))
    setCopiedId(token)
    setTimeout(() => setCopiedId(''), 2000)
  }

  function shareWhatsApp(match) {
    const link = getConfirmLink(match.token)
    const d = new Date(match.date + 'T12:00:00')
    const dateStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
    const text = `⚽ *RACHA DA SANTA*\n📅 ${dateStr}\n\nConfirme sua presenca:\n${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function sortTeams(matchId) {
    // Buscar confirmados
    const { data: confs } = await supabase
      .from('confirmations').select('player_id').eq('match_id', matchId).eq('status', 'confirmed')

    if (!confs || confs.length < numTeams * 2) {
      alert(`Precisa de pelo menos ${numTeams * 2} confirmados para sortear ${numTeams} times.`)
      return
    }

    // Limpar times antigos
    const { data: oldTeams } = await supabase.from('teams').select('id').eq('match_id', matchId)
    if (oldTeams) {
      for (const t of oldTeams) { await supabase.from('team_players').delete().eq('team_id', t.id) }
      await supabase.from('teams').delete().eq('match_id', matchId)
    }

    // Embaralhar jogadores
    const ids = confs.map(c => c.player_id)
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]]
    }

    // Calcular quantos vao pros times e quantos pro banco
    const totalForTeams = numTeams * TEAM_SIZE
    const teamPlayers = ids.slice(0, Math.min(totalForTeams, ids.length))
    const benchPlayers = ids.slice(Math.min(totalForTeams, ids.length))

    // Criar times
    const teamNames = ['Time A', 'Time B', 'Time C', 'Time D']
    const createdTeams = []

    for (let t = 0; t < numTeams; t++) {
      const { data: team } = await supabase
        .from('teams').insert({ match_id: matchId, name: teamNames[t] }).select().single()
      createdTeams.push(team)

      // Pegar jogadores desse time
      const start = t * TEAM_SIZE
      const end = Math.min(start + TEAM_SIZE, teamPlayers.length)
      const thisTeamPlayers = teamPlayers.slice(start, end)

      if (thisTeamPlayers.length > 0) {
        await supabase.from('team_players').insert(
          thisTeamPlayers.map(pid => ({ team_id: team.id, player_id: pid }))
        )
      }
    }

    // Criar banco de reservas se houver jogadores sobrando
    if (benchPlayers.length > 0) {
      const { data: bench } = await supabase
        .from('teams').insert({ match_id: matchId, name: 'Lista de Espera' }).select().single()
      await supabase.from('team_players').insert(
        benchPlayers.map(pid => ({ team_id: bench.id, player_id: pid }))
      )
    }

    await supabase.from('matches').update({ status: 'sorted' }).eq('id', matchId)
    onReload()
  }

  async function deleteMatch(matchId) {
    if (!confirm('Excluir este racha?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    onReload()
  }

  const statusColors = { open: 'bg-green-500/20 text-green-400', sorted: 'bg-blue-500/20 text-blue-400', finished: 'bg-slate-500/20 text-slate-400' }
  const statusLabels = { open: 'Aberto', sorted: 'Sorteado', finished: 'Finalizado' }

  return (
    <div className="space-y-4">
      {/* Criar racha */}
      <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400">Criar novo racha</h3>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Data</label>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Observacoes (opcional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm"
            placeholder="Ex: Campo diferente, horario especial..." />
        </div>
        <button onClick={createMatch} disabled={saving || !newDate}
          className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          <Plus size={16} /> {saving ? 'Criando...' : 'Criar Racha'}
        </button>
      </div>

      {/* Lista de rachas */}
      <div className="space-y-2">
        {matches.map(match => {
          const d = new Date(match.date + 'T12:00:00')
          const formatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return (
            <div key={match.id} className="bg-navy-800 rounded-xl p-3 space-y-2 border border-navy-700">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{formatted}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[match.status]}`}>{statusLabels[match.status]}</span>
                </div>
                {match.status !== 'finished' && (
                  <button onClick={() => deleteMatch(match.id)} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-1.5 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              {match.status !== 'finished' && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(match.token)}
                      className="flex-1 bg-navy-700 hover:bg-navy-600 text-slate-300 py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5">
                      {copiedId === match.token ? <><Check size={14} /> Copiado!</> : <><Link size={14} /> Copiar link</>}
                    </button>
                    <button onClick={() => shareWhatsApp(match)}
                      className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Share2 size={14} /> WhatsApp
                    </button>
                  </div>
                  {match.status === 'open' && (
                    <div className="flex gap-2 items-center">
                      <select value={numTeams} onChange={(e) => setNumTeams(parseInt(e.target.value))}
                        className="bg-navy-700 text-white rounded-lg p-2 text-xs outline-none">
                        <option value={2}>2 Times</option>
                        <option value={3}>3 Times</option>
                        <option value={4}>4 Times</option>
                      </select>
                      <button onClick={() => sortTeams(match.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1.5">
                        <Shuffle size={14} /> Sortear ({numTeams}x{TEAM_SIZE})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// ABA: ESTATISTICAS
// ============================================
function StatsTab({ matches, players, onReload }) {
  const [selectedMatch, setSelectedMatch] = useState('')
  const [stats, setStats] = useState({})
  const [teams, setTeams] = useState([])
  const [saving, setSaving] = useState(false)

  const sortedMatches = matches.filter(m => m.status === 'sorted' || m.status === 'finished')

  useEffect(() => { if (selectedMatch) loadMatchStats() }, [selectedMatch])

  async function loadMatchStats() {
    const { data: confs } = await supabase
      .from('confirmations').select('player_id, players(id, name, nickname)')
      .eq('match_id', selectedMatch).eq('status', 'confirmed')
    const { data: existingStats } = await supabase.from('match_stats').select('*').eq('match_id', selectedMatch)
    const { data: teamsData } = await supabase
      .from('teams').select('*, team_players(player_id, players(name, nickname))')
      .eq('match_id', selectedMatch)
    setTeams(teamsData || [])

    const statsMap = {}
    confs?.forEach(c => {
      const existing = existingStats?.find(s => s.player_id === c.player_id)
      statsMap[c.player_id] = {
        name: c.players?.nickname || c.players?.name,
        goals: existing?.goals || 0, assists: existing?.assists || 0, present: existing?.present ?? true
      }
    })
    setStats(statsMap)
  }

  function updateStat(pid, field, value) { setStats(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } })) }

  async function saveStats() {
    setSaving(true)
    await supabase.from('match_stats').delete().eq('match_id', selectedMatch)
    const rows = Object.entries(stats).map(([pid, s]) => ({
      match_id: selectedMatch, player_id: pid, goals: parseInt(s.goals) || 0, assists: parseInt(s.assists) || 0, present: s.present
    }))
    await supabase.from('match_stats').insert(rows)
    await supabase.from('matches').update({ status: 'finished' }).eq('id', selectedMatch)
    setSaving(false); alert('Estatisticas salvas!'); onReload()
  }

  async function setWinner(teamId) {
    // Apenas times que nao sao banco de reservas podem vencer
    for (const t of teams) {
      if (t.name !== 'Lista de Espera') {
        await supabase.from('teams').update({ won: t.id === teamId }).eq('id', t.id)
      }
    }
    const { data } = await supabase.from('teams').select('*, team_players(player_id, players(name, nickname))').eq('match_id', selectedMatch)
    setTeams(data || [])
  }

  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')
  const bench = teams.find(t => t.name === 'Lista de Espera')

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-2">Selecione o racha</h3>
        <select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)}
          className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none text-sm">
          <option value="">Escolha um racha...</option>
          {sortedMatches.map(m => (
            <option key={m.id} value={m.id}>
              {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {m.status === 'finished' ? 'Finalizado' : 'Sorteado'}
            </option>
          ))}
        </select>
      </div>

      {/* Times sorteados */}
      {teams.length > 0 && selectedMatch && (
        <>
          {/* Visualizacao dos times */}
          <div className="space-y-2">
            {teams.map(t => (
              <div key={t.id} className="bg-navy-800 rounded-xl p-3 border border-navy-700">
                <div className="flex items-center justify-between mb-2">
                  <h4 className={`text-sm font-semibold ${t.name === 'Lista de Espera' ? 'text-slate-400' : 'text-white'}`}>
                    {t.name} ({t.team_players?.length || 0})
                  </h4>
                  {t.won && <span className="text-xs text-gold-400">🏆 Vencedor</span>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.team_players?.map(tp => (
                    <span key={tp.player_id} className="text-xs bg-navy-700 text-slate-300 px-2 py-1 rounded">
                      {tp.players?.nickname || tp.players?.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Quem venceu */}
          {regularTeams.length > 0 && (
            <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
              <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
                <Trophy size={14} /> Quem venceu?
              </h3>
              <div className="flex gap-2">
                {regularTeams.map(t => (
                  <button key={t.id} onClick={() => setWinner(t.id)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                      t.won ? 'bg-gold-400/20 text-gold-400 ring-1 ring-gold-400/50' : 'bg-navy-700 text-slate-400 hover:text-white'
                    }`}>
                    {t.name} {t.won ? '🏆' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Gols e assistencias */}
      {Object.keys(stats).length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400">Gols e Assistencias</h3>
          {Object.entries(stats).map(([pid, s]) => (
            <div key={pid} className="bg-navy-700/50 rounded-xl p-3">
              <p className="text-white text-sm font-medium mb-2">{s.name}</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Gols</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateStat(pid, 'goals', Math.max(0, s.goals - 1))}
                      className="bg-navy-600 text-white w-8 h-8 rounded-lg text-lg">-</button>
                    <span className="text-white font-bold text-lg w-8 text-center">{s.goals}</span>
                    <button onClick={() => updateStat(pid, 'goals', s.goals + 1)}
                      className="bg-gold-400 text-navy-900 w-8 h-8 rounded-lg text-lg font-bold">+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Assist.</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateStat(pid, 'assists', Math.max(0, s.assists - 1))}
                      className="bg-navy-600 text-white w-8 h-8 rounded-lg text-lg">-</button>
                    <span className="text-white font-bold text-lg w-8 text-center">{s.assists}</span>
                    <button onClick={() => updateStat(pid, 'assists', s.assists + 1)}
                      className="bg-blue-600 text-white w-8 h-8 rounded-lg text-lg font-bold">+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={saveStats} disabled={saving}
            className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar e Finalizar Racha'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================
// ABA: JOGADORES
// ============================================
function PlayersTab({ players, onReload }) {
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [position, setPosition] = useState('')
  const [shirtNumber, setShirtNumber] = useState('')
  const [saving, setSaving] = useState(false)

  const mensalistas = players.filter(p => p.player_type === 'mensalista')
  const avulsos = players.filter(p => p.player_type === 'avulso')
  const positionLabels = { goleiro: 'Goleiro', zagueiro: 'Zagueiro', meia: 'Meia', atacante: 'Atacante' }

  async function addPlayer() {
    if (!name.trim() || !position) return
    setSaving(true)
    await supabase.from('players').insert({
      name: name.trim(), nickname: nickname.trim() || null, position,
      shirt_number: shirtNumber ? parseInt(shirtNumber) : null, player_type: 'mensalista', role: 'player'
    })
    setName(''); setNickname(''); setPosition(''); setShirtNumber(''); setShowForm(false); setSaving(false); onReload()
  }

  async function promoteToMensalista(pid) {
    await supabase.from('players').update({ player_type: 'mensalista' }).eq('id', pid)
    onReload()
  }

  async function deactivatePlayer(pid) {
    if (!confirm('Desativar este jogador?')) return
    await supabase.from('players').update({ active: false }).eq('id', pid)
    onReload()
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)}
        className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2 text-sm">
        <Plus size={16} /> Cadastrar mensalista
      </button>

      {showForm && (
        <div className="bg-navy-800 rounded-2xl p-4 space-y-3 border border-navy-700">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nome completo</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Apelido</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Posicao</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none text-sm">
                <option value="">Selecione</option>
                <option value="goleiro">Goleiro</option>
                <option value="zagueiro">Zagueiro</option>
                <option value="meia">Meia</option>
                <option value="atacante">Atacante</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs text-slate-400 mb-1">Numero</label>
              <input type="number" value={shirtNumber} onChange={(e) => setShirtNumber(e.target.value)}
                className="w-full bg-navy-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-gold-400 text-sm" placeholder="10" />
            </div>
          </div>
          <button onClick={addPlayer} disabled={saving || !name.trim() || !position}
            className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-2.5 rounded-lg transition disabled:opacity-50 text-sm">
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      )}

      <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
        <h3 className="text-sm font-semibold text-gold-400 mb-3">Mensalistas ({mensalistas.filter(p => p.active).length})</h3>
        <div className="space-y-2">
          {mensalistas.filter(p => p.active).map(p => (
            <div key={p.id} className="bg-navy-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center text-gold-400 text-xs font-bold">
                {p.shirt_number || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {p.name} {p.nickname && <span className="text-slate-400 text-xs">({p.nickname})</span>}
                </p>
                <span className="text-xs text-slate-500">{positionLabels[p.position] || 'Sem posicao'}</span>
              </div>
              <button onClick={() => deactivatePlayer(p.id)}
                className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {avulsos.filter(p => p.active).length > 0 && (
        <div className="bg-navy-800 rounded-2xl p-4 border border-navy-700">
          <h3 className="text-sm font-semibold text-gold-400 mb-3">Avulsos ({avulsos.filter(p => p.active).length})</h3>
          <p className="text-xs text-slate-500 mb-3">Jogadores que entraram pelo link de confirmacao.</p>
          <div className="space-y-2">
            {avulsos.filter(p => p.active).map(p => (
              <div key={p.id} className="bg-navy-700/50 rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1"><p className="text-white text-sm">{p.name}</p></div>
                <button onClick={() => promoteToMensalista(p.id)}
                  className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-semibold">
                  Tornar mensalista
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
