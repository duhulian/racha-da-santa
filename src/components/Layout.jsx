import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import { LayoutDashboard, Trophy, Users, Shield, LogOut, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAdmin, session } = useAuth()

  const isConfirmPage = location.pathname.startsWith('/confirmar/')
  const isLoginPage = location.pathname === '/admin/login'
  const hideNav = isConfirmPage || isLoginPage

  const tabs = [
    { path: '/', icon: LayoutDashboard, label: 'Inicio' },
    { path: '/rachas', icon: Calendar, label: 'Rachas' },
    { path: '/rankings', icon: Trophy, label: 'Rankings' },
    { path: '/jogadores', icon: Users, label: 'Elenco' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/')
  }

  function isTabActive(tabPath) {
    if (tabPath === '/') return location.pathname === '/'
    if (tabPath === '/rachas') return location.pathname.startsWith('/rachas') || location.pathname.startsWith('/racha/')
    return location.pathname.startsWith(tabPath)
  }

  // Paginas sem navegacao (Confirm / Login) ocupam tela cheia
  if (hideNav) {
    return (
      <div className="min-h-screen bg-background text-on-surface">
        {/* Header minimalista para Confirm e Login */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-3xl mx-auto px-4 md:px-8 h-14 flex items-center justify-center">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
              <img src="/logo.png" alt="" className="w-9 h-9 rounded-full border border-primary-container/50" />
              <h1 className="text-base font-bold text-primary-container tracking-wide">RACHA DA SANTA</h1>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 md:px-8 py-6">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      {/* ============ SIDEBAR DESKTOP (lg+) ============ */}
      <nav className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-surface/60 backdrop-blur-2xl border-r border-white/5 z-40">
        {/* Brand */}
        <div className="px-6 pt-8 pb-6 text-center border-b border-white/5">
          <img src="/logo.png" alt=""
            className="w-20 h-20 mx-auto mb-3 rounded-full border-2 border-primary-container/40 cursor-pointer"
            onClick={() => navigate('/')} />
          <h1 className="text-base font-black tracking-wider text-primary-container uppercase">RACHA DA SANTA</h1>
          <p className="text-[11px] text-on-surface-variant mt-1 tracking-wider uppercase">Elite Tactical Tool</p>
        </div>

        {/* Menu */}
        <ul className="flex-1 py-4">
          {tabs.map(tab => {
            const active = isTabActive(tab.path)
            const Icon = tab.icon
            return (
              <li key={tab.path}>
                <button onClick={() => navigate(tab.path)}
                  className={`w-full flex items-center px-6 py-3.5 transition-colors relative text-sm font-semibold ${
                    active
                      ? 'text-primary-container bg-white/5'
                      : 'text-on-surface-variant hover:text-white hover:bg-white/[0.03]'
                  }`}>
                  {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary-container"></span>}
                  <Icon size={20} className="mr-3" />
                  {tab.label}
                </button>
              </li>
            )
          })}
        </ul>

        {/* Rodape da sidebar */}
        <div className="p-4 border-t border-white/5">
          {isAdmin && session ? (
            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition">
              <LogOut size={16} /> Sair
            </button>
          ) : (
            !isAdmin && !session && (
              <button onClick={() => navigate('/admin/login')}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border border-primary-container/40 text-primary-container hover:bg-primary-container/10 rounded-lg transition">
                <Shield size={16} /> Admin
              </button>
            )
          )}
        </div>
      </nav>

      {/* ============ HEADER MOBILE (< lg) ============ */}
      <header className="lg:hidden sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img src="/logo.png" alt="" className="w-9 h-9 rounded-full border border-primary-container/50" />
            <h1 className="text-base font-bold text-primary-container tracking-wide">RACHA DA SANTA</h1>
          </div>
          {isAdmin && session ? (
            <button onClick={handleLogout}
              className="text-on-surface-variant hover:text-error p-2 transition" title="Sair">
              <LogOut size={18} />
            </button>
          ) : (
            !isAdmin && !session && (
              <button onClick={() => navigate('/admin/login')}
                className="text-[11px] font-bold uppercase tracking-wider border border-primary-container/50 text-primary-container px-3 py-1.5 rounded-lg hover:bg-primary-container/10 transition">
                Admin
              </button>
            )
          )}
        </div>
      </header>

      {/* ============ CONTEUDO PRINCIPAL ============ */}
      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-8 pt-4 md:pt-6 px-4 md:px-8">
        <div className="max-w-[1280px] mx-auto">
          {children}
        </div>
      </main>

      {/* ============ BOTTOM NAV MOBILE (< lg) ============ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-white/5 pb-safe">
        <div className="flex">
          {tabs.map(tab => {
            const active = isTabActive(tab.path)
            const Icon = tab.icon
            return (
              <button key={tab.path} onClick={() => navigate(tab.path)}
                className={`flex-1 flex flex-col items-center py-2.5 transition ${
                  active ? 'text-primary-container' : 'text-on-surface-variant/60 hover:text-on-surface-variant'
                }`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-0.5 uppercase tracking-wider">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
