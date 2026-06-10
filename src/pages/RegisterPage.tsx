import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const SECTORS = ['Mines', 'Industrie', 'Sécurité', 'Autre']

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [sector, setSector] = useState(SECTORS[0])
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signUpError, hasSession } = await signUp(email, password, { companyName, sector, phone })
    setSubmitting(false)
    if (signUpError) {
      setError(signUpError)
      return
    }
    if (hasSession) {
      navigate('/dashboard', { replace: true })
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-noir text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center text-xl font-semibold tracking-tight mb-8">
          Percepta <span className="text-or">ID</span>
        </Link>
        <div className="rounded-lg border border-white/10 p-8">
          <h1 className="text-lg font-medium">Créer un compte entreprise</h1>
          <p className="mt-1 text-sm text-gray-400">
            Renseignez les informations de votre entreprise pour démarrer.
          </p>

          {success ? (
            <p className="mt-6 text-sm text-or">
              Compte créé. Vérifiez votre email pour confirmer votre inscription.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-sm text-gray-300">
                  Nom de l'entreprise
                </label>
                <input
                  id="companyName"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
                />
              </div>

              <div>
                <label htmlFor="sector" className="block text-sm text-gray-300">
                  Secteur d'activité
                </label>
                <select
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
                >
                  {SECTORS.map((option) => (
                    <option key={option} value={option} className="bg-noir">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm text-gray-300">
                  Téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="+221 77 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
                />
              </div>

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
                  minLength={6}
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
                {submitting ? 'Création...' : 'Créer mon compte'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-or hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
