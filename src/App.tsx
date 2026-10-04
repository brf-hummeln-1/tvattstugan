import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { hasSeenOnboarding } from './lib/device'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import { Login } from './pages/Login'
import { GetStarted } from './pages/GetStarted'
import { More } from './pages/More'
import { Admin } from './pages/Admin'
import { Book } from './pages/Book'
import { MyBooking } from './pages/MyBooking'
import { Info } from './pages/Info'
import { Chat } from './pages/Chat'

function Protected() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!hasSeenOnboarding() && location.pathname !== '/kom-igang') {
    return <Navigate to="/kom-igang" replace />
  }
  return (
    <Routes>
      <Route path="/kom-igang" element={<GetStarted />} />
      <Route element={<Layout />}>
        <Route index element={<Book />} />
        <Route path="/min-bokning" element={<MyBooking />} />
        <Route path="/chatt" element={<Chat />} />
        <Route path="/info" element={<Info />} />
        <Route path="/mer" element={<More />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Protected />
      </HashRouter>
    </AuthProvider>
  )
}
