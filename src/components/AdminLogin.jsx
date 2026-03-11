import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)

    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError('Email ou senha incorretos')
    } else {
      onLogin()
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="text-center mb-8">
        <img src="/logo.png" alt="" className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-gold-400/30" />
        <h2 className="text-xl font-bold text-white">Area do Admin</h2>
        <p className="text-slate-400 text-sm mt-1">Acesso restrito para administradores</p>
      </div>

      <div className="bg-navy-800 rounded-2xl p-5 space-y-4 border border-navy-700">
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm">{error}</div>}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-navy-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-gold-400"
            placeholder="admin@email.com" />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-navy-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-gold-400"
            placeholder="Sua senha"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
        </div>

        <button onClick={handleSubmit} disabled={loading || !email || !password}
          className="w-full bg-gold-400 hover:bg-gold-500 text-navy-900 font-bold py-3 rounded-lg transition disabled:opacity-50">
          {loading ? 'Aguarde...' : 'Entrar'}
        </button>
      </div>
    </div>
  )
}
