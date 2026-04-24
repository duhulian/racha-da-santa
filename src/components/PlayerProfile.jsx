import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Target, Handshake, Star, ArrowLeft, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const POSITION_LABELS = { goleiro: 'GOL', zagueiro: 'ZAG', meia: 'MEI', atacante: 'ATA' }
const POSITION_NAMES = { goleiro: 'Goleiro', zagueiro: 'Zagueiro', meia: 'Meia', atacante: 'Atacante' }

// Bandeiras mais comuns, fallback pra BR
const FLAG_EMOJI = {
  BR: '🇧🇷', PT: '🇵🇹', AR: '🇦🇷', UY: '🇺🇾', CO: '🇨🇴',
  ES: '🇪🇸', IT: '🇮🇹', FR: '🇫🇷', DE: '🇩🇪', NL: '🇳🇱',
  EN: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', US: '🇺🇸', MX: '🇲🇽', JP: '🇯🇵',
}

export default function PlayerProfile() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const [player, setPlayer] = useState(null)
  const [stats, setStats] = useState({ totalGoals: 0, totalAssists: 0, totalMotm: 0, totalPresences: 0 })
  const [recentForm, setRecentForm] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProfile() }, [playerId])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: p } = await supabase.from('players').select('*').eq('id', playerId).single()
      setPlayer(p)

      // Totais de carreira
      const { data: allStats } = await supabase.from('match_stats')
        .select('goals, assists, motm, present').eq('player_id', playerId)

      const totals = (allStats || []).reduce((acc, s) => ({
        totalGoals: acc.totalGoals + (s.goals || 0),
        totalAssists: acc.totalAssists + (s.assists || 0),
        totalMotm: acc.totalMotm + (s.motm ? 1 : 0),
        totalPresences: acc.totalPresences + (s.present ? 1 : 0),
      }), { totalGoals: 0, totalAssists: 0, totalMotm: 0, totalPresences: 0 })
      setStats(totals)

      // Ultimos 5 rachas (recent form)
      const { data: recent } = await supabase.from('match_stats')
        .select('goals, assists, motm, match_id, matches(date, status)')
        .eq('player_id', playerId)
        .order('match_id', { ascending: false })

      if (recent) {
        const withDate = recent
          .filter(r => r.matches?.status === 'finished')
          .sort((a, b) => new Date(b.matches.date) - new Date(a.matches.date))
          .slice(0, 5)
        setRecentForm(withDate)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-16">
        <img src="/logo.png" alt="" className="w-16 h-16 rounded-full mx-auto mb-3 animate-pulse" />
        <p className="text-on-surface-variant">Carregando perfil...</p>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="text-center py-16">
        <p className="text-on-surface-variant">Jogador nao encontrado.</p>
      </div>
    )
  }

  const overall = player.overall || 70
  const pos = player.position ? POSITION_LABELS[player.position] : 'JOG'
  const posFull = player.position ? POSITION_NAMES[player.position] : 'Sem posicao'
  const flag = FLAG_EMOJI[player.nationality] || FLAG_EMOJI.BR
  const displayName = player.nickname || player.name
  const surname = displayName.split(' ').pop().toUpperCase()

  // Cor do overall
  const overallColor = overall >= 85 ? 'text-primary-container' : overall >= 75 ? 'text-tertiary-container' : overall >= 65 ? 'text-secondary-fixed' : 'text-on-surface'

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-white transition text-sm">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight">Perfil do Jogador</h2>
        <p className="text-on-surface-variant text-sm mt-1">Metricas detalhadas e historico de partidas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ============ FIFA CARD ============ */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden border border-primary-container/30 bg-gradient-to-b from-primary-container/15 via-primary-container/5 to-surface/80 p-6 shadow-[0_0_50px_rgba(212,175,55,0.15)]">
            {/* Background decorativo */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary-container rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-primary-container rounded-full blur-3xl"></div>
            </div>

            <div className="relative">
              {/* Topo: overall + posicao + bandeira */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className={`text-7xl font-black ${overallColor} tabular-nums leading-none`}>{overall}</p>
                  <p className="text-sm font-bold text-primary-container tracking-wider mt-1">{pos}</p>
                </div>
                <div className="text-3xl">{flag}</div>
              </div>

              {/* Foto */}
              <div className="flex justify-center my-6">
                <div className="relative">
                  <div className="w-44 h-44 rounded-full border-[3px] border-primary-container overflow-hidden bg-surface-container-high shadow-[0_0_40px_rgba(212,175,55,0.35)]">
                    {player.photo_url ? (
                      <img src={player.photo_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl font-black text-on-surface-variant">
                        {displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nome */}
              <div className="text-center pb-4 border-b border-primary-container/30 mb-6">
                <p className="text-3xl font-black text-white tracking-widest">{surname}</p>
                {player.shirt_number && (
                  <p className="text-sm text-on-surface-variant mt-1 tabular-nums">CAMISA #{player.shirt_number}</p>
                )}
              </div>

              {/* Stats FIFA 3x2 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <StatRow value={player.pace || 70} label="PAC" />
                <StatRow value={player.dribbling || 70} label="DRI" />
                <StatRow value={player.shooting || 70} label="SHO" />
                <StatRow value={player.defending || 70} label="DEF" />
                <StatRow value={player.passing || 70} label="PAS" />
                <StatRow value={player.physical || 70} label="PHY" />
              </div>
            </div>
          </div>

          {/* Nome real abaixo */}
          <div className="mt-4 text-center">
            <p className="text-lg font-bold text-white">{player.name}</p>
            <p className="text-sm text-on-surface-variant">{posFull}</p>
          </div>
        </div>

        {/* ============ COLUNA DIREITA ============ */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          {/* Stats gerais */}
          <div className="grid grid-cols-3 gap-3 lg:gap-4">
            <BigStatCard icon={Target} value={stats.totalGoals} label="Gols" color="primary-container" />
            <BigStatCard icon={Handshake} value={stats.totalAssists} label="Assistencias" color="tertiary-container" />
            <BigStatCard icon={Star} value={stats.totalMotm} label="MOTM" color="secondary-fixed" />
          </div>

          {/* Presencas + ratio */}
          <div className="glass-card p-5 lg:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="label-caps">Total de Partidas</p>
                <p className="text-3xl font-extrabold text-white mt-1 tabular-nums">{stats.totalPresences}</p>
              </div>
              {stats.totalPresences > 0 && (
                <div className="text-right">
                  <p className="label-caps">Media Gols / Partida</p>
                  <p className="text-2xl font-bold text-primary-container mt-1 tabular-nums">
                    {(stats.totalGoals / stats.totalPresences).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Form */}
          <div className="glass-card p-5 lg:p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Award size={18} className="text-primary-container" /> Ultimos Rachas
            </h3>
            {recentForm.length === 0 ? (
              <p className="text-on-surface-variant text-sm">Sem rachas finalizados ainda.</p>
            ) : (
              <div className="space-y-2">
                {recentForm.map((r, i) => (
                  <RecentFormRow key={i} row={r} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatRow({ value, label }) {
  const color = value >= 85 ? 'text-primary-container' : value >= 75 ? 'text-white' : value >= 65 ? 'text-on-surface' : 'text-on-surface-variant'
  return (
    <div className="flex items-center gap-3">
      <span className={`text-2xl font-black ${color} tabular-nums w-10`}>{value}</span>
      <span className="text-xs font-bold text-on-surface-variant tracking-widest">{label}</span>
    </div>
  )
}

function BigStatCard({ icon: Icon, value, label, color }) {
  return (
    <div className="glass-card p-4 lg:p-5 text-center relative overflow-hidden">
      <Icon size={20} className={`text-${color}/40 absolute top-3 right-3`} />
      <p className="text-3xl lg:text-4xl font-extrabold text-white tabular-nums">{value}</p>
      <p className="label-caps mt-1">{label}</p>
    </div>
  )
}

function RecentFormRow({ row }) {
  const d = new Date(row.matches.date + 'T12:00:00')
  const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')

  const goals = row.goals || 0
  const assists = row.assists || 0
  const isGood = goals >= 2 || (goals >= 1 && assists >= 1) || row.motm
  const isOk = goals >= 1 || assists >= 1
  const Icon = isGood ? TrendingUp : isOk ? Minus : TrendingDown
  const badgeColor = isGood
    ? 'bg-secondary-container/15 text-secondary-fixed border-secondary-container/30'
    : isOk
    ? 'bg-primary-container/15 text-primary-container border-primary-container/30'
    : 'bg-white/5 text-on-surface-variant border-white/10'
  const label = isGood ? 'B' : isOk ? 'OK' : '—'

  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-bold ${badgeColor}`}>
        {label}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">Racha {dateStr}</p>
        <p className="text-xs text-on-surface-variant">
          {goals > 0 && `${goals} gol${goals !== 1 ? 's' : ''}`}
          {goals > 0 && assists > 0 && ' • '}
          {assists > 0 && `${assists} assist.`}
          {goals === 0 && assists === 0 && 'Sem G/A'}
          {row.motm && ' • MOTM'}
        </p>
      </div>
      <Icon size={18} className={isGood ? 'text-secondary-fixed' : isOk ? 'text-primary-container' : 'text-on-surface-variant'} />
    </div>
  )
}
