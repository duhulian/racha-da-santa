import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Shuffle, Save, Trophy, UserCog, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export default function Admin() {
  const [tab, setTab] = useState('match')
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: m } = await supabase
      .from('matches')
      .select('*')
      .order('date', { ascending: false })
      .limit(10)
    setMatches(m || [])

    const { data: p } = await supabase
      .from('players')
      .select('*')
      .eq('active', true)
      .order('name')
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
        <UserCog size={20} className="text-green-400" />
        Painel Admin
      </h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${
              tab === t.key ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando...</div>
      ) : (
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
// ABA: GERENCIAR RACHAS
// ============================================
function MatchTab({ matches, onReload }) {
  const [newDate, setNewDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function createMatch() {
    if (!newDate) return
    setSaving(true)

    const { data: me } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id)
      .single()

    await supabase.from('matches').insert({
      date: newDate,
      notes: notes || null,
      created_by: me.id,
      status: 'open'
    })

    setNewDate('')
    setNotes('')
    setSaving(false)
    onReload()
  }

  async function sortTeams(matchId) {
    // Buscar confirmados
    const { data: confs } = await supabase
      .from('confirmations')
      .select('player_id')
      .eq('match_id', matchId)

    if (!confs || confs.length < 2) {
      alert('Precisa de pelo menos 2 jogadores confirmados para sortear.')
      return
    }

    // Deletar times antigos se existirem
    const { data: oldTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('match_id', matchId)

    if (oldTeams) {
      for (const t of oldTeams) {
        await supabase.from('team_players').delete().eq('team_id', t.id)
      }
      await supabase.from('teams').delete().eq('match_id', matchId)
    }

    // Embaralhar jogadores
    const playerIds = confs.map(c => c.player_id)
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]]
    }

    // Dividir em 2 times
    const mid = Math.ceil(playerIds.length / 2)
    const team1Players = playerIds.slice(0, mid)
    const team2Players = playerIds.slice(mid)

    // Criar times
    const { data: t1 } = await supabase
      .from('teams')
      .insert({ match_id: matchId, name: 'Time A' })
      .select()
      .single()

    const { data: t2 } = await supabase
      .from('teams')
      .insert({ match_id: matchId, name: 'Time B' })
      .select()
      .single()

    // Inserir jogadores nos times
    await supabase.from('team_players').insert(
      team1Players.map(pid => ({ team_id: t1.id, player_id: pid }))
    )
    await supabase.from('team_players').insert(
      team2Players.map(pid => ({ team_id: t2.id, player_id: pid }))
    )

    // Atualizar status do racha
    await supabase.from('matches').update({ status: 'sorted' }).eq('id', matchId)

    onReload()
  }

  async function deleteMatch(matchId) {
    if (!confirm('Tem certeza que quer excluir este racha?')) return
    await supabase.from('matches').delete().eq('id', matchId)
    onReload()
  }

  return (
    <div className="space-y-4">
      {/* Criar racha */}
      <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Criar novo racha</h3>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Data</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Observacoes (opcional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-2.5 text-white outline-none focus:ring-2 focus:ring-green-500 text-sm"
            placeholder="Ex: Racha especial, campo diferente..."
          />
        </div>
        <button
          onClick={createMatch}
          disabled={saving || !newDate}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={16} />
          {saving ? 'Criando...' : 'Criar Racha'}
        </button>
      </div>

      {/* Lista de rachas */}
      <div className="space-y-2">
        {matches.map(match => {
          const d = new Date(match.date + 'T12:00:00')
          const formatted = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          const statusColors = {
            open: 'bg-green-500/20 text-green-400',
            sorted: 'bg-blue-500/20 text-blue-400',
            finished: 'bg-slate-500/20 text-slate-400',
          }
          const statusLabels = { open: 'Aberto', sorted: 'Sorteado', finished: 'Finalizado' }

          return (
            <div key={match.id} className="bg-slate-800 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{formatted}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[match.status]}`}>
                  {statusLabels[match.status]}
                </span>
              </div>
              <div className="flex gap-2">
                {match.status === 'open' && (
                  <button
                    onClick={() => sortTeams(match.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition"
                    title="Sortear times"
                  >
                    <Shuffle size={16} />
                  </button>
                )}
                {match.status !== 'finished' && (
                  <button
                    onClick={() => deleteMatch(match.id)}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 p-2 rounded-lg transition"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// ABA: REGISTRAR ESTATISTICAS
// ============================================
function StatsTab({ matches, players, onReload }) {
  const [selectedMatch, setSelectedMatch] = useState('')
  const [stats, setStats] = useState({})
  const [teams, setTeams] = useState([])
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const sortedMatches = matches.filter(m => m.status === 'sorted' || m.status === 'finished')

  useEffect(() => {
    if (selectedMatch) loadMatchStats()
  }, [selectedMatch])

  async function loadMatchStats() {
    // Buscar confirmados do racha
    const { data: confs } = await supabase
      .from('confirmations')
      .select('player_id, players(id, name, nickname)')
      .eq('match_id', selectedMatch)

    // Buscar stats existentes
    const { data: existingStats } = await supabase
      .from('match_stats')
      .select('*')
      .eq('match_id', selectedMatch)

    // Buscar times
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*, team_players(player_id)')
      .eq('match_id', selectedMatch)

    setTeams(teamsData || [])

    // Montar objeto de stats
    const statsMap = {}
    confs?.forEach(c => {
      const existing = existingStats?.find(s => s.player_id === c.player_id)
      statsMap[c.player_id] = {
        name: c.players?.nickname || c.players?.name,
        goals: existing?.goals || 0,
        assists: existing?.assists || 0,
        present: existing?.present ?? true
      }
    })
    setStats(statsMap)
    setExpanded(true)
  }

  function updateStat(playerId, field, value) {
    setStats(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value }
    }))
  }

  async function saveStats() {
    setSaving(true)

    // Deletar stats antigos do racha
    await supabase.from('match_stats').delete().eq('match_id', selectedMatch)

    // Inserir novos
    const rows = Object.entries(stats).map(([playerId, s]) => ({
      match_id: selectedMatch,
      player_id: playerId,
      goals: parseInt(s.goals) || 0,
      assists: parseInt(s.assists) || 0,
      present: s.present
    }))

    await supabase.from('match_stats').insert(rows)

    // Marcar racha como finalizado
    await supabase.from('matches').update({ status: 'finished' }).eq('id', selectedMatch)

    setSaving(false)
    alert('Estatisticas salvas!')
    onReload()
  }

  async function setWinner(teamId) {
    // Resetar todos
    for (const t of teams) {
      await supabase.from('teams').update({ won: t.id === teamId }).eq('id', t.id)
    }

    // Reload teams
    const { data: teamsData } = await supabase
      .from('teams')
      .select('*, team_players(player_id)')
      .eq('match_id', selectedMatch)
    setTeams(teamsData || [])
  }

  return (
    <div className="space-y-4">
      {/* Selecionar racha */}
      <div className="bg-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Selecione o racha</h3>
        <select
          value={selectedMatch}
          onChange={(e) => setSelectedMatch(e.target.value)}
          className="w-full bg-slate-700 rounded-lg p-2.5 text-white outline-none text-sm"
        >
          <option value="">Escolha um racha...</option>
          {sortedMatches.map(m => {
            const d = new Date(m.date + 'T12:00:00')
            return (
              <option key={m.id} value={m.id}>
                {d.toLocaleDateString('pt-BR')} - {m.status === 'finished' ? 'Finalizado' : 'Sorteado'}
              </option>
            )
          })}
        </select>
      </div>

      {/* Vencedor do racha */}
      {teams.length > 0 && selectedMatch && (
        <div className="bg-slate-800 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Trophy size={14} className="text-yellow-400" />
            Quem venceu?
          </h3>
          <div className="flex gap-2">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => setWinner(t.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                  t.won
                    ? 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50'
                    : 'bg-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {t.name} {t.won ? '🏆' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Estatisticas por jogador */}
      {expanded && Object.keys(stats).length > 0 && (
        <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">Gols e Assistencias</h3>

          {Object.entries(stats).map(([playerId, s]) => (
            <div key={playerId} className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-white text-sm font-medium mb-2">{s.name}</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Gols</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateStat(playerId, 'goals', Math.max(0, s.goals - 1))}
                      className="bg-slate-600 text-white w-8 h-8 rounded-lg text-lg"
                    >-</button>
                    <span className="text-white font-bold text-lg w-8 text-center">{s.goals}</span>
                    <button
                      onClick={() => updateStat(playerId, 'goals', s.goals + 1)}
                      className="bg-green-600 text-white w-8 h-8 rounded-lg text-lg"
                    >+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Assist.</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateStat(playerId, 'assists', Math.max(0, s.assists - 1))}
                      className="bg-slate-600 text-white w-8 h-8 rounded-lg text-lg"
                    >-</button>
                    <span className="text-white font-bold text-lg w-8 text-center">{s.assists}</span>
                    <button
                      onClick={() => updateStat(playerId, 'assists', s.assists + 1)}
                      className="bg-blue-600 text-white w-8 h-8 rounded-lg text-lg"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={saveStats}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Salvando...' : 'Salvar e Finalizar Racha'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================
// ABA: GERENCIAR JOGADORES
// ============================================
function PlayersTab({ players, onReload }) {
  const [toggleLoading, setToggleLoading] = useState('')

  async function toggleAdmin(playerId, currentRole) {
    setToggleLoading(playerId)
    const newRole = currentRole === 'admin' ? 'player' : 'admin'
    await supabase.from('players').update({ role: newRole }).eq('id', playerId)
    setToggleLoading('')
    onReload()
  }

  async function toggleActive(playerId, currentActive) {
    setToggleLoading(playerId)
    await supabase.from('players').update({ active: !currentActive }).eq('id', playerId)
    setToggleLoading('')
    onReload()
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Jogadores cadastrados ({players.length})
        </h3>

        <div className="space-y-2">
          {players.map(p => (
            <div key={p.id} className="bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">
                  {p.name}
                  {p.nickname && <span className="text-slate-400 text-xs ml-1">({p.nickname})</span>}
                </p>
                <span className={`text-xs ${p.role === 'admin' ? 'text-green-400' : 'text-slate-500'}`}>
                  {p.role === 'admin' ? 'Admin' : 'Jogador'}
                </span>
              </div>
              <button
                onClick={() => toggleAdmin(p.id, p.role)}
                disabled={toggleLoading === p.id}
                className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                  p.role === 'admin'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                }`}
              >
                {p.role === 'admin' ? 'Admin' : 'Tornar Admin'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
