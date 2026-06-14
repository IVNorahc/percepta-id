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
      navigate('/login', { replace: true })
    } else {
      setSuccess(true)
    }
  }

  return (
    <div className="min-h-screen bg-nuit text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-fade-in">
        <Link to="/" className="block text-center text-xl font-display font-bold tracking-tight mb-8">
          Percepta <span className="text-accent">ID</span>
        </Link>
        <div className="rounded-xl border border-white/10 bg-ardoise p-8 shadow-lg">
          <h1 className="text-lg font-display font-semibold">Créer un compte entreprise</h1>
          <p className="mt-1 text-sm text-slate-400">
            Renseignez les informations de votre entreprise pour démarrer.
          </p>

          {success ? (
            <p className="mt-6 text-sm text-accent">
              Compte créé. Vérifiez votre email pour confirmer votre inscription.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-sm text-slate-300">
                  Nom de l'entreprise
                </label>
                <input
                  id="companyName"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="sector" className="block text-sm text-slate-300">
                  Secteur d'activité
                </label>
                <select
                  id="sector"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
                >
                  {SECTORS.map((option) => (
                    <option key={option} value={option} className="bg-nuit">
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm text-slate-300">
                  Téléphone
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  placeholder="+221 77 000 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
                />
              </div>

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
                  minLength={6}
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
                {submitting ? 'Création...' : 'Créer mon compte'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-accent hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
