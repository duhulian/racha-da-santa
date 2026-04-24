import { useState, useEffect, createContext, useContext } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Home from './components/Home'
import Rankings from './components/Rankings'
import Confirm from './components/Confirm'
import AdminLogin from './components/AdminLogin'
import Admin from './components/Admin'
import Players from './components/Players'
import MatchList from './components/MatchList'
import MatchDetail from './components/MatchDetail'
import PlayerProfile from './components/PlayerProfile'

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

  const isAdmin = player?.role === 'admin'

  return (
    <AuthContext.Provider value={{ session, player, refreshPlayer, isAdmin, loading }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rankings" element={<Rankings />} />
          <Route path="/rachas" element={<MatchList />} />
          <Route path="/racha/:matchId" element={<MatchDetail />} />
          <Route path="/confirmar/:token" element={<Confirm />} />
          <Route path="/jogadores" element={<Players />} />
          <Route path="/jogador/:playerId" element={<PlayerProfile />} />
          <Route path="/admin/login" element={
            isAdmin ? <Navigate to="/admin" /> : <AdminLogin onLogin={refreshPlayer} />
          } />
          <Route path="/admin" element={
            loading ? <div className="text-center py-8 text-on-surface-variant">Carregando...</div> :
            isAdmin ? <Admin /> : <Navigate to="/admin/login" />
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </AuthContext.Provider>
  )
}
