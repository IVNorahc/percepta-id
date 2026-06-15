import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-nuit text-white flex flex-col items-center justify-center px-6 text-center">
      {/* Marque */}
      <span className="text-2xl font-display font-bold tracking-tight mb-10">
        Percepta&nbsp;<span className="text-accent">ID</span>
      </span>

      {/* Code 404 */}
      <p className="font-display font-extrabold leading-none text-accent/90 text-[5.5rem] sm:text-[8rem]">
        404
      </p>

      <h1 className="mt-2 text-xl sm:text-2xl font-display font-bold text-white">
        Page introuvable
      </h1>
      <p className="mt-3 max-w-md text-sm sm:text-base text-slate-400 leading-relaxed">
        La page que vous recherchez n'existe pas ou a été déplacée. Vérifiez l'adresse
        ou revenez à votre tableau de bord.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent/90"
        >
          Retour au dashboard
        </Link>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-accent hover:text-accent"
        >
          Page d'accueil
        </Link>
      </div>
    </div>
  )
}
