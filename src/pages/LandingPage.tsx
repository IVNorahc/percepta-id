import { Link } from 'react-router-dom'

const FEATURES = [
  {
    title: 'Contrôle d\'accès en temps réel',
    description: 'Suivez en direct qui entre et qui sort de vos sites, zone par zone.',
  },
  {
    title: 'Scan de pièces d\'identité',
    description: 'Enregistrez les visiteurs et le personnel en quelques secondes grâce à la reconnaissance de CNI.',
  },
  {
    title: 'Historique complet',
    description: 'Consultez l\'historique détaillé des accès de chaque personne enregistrée.',
  },
  {
    title: 'Rapports et statistiques',
    description: 'Exportez vos données en PDF ou Excel et analysez la fréquentation par période.',
  },
]

const SECTORS = [
  {
    title: 'Mines',
    description: 'Sécurisez l\'accès aux sites miniers et suivez les équipes sur le terrain.',
  },
  {
    title: 'Industrie',
    description: 'Gérez les flux de personnel et de prestataires sur vos sites industriels.',
  },
  {
    title: 'Sécurité',
    description: 'Renforcez le contrôle des accès et la traçabilité pour vos équipes de sécurité.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-noir text-white">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">
            Percepta <span className="text-or">ID</span>
          </span>
          <nav className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm text-gray-300 hover:text-or transition-colors"
            >
              Se connecter
            </Link>
            <Link
              to="/register"
              className="text-sm rounded-md bg-or px-4 py-2 font-medium text-noir hover:bg-or/90 transition-colors"
            >
              Demander une démo
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
          Percepta ID — Gestion intelligente des accès
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
          Sécurisez et gérez le personnel de votre site en temps réel
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            to="/register"
            className="rounded-md bg-or px-6 py-3 font-medium text-noir hover:bg-or/90 transition-colors"
          >
            Demander une démo
          </Link>
          <Link
            to="/login"
            className="rounded-md border border-white/20 px-6 py-3 font-medium text-white hover:border-or hover:text-or transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </section>

      <section id="fonctionnalites" className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-center">Fonctionnalités</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-white/10 p-6 hover:border-or/40 transition-colors">
                <h3 className="text-or font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="secteurs" className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-center">Secteurs</h2>
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {SECTORS.map((sector) => (
              <div key={sector.title} className="rounded-lg bg-white/5 p-6">
                <h3 className="text-lg font-medium text-or">{sector.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{sector.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Contact</h2>
          <p className="mt-3 text-gray-400">
            Une question ? Envie d'une démo personnalisée pour votre site ?
          </p>
          <a
            href="mailto:contact@percepta-id.sn"
            className="mt-6 inline-block rounded-md bg-or px-6 py-3 font-medium text-noir hover:bg-or/90 transition-colors"
          >
            contact@percepta-id.sn
          </a>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Percepta ID — Sénégal
        </div>
      </footer>
    </div>
  )
}
