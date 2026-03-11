import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { User, LogOut, Save } from 'lucide-react'

export default function Profile() {
  const { player, session, refreshPlayer } = useAuth()
  const [name, setName] = useState(player.name)
  const [nickname, setNickname] = useState(player.nickname || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await supabase
      .from('players')
      .update({ name: name.trim(), nickname: nickname.trim() || null })
      .eq('id', player.id)
    await refreshPlayer()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User size={20} className="text-green-400" />
        <h2 className="text-lg font-bold text-white">Meu Perfil</h2>
      </div>

      <div className="bg-slate-800 rounded-2xl p-4 space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Nome completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Apelido</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Email</p>
          <p className="text-white text-sm">{session?.user?.email}</p>
        </div>

        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400">Nivel de acesso</p>
          <p className={`text-sm font-semibold ${player.role === 'admin' ? 'text-green-400' : 'text-slate-300'}`}>
            {player.role === 'admin' ? 'Administrador' : 'Jogador'}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save size={16} />
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alteracoes'}
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        <LogOut size={16} />
        Sair da conta
      </button>
    </div>
  )
}
