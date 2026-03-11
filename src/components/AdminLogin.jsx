import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield } from 'lucide-react'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setError('')
    setSuccess('')
    setLoading(true)

    if (isSignUp) {
      // Cadastro do primeiro admin
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password })
      if (authErr) {
        setError(authErr.message)
        setLoading(false)
        return
      }

      // Verificar se ja existe algum jogador (se nao, sera admin)
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true })

      if (count > 0) {
        setError('Ja existe um admin cadastrado. Peca para ele te promover.')
        setLoading(false)
        return
      }

      // Criar perfil admin
      await supabase.from('players').insert({
        user_id: authData.user.id,
        name: name.trim(),
        role: 'admin',
        player_type: 'mensalista'
      })

      setSuccess('Conta admin criada! Fazendo login...')
      // Fazer login automatico
      await supabase.auth.signInWithPassword({ email, password })
      onLogin()
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError('Email ou senha incorretos')
      } else {
        onLogin()
      }
    }
    setLoading(false)
  }

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <Shield size={28} className="text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white">Area do Admin</h2>
        <p className="text-slate-400 text-sm mt-1">
          {isSignUp ? 'Crie a conta do administrador' : 'Acesso restrito para administradores'}
        </p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-5 space-y-4">
        {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg text-sm">{success}</div>}

        {isSignUp && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Seu nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Ex: Eduardo"
            />
          </div>
        )}

        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
            placeholder="admin@email.com"
          />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Minimo 6 caracteres"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password || (isSignUp && !name)}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'Aguarde...' : isSignUp ? 'Criar conta Admin' : 'Entrar'}
        </button>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
          className="w-full text-slate-400 text-sm hover:text-white transition"
        >
          {isSignUp ? 'Ja tem conta? Entre aqui' : 'Primeiro acesso? Cadastre-se'}
        </button>
      </div>
    </div>
  )
}
