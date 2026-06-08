import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError(signInError)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-noir text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="block text-center text-xl font-semibold tracking-tight mb-8">
          Percepta <span className="text-or">ID</span>
        </Link>
        <div className="rounded-lg border border-white/10 p-8">
          <h1 className="text-lg font-medium">Connexion</h1>
          <p className="mt-1 text-sm text-gray-400">Accédez à votre espace de gestion des accès.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-gray-300">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-or px-4 py-2 font-medium text-noir hover:bg-or/90 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-or hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
