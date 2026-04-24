import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LayoutDashboard, Calendar, Swords, Users, Wallet, History,
  Trophy, Save, Activity
} from 'lucide-react'

import CommandCenter from './CommandCenter'
import MatchOperations from './MatchOperations'
import RosterCommand from './RosterCommand'
import Treasury from './Treasury'
import LiveMatchControl from './LiveMatchControl'

// =============================================
// ADMIN HUB - v10
// Orquestra todas as secoes admin:
// - Dashboard (Command Center)
// - Rachas (Match Operations)
// - Partidas (Games Tab CORRIGIDA)
// - Jogadores (Roster Command)
// - Financeiro (Treasury)
// - Historico (Import de rachas passados)
//
// Mais controla um modo "Live Match Control" overlay
// =============================================

export default function Admin() {
  const [view, setView] = useState('dashboard')
  const [liveMatchId, setLiveMatchId] = useState(null)

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'matches', label: 'Rachas', icon: Calendar },
    { key: 'games', label: 'Partidas', icon: Swords },
    { key: 'players', label: 'Jogadores', icon: Users },
    { key: 'treasury', label: 'Financeiro', icon: Wallet },
    { key: 'history', label: 'Historico', icon: History },
  ]

  // Handler usado pelo Command Center pra navegar
  function navigateFromDashboard(target, matchId) {
    if (target === 'games' && matchId) {
      setLiveMatchId(matchId)
      return
    }
    if (target === 'matches') { setView('matches'); return }
    if (target === 'treasury') { setView('treasury'); return }
    if (target === 'players') { setView('players'); return }
  }

  // Se esta em Live Match Control, renderiza tela cheia dele
  if (liveMatchId) {
    return (
      <LiveMatchControl
        matchId={liveMatchId}
        onClose={() => setLiveMatchId(null)}
      />
    )
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="glass-card p-1.5 inline-flex gap-1 overflow-x-auto w-full lg:w-auto">
        {tabs.map(t => {
          const Icon = t.icon
          const active = view === t.key
          return (
            <button key={t.key} onClick={() => setView(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs lg:text-sm font-semibold transition whitespace-nowrap ${
                active
                  ? 'bg-primary-container text-on-primary'
                  : 'text-on-surface-variant hover:text-white hover:bg-white/5'
              }`}>
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {view === 'dashboard' && <CommandCenter onNavigate={navigateFromDashboard} />}
      {view === 'matches' && <MatchOperations onStartLive={(id) => setLiveMatchId(id)} />}
      {view === 'games' && <GamesTab onStartLive={(id) => setLiveMatchId(id)} />}
      {view === 'players' && <RosterCommand />}
      {view === 'treasury' && <Treasury />}
      {view === 'history' && <HistoryTab />}
    </div>
  )
}

// ============ GAMES TAB (CORRIGIDO) ============
// Bug antigo: selecionar racha finalizado nao mostrava nada
// Agora: mostra tudo (times, games, stats) em qualquer status
function GamesTab({ onStartLive }) {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [match, setMatch] = useState(null)
  const [teams, setTeams] = useState([])
  const [teamPlayers, setTeamPlayers] = useState({})
  const [games, setGames] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadMatches() }, [])
  useEffect(() => { if (selectedMatch) loadMatchData() }, [selectedMatch])

  async function loadMatches() {
    const { data } = await supabase.from('matches').select('*')
      .in('status', ['sorted', 'finished'])
      .order('date', { ascending: false }).limit(50)
    setMatches(data || [])
  }

  async function loadMatchData() {
    setLoading(true)
    const { data: m } = await supabase.from('matches').select('*').eq('id', selectedMatch).single()
    setMatch(m)

    const { data: t } = await supabase.from('teams')
      .select('*, team_players(player_id, players(id, name, nickname, position, shirt_number, photo_url, overall))')
      .eq('match_id', selectedMatch)
    setTeams(t || [])

    const tpMap = {}
    t?.forEach(team => { tpMap[team.id] = team.team_players?.map(tp => tp.players) || [] })
    setTeamPlayers(tpMap)

    const { data: g } = await supabase.from('games')
      .select('*, game_goals(*, scorer:scorer_id(name, nickname), assister:assist_id(name, nickname))')
      .eq('match_id', selectedMatch).order('game_number', { ascending: true })
    setGames(g || [])

    const { data: s } = await supabase.from('match_stats')
      .select('*, players(name, nickname, photo_url)')
      .eq('match_id', selectedMatch).order('goals', { ascending: false })
    setStats(s || [])

    setLoading(false)
  }

  const regularTeams = teams.filter(t => t.name !== 'Lista de Espera')
  const waitlist = teams.find(t => t.name === 'Lista de Espera')
  const champion = regularTeams.find(t => t.won)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Swords size={16} className="text-primary-container" />
          <span className="label-caps text-primary-container">Games Tab</span>
        </div>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Centro de Partidas</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Consulte times, jogos e estatisticas de qualquer racha sorteado ou finalizado.
        </p>
      </div>

      {/* Seletor */}
      <div className="glass-card p-5">
        <label className="label-caps mb-2 block">Selecione o racha</label>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
            className="select-base flex-1">
            <option value="">Escolha um racha...</option>
            {matches.map(m => {
              const d = new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')
              const label = m.status === 'finished' ? 'Finalizado' : 'Sorteado'
              return <option key={m.id} value={m.id}>{d} - {label}</option>
            })}
          </select>
          {selectedMatch && match?.status === 'sorted' && (
            <button onClick={() => onStartLive(selectedMatch)}
              className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2 whitespace-nowrap">
              <Activity size={14} /> Abrir Live Control
            </button>
          )}
        </div>
      </div>

      {/* Placeholder sem selecao */}
      {!selectedMatch && (
        <div className="glass-card p-10 text-center">
          <Swords size={40} className="text-on-surface-variant/40 mx-auto mb-3" />
          <p className="text-on-surface-variant">Selecione um racha acima para ver os detalhes.</p>
        </div>
      )}

      {loading && (
        <div className="text-center py-8 text-on-surface-variant">
          <Activity size={32} className="text-primary-container/40 mx-auto mb-2 animate-pulse" />
          Carregando...
        </div>
      )}

      {selectedMatch && !loading && match && (
        <>
          {/* Match header info */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`chip border ${
                    match.status === 'finished'
                      ? 'bg-white/5 text-on-surface-variant border-white/10'
                      : 'bg-primary-container/15 text-primary-container border-primary-container/30'
                  }`}>
                    {match.status === 'finished' ? 'FINALIZADO' : 'SORTEADO'}
                  </span>
                  {champion && (
                    <span className="flex items-center gap-1 text-xs text-primary-container font-bold">
                      <Trophy size={12} /> Campeao: {champion.name}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-white">
                  {match.name || `Racha ${new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                </h3>
                <p className="text-xs text-on-surface-variant mt-1">
                  {match.location || 'Arena Santa'} | {(match.match_time || '20:00').substring(0, 5)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-white tabular-nums leading-none">{regularTeams.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">Times</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-primary-container tabular-nums leading-none">{games.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">Games</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-secondary-fixed tabular-nums leading-none">
                    {stats.reduce((s, r) => s + (r.goals || 0), 0)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mt-0.5">Gols</p>
                </div>
              </div>
            </div>
          </div>

          {/* Times formados */}
          {regularTeams.length > 0 && (
            <div>
              <h3 className="label-caps mb-3">Times Formados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {regularTeams.map(t => (
                  <TeamCard key={t.id} team={t} players={teamPlayers[t.id] || []} isChampion={t.won} />
                ))}
              </div>
              {waitlist && teamPlayers[waitlist.id]?.length > 0 && (
                <div className="mt-3 glass-card p-4 border border-white/5">
                  <p className="label-caps mb-2">Lista de Espera ({teamPlayers[waitlist.id].length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {teamPlayers[waitlist.id].map(p => (
                      <span key={p.id} className="text-xs px-2 py-1 bg-white/[0.04] border border-white/10 rounded-lg text-on-surface-variant">
                        {p.nickname || p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Games jogados */}
          {games.length > 0 && (
            <div>
              <h3 className="label-caps mb-3">Jogos ({games.length})</h3>
              <div className="glass-card overflow-hidden">
                {games.map(g => {
                  const tA = regularTeams.find(t => t.id === g.team_a_id)
                  const tB = regularTeams.find(t => t.id === g.team_b_id)
                  const winner = regularTeams.find(t => t.id === g.winner_team_id)
                  return (
                    <div key={g.id} className="p-4 border-b border-white/5 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="label-caps">Game {g.game_number}</span>
                        {winner && (
                          <span className="text-xs text-primary-container font-bold flex items-center gap-1">
                            <Trophy size={10} /> {winner.name}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                        <span className={`text-sm font-bold text-right truncate ${
                          g.winner_team_id === g.team_a_id ? 'text-primary-container' : 'text-white'
                        }`}>{tA?.name}</span>
                        <span className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-black text-lg tabular-nums text-white whitespace-nowrap">
                          {g.score_a} <span className="text-on-surface-variant text-xs">x</span> {g.score_b}
                        </span>
                        <span className={`text-sm font-bold truncate ${
                          g.winner_team_id === g.team_b_id ? 'text-primary-container' : 'text-white'
                        }`}>{tB?.name}</span>
                      </div>
                      {g.game_goals?.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {g.game_goals.map((gl, i) => (
                            <p key={i} className="text-xs text-on-surface-variant">
                              ⚽ {gl.scorer?.nickname || gl.scorer?.name}
                              {gl.assister && (
                                <span className="text-on-surface-variant/60">
                                  {' '}(assist. {gl.assister?.nickname || gl.assister?.name})
                                </span>
                              )}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stats consolidadas */}
          {stats.length > 0 && (
            <div>
              <h3 className="label-caps mb-3">Artilharia & Assistencias</h3>
              <div className="glass-card overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left label-caps p-3">Jogador</th>
                      <th className="text-right label-caps p-3 w-20">Gols</th>
                      <th className="text-right label-caps p-3 w-20">Assist</th>
                      <th className="text-right label-caps p-3 w-20 hidden sm:table-cell">MOTM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.filter(s => (s.goals || 0) + (s.assists || 0) > 0).map(s => {
                      const p = s.players
                      return (
                        <tr key={s.id} className="border-b border-white/5 last:border-0">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              {p?.photo_url ? (
                                <img src={p.photo_url} className="w-7 h-7 rounded-full object-cover border border-white/10" alt="" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[10px] text-on-surface-variant font-bold">
                                  {(p?.nickname || p?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                              )}
                              <span className="text-sm text-white font-semibold">{p?.nickname || p?.name}</span>
                            </div>
                          </td>
                          <td className="text-right p-3 text-sm font-bold text-primary-container tabular-nums">{s.goals}</td>
                          <td className="text-right p-3 text-sm font-bold text-secondary-fixed tabular-nums">{s.assists}</td>
                          <td className="text-right p-3 text-sm text-on-surface-variant tabular-nums hidden sm:table-cell">{s.motm ? '⭐' : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {regularTeams.length === 0 && games.length === 0 && stats.length === 0 && (
            <div className="glass-card p-8 text-center">
              <Calendar size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-on-surface-variant">
                Este racha nao tem dados registrados (times, games ou stats).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TeamCard({ team, players, isChampion }) {
  const sorted = [...players].sort((a, b) => {
    const order = { goleiro: 0, zagueiro: 1, meia: 2, atacante: 3 }
    return (order[a.position] ?? 99) - (order[b.position] ?? 99)
  })

  return (
    <div className={`glass-card p-4 ${isChampion ? 'border border-primary-container/40 shadow-[0_0_20px_rgba(212,175,55,0.1)]' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-bold text-white">{team.name}</h4>
        {isChampion && (
          <span className="chip bg-primary-container/20 text-primary-container border border-primary-container/50">
            <Trophy size={10} className="mr-1" /> CAMPEAO
          </span>
        )}
      </div>
      <div className="space-y-1">
        {sorted.map(p => (
          <div key={p.id} className="flex items-center gap-2 py-1 text-sm">
            {p.photo_url ? (
              <img src={p.photo_url} className="w-6 h-6 rounded-full object-cover border border-white/10" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-[9px] text-on-surface-variant font-bold">
                {p.shirt_number || '?'}
              </div>
            )}
            <span className="text-white truncate flex-1">{p.nickname || p.name}</span>
            {p.position && (
              <span className={`chip chip-${p.position}`}>
                {{ goleiro: 'GK', zagueiro: 'ZAG', meia: 'MEI', atacante: 'FW' }[p.position]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ HISTORY TAB (mantido do v9, com UI atualizada) ============
function HistoryTab() {
  const [players, setPlayers] = useState([])
  const [date, setDate] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState({})
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('players').select('*')
      .eq('active', true).order('name')
    setPlayers(data || [])
  }

  const activePlayers = players.filter(p => p.active)

  function togglePlayer(pid) {
    setSelectedPlayers(prev => {
      if (prev[pid]) {
        const c = { ...prev }; delete c[pid]; return c
      }
      const p = activePlayers.find(pl => pl.id === pid)
      return { ...prev, [pid]: { name: p.nickname || p.name, goals: 0, assists: 0 } }
    })
  }

  function updateStat(pid, field, value) {
    setSelectedPlayers(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))
  }

  async function importMatch() {
    if (!date || Object.keys(selectedPlayers).length === 0) return
    setSaving(true); setSuccess('')
    const { data: me } = await supabase.from('players').select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id).single()
    const { data: match } = await supabase.from('matches').insert({
      date,
      status: 'finished',
      created_by: me?.id,
      notes: 'Importado do historico',
    }).select().single()
    if (!match) { setSaving(false); alert('Erro'); return }

    await supabase.from('confirmations').insert(Object.keys(selectedPlayers).map(pid => ({
      match_id: match.id, player_id: pid, status: 'confirmed',
    })))
    await supabase.from('match_stats').insert(Object.entries(selectedPlayers).map(([pid, s]) => ({
      match_id: match.id, player_id: pid,
      goals: parseInt(s.goals) || 0,
      assists: parseInt(s.assists) || 0,
      present: true,
    })))

    setDate(''); setSelectedPlayers({}); setSaving(false)
    setSuccess('Racha importado com sucesso!')
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <History size={16} className="text-primary-container" />
          <span className="label-caps text-primary-container">Historico</span>
        </div>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Importar rachas passados</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Cadastre rachas anteriores pra alimentar o dashboard e os rankings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Form lateral */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-card p-5">
            {success && (
              <div className="bg-secondary-container/10 border border-secondary-container/30 text-secondary-fixed text-sm rounded-lg px-4 py-3 mb-4">
                {success}
              </div>
            )}
            <label className="label-caps mb-1.5 block">Data do racha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
          </div>

          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-white mb-3">Quem jogou?</h3>
            <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto">
              {activePlayers.map(p => (
                <button key={p.id} onClick={() => togglePlayer(p.id)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                    selectedPlayers[p.id]
                      ? 'bg-primary-container text-on-primary'
                      : 'bg-white/[0.04] border border-white/10 text-on-surface-variant hover:text-white'
                  }`}>
                  {p.nickname || p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="lg:col-span-7">
          {Object.keys(selectedPlayers).length > 0 ? (
            <div className="glass-card p-5">
              <h3 className="text-lg font-bold text-white mb-4">Gols e assistencias</h3>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {Object.entries(selectedPlayers).map(([pid, s]) => (
                  <div key={pid} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                    <p className="text-sm font-semibold text-white mb-2">{s.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label-caps mb-1 block">Gols</label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStat(pid, 'goals', Math.max(0, s.goals - 1))}
                            className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
                          <span className="text-white font-extrabold text-lg w-8 text-center tabular-nums">{s.goals}</span>
                          <button onClick={() => updateStat(pid, 'goals', s.goals + 1)}
                            className="bg-primary-container text-on-primary w-9 h-9 rounded-lg text-lg font-bold hover:bg-primary">+</button>
                        </div>
                      </div>
                      <div>
                        <label className="label-caps mb-1 block">Assist.</label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStat(pid, 'assists', Math.max(0, s.assists - 1))}
                            className="bg-white/[0.05] text-white w-9 h-9 rounded-lg text-lg hover:bg-white/[0.08]">−</button>
                          <span className="text-white font-extrabold text-lg w-8 text-center tabular-nums">{s.assists}</span>
                          <button onClick={() => updateStat(pid, 'assists', s.assists + 1)}
                            className="bg-tertiary-container text-on-surface w-9 h-9 rounded-lg text-lg font-bold hover:bg-tertiary">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={importMatch} disabled={saving || !date}
                className="btn-primary w-full py-3 mt-4 flex items-center justify-center gap-2">
                <Save size={14} /> {saving ? 'Salvando...' : 'Importar Racha'}
              </button>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <Users size={32} className="text-on-surface-variant/40 mx-auto mb-2" />
              <p className="text-on-surface-variant">Selecione quem jogou para comecar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
