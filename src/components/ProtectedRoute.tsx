import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-nuit flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-accent animate-spin" />
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
