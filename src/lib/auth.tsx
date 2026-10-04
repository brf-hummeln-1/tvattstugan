import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { ResidentWithApartment } from './types'

type AuthState = {
  session: Session | null
  resident: ResidentWithApartment | null
  loading: boolean
  refreshResident: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchResident(userId: string): Promise<ResidentWithApartment | null> {
  const { data } = await supabase
    .from('residents')
    .select('*, apartment:apartments(id, label)')
    .eq('id', userId)
    .maybeSingle()
  return (data as ResidentWithApartment | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [resident, setResident] = useState<ResidentWithApartment | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshResident = useCallback(async () => {
    const userId = session?.user.id
    if (!userId) {
      setResident(null)
      return
    }
    setResident(await fetchResident(userId))
  }, [session?.user.id])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (data.session) setResident(await fetchResident(data.session.user.id))
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setResident(null)
        return
      }
      // Hämta boende-raden utanför callbacken (rekommenderat av Supabase).
      setTimeout(() => {
        fetchResident(newSession.user.id).then((r) => active && setResident(r))
      }, 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, resident, loading, refreshResident, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth måste användas inom AuthProvider')
  return ctx
}
