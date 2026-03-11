import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { Home, Trophy, Users, Shield, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, session } = useAuth()

  const isConfirmPage = location.pathname.startsWith('/confirmar/')

  const tabs = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/rankings', icon: Trophy, label: 'Rankings' },
    { path: '/jogadores', icon: Users, label: 'Elenco' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]

  return (
    <div className="min-h-screen bg-navy-900 pb-20">
      {/* Header */}
      <header className="bg-navy-800 border-b border-navy-700 px-4 py-2.5 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="Racha Da Santa" className="w-9 h-9 rounded-full object-cover" />
            <h1 className="text-lg font-bold text-white">Racha Da Santa</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && session && (
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  navigate('/')
                }}
                className="text-slate-500 hover:text-gold-400 p-1.5 transition"
                title="Sair do admin"
              >
                <LogOut size={18} />
              </button>
            )}
            {!isAdmin && !session && (
              <button
                onClick={() => navigate('/admin/login')}
                className="text-gold-400/70 hover:text-gold-400 text-xs font-semibold border border-gold-400/30 px-2.5 py-1 rounded-lg transition"
              >
                Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conteudo */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>

      {/* Navegacao inferior */}
      {!isConfirmPage && (
        <nav className="fixed bottom-0 left-0 right-0 bg-navy-800 border-t border-navy-700 z-50">
          <div className="max-w-lg mx-auto flex">
            {tabs.map((tab) => {
              const isActive = location.pathname === tab.path
              const Icon = tab.icon
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className={`flex-1 flex flex-col items-center py-2 pt-3 transition ${
                    isActive ? 'text-gold-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs mt-1">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
