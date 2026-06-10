import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')

    if (!code) {
      // No code parameter — redirect to login (expired link or direct navigation)
      navigate('/login', { replace: true })
      return
    }

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (exchangeError) {
          setError("Le lien de confirmation est invalide ou a expiré. Veuillez vous réinscrire ou demander un nouvel email.")
        } else {
          navigate('/dashboard', { replace: true })
        }
      })
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-noir flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <p className="text-red-400 text-sm">{error}</p>
          <a href="/login" className="text-or text-sm underline">
            Retour à la connexion
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-noir flex items-center justify-center">
      <p className="text-gray-400 text-sm">Confirmation en cours...</p>
    </div>
  )
}
