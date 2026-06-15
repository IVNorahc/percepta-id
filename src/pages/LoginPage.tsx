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
    <div className="min-h-screen bg-nuit text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in">
        <Link to="/" className="block text-center text-xl font-display font-bold tracking-tight mb-8">
          Percepta <span className="text-accent">ID</span>
        </Link>
        <div className="rounded-xl border border-white/10 bg-ardoise p-8 shadow-lg">
          <h1 className="text-lg font-display font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-slate-400">Accédez à votre espace de gestion des accès.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm text-slate-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm text-slate-300">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
            >
              {submitting ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
