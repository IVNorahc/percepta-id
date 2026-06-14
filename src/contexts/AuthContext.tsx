import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface RegisterDetails {
  companyName: string
  sector: string
  phone: string
}

export interface UserProfile {
  id: string
  email: string | null
  company_id: string | null
  role: 'admin' | 'manager' | 'agent'
  is_active: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  companyId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, details: RegisterDetails) => Promise<{ error: string | null; hasSession: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  // Charger le profil (company_id, rôle) dès qu'une session est disponible.
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) {
      setProfile(null)
      return
    }
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, email, company_id, role, is_active')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (!cancelled) setProfile((data as UserProfile) ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp: AuthContextValue['signUp'] = async (email, password, details) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          company_name: details.companyName,
          sector: details.sector,
          phone: details.phone,
        },
      },
    })
    if (!error && data.user) {
      // Fire-and-forget: email failure must never block signup
      supabase.functions
        .invoke('send-welcome-percepta', { body: { email, companyName: details.companyName } })
        .catch(() => {})
    }
    return { error: error?.message ?? null, hasSession: !!data.session }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        companyId: profile?.company_id ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
