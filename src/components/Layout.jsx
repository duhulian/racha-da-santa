import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { Home, Calendar, Trophy, Shield, User } from 'lucide-react'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const tabs = [
    { path: '/', icon: Home, label: 'Inicio' },
    { path: '/racha', icon: Calendar, label: 'Racha' },
    { path: '/rankings', icon: Trophy, label: 'Rankings' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
    { path: '/perfil', icon: User, label: 'Perfil' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <span className="text-2xl">⚽</span>
          <h1 className="text-lg font-bold text-white">Racha Da Santa</h1>
        </div>
      </header>

      {/* Conteudo */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {children}
      </main>

      {/* Navegacao inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex-1 flex flex-col items-center py-2 pt-3 transition ${
                  isActive ? 'text-green-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
