import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './components/Login'
import Layout from './components/Layout'
import Home from './components/Home'
import MatchDay from './components/MatchDay'
import Rankings from './components/Rankings'
import Admin from './components/Admin'
import Profile from './components/Profile'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export default function App() {
  const [session, setSession] = useState(null)
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadPlayer(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadPlayer(session.user.id)
      else {
        setPlayer(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadPlayer(userId) {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .single()
    setPlayer(data)
    setLoading(false)
  }

  async function refreshPlayer() {
    if (session) await loadPlayer(session.user.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="text-4xl mb-4">⚽</div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (!player) {
    return <Login session={session} onPlayerCreated={refreshPlayer} needsProfile />
  }

  return (
    <AuthContext.Provider value={{ session, player, refreshPlayer, isAdmin: player.role === 'admin' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/racha" element={<MatchDay />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/admin" element={player.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </AuthContext.Provider>
  )
}
