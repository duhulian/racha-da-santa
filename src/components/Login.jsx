import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ session, onPlayerCreated, needsProfile }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  // Se o usuario logou mas nao tem perfil de jogador
  if (needsProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">⚽</div>
            <h1 className="text-2xl font-bold text-white">Racha Da Santa</h1>
            <p className="text-slate-400 mt-2">Complete seu cadastro</p>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Seu nome completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Eduardo Silva"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Apelido (como te chamam no racha)</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Ex: Dudu"
                />
              </div>

              <button
                onClick={async () => {
                  if (!name.trim()) return setError('Preencha seu nome')
                  setLoading(true)
                  setError('')

                  // Verificar se e o primeiro jogador (sera admin)
                  const { count } = await supabase.from('players').select('*', { count: 'exact', head: true })
                  const role = count === 0 ? 'admin' : 'player'

                  const { error: err } = await supabase.from('players').insert({
                    user_id: session.user.id,
                    name: name.trim(),
                    nickname: nickname.trim() || null,
                    role
                  })

                  if (err) {
                    setError(err.message)
                    setLoading(false)
                  } else {
                    onPlayerCreated()
                  }
                }}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Entrar no Racha'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Conta criada! Verifique seu email para confirmar.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login')) setError('Email ou senha incorretos')
        else setError(error.message)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="text-2xl font-bold text-white">Racha Da Santa</h1>
          <p className="text-slate-400 mt-2">
            {isSignUp ? 'Crie sua conta para participar' : 'Entre na sua conta'}
          </p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl">
          {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4 text-sm">{error}</div>}
          {success && <div className="bg-green-500/20 text-green-300 p-3 rounded-lg mb-4 text-sm">{success}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-700 rounded-lg p-3 text-white outline-none focus:ring-2 focus:ring-green-500"
                placeholder="seu@email.com"
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
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Aguarde...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </button>

            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              className="w-full text-slate-400 text-sm hover:text-white transition"
            >
              {isSignUp ? 'Ja tem conta? Entre aqui' : 'Nao tem conta? Cadastre-se'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
