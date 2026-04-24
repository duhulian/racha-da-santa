import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Shield, Mail, Lock, ArrowRight } from 'lucide-react'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError('Email ou senha incorretos')
    else onLogin()
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-8">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-container/10 rounded-full blur-3xl"></div>

          <div className="text-center mb-8 relative">
            <div className="w-14 h-14 rounded-xl bg-primary-container/10 border border-primary-container/30 flex items-center justify-center mx-auto mb-4">
              <Shield size={26} className="text-primary-container" />
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Painel Admin</h2>
            <p className="text-on-surface-variant text-sm mt-1">Acesso restrito a administradores</p>
          </div>

          {error && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4 relative">
            <div>
              <label className="label-caps mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-base pl-9"
                  placeholder="admin@email.com" />
              </div>
            </div>

            <div>
              <label className="label-caps mb-1.5 block">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="input-base pl-9"
                  placeholder="Sua senha"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading || !email || !password}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 mt-6">
              {loading ? 'Aguarde...' : <>Entrar <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
