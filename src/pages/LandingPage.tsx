import { useState, type FormEvent, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FEATURES = [
  {
    icon: '📷',
    title: 'Scan CNI / Passeport',
    description:
      "Identification instantanée par reconnaissance optique. Zéro saisie manuelle, zéro erreur d'identité.",
  },
  {
    icon: '🏭',
    title: 'Gestion des zones',
    description:
      "Contrôle d'accès par zone avec alertes automatiques pour les périmètres à risque.",
  },
  {
    icon: '⚠️',
    title: 'Alertes temps réel',
    description:
      'Détection automatique : dépassement de durée de présence, accès en zone dangereuse.',
  },
  {
    icon: '📊',
    title: 'Rapports automatiques',
    description:
      'Exports PDF et Excel à la demande. Analyse par période, par zone, par catégorie de personnel.',
  },
  {
    icon: '🎫',
    title: 'Badge numérique',
    description:
      'QR code unique généré pour chaque visiteur, vérifiable instantanément par le personnel de sécurité.',
  },
  {
    icon: '🔒',
    title: 'Conformité légale',
    description:
      'Registre électronique conforme au Code minier sénégalais. Données chiffrées et auditables.',
  },
]

const BEFORE = [
  'Registres papier perdus ou illisibles',
  'Erreurs fréquentes de saisie manuelle',
  "Aucune traçabilité en cas d'incident",
  'Rapports chronophages à produire manuellement',
  'Impossible de vérifier une présence en temps réel',
]

const AFTER = [
  'Scan automatique en moins de 5 secondes',
  'Identification fiable par reconnaissance optique',
  'Historique complet et horodaté de chaque accès',
  'Rapports générés en un clic, exportables',
  'Vue en direct de tout le personnel présent sur site',
]

const CERTS = [
  {
    code: 'Code minier',
    label: 'Registre conforme au Code minier sénégalais (loi n° 2016-32)',
  },
  {
    code: 'ITIE',
    label: 'Initiative pour la Transparence des Industries Extractives',
  },
  {
    code: 'ISO 45001',
    label: 'Management de la santé et sécurité au travail',
  },
  {
    code: 'OHSAS',
    label: 'Occupational Health & Safety Assessment Series',
  },
]

type FormState = 'idle' | 'sending' | 'sent' | 'error'

interface FormData {
  name: string
  company: string
  email: string
  phone: string
  message: string
}

const EMPTY_FORM: FormData = { name: '', company: '', email: '', phone: '', message: '' }

export default function LandingPage() {
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [formState, setFormState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const set =
    (key: keyof FormData) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormState('sending')
    setErrorMsg('')
    try {
      const { error } = await supabase.functions.invoke('send-contact', { body: form })
      if (error) throw new Error(error.message)
      setFormState('sent')
      setForm(EMPTY_FORM)
    } catch {
      setErrorMsg(
        'Une erreur est survenue. Merci de réessayer ou de nous contacter directement par email.',
      )
      setFormState('error')
    }
  }

  return (
    <div className="min-h-screen bg-nuit text-white scroll-smooth">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ardoise/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-semibold tracking-tight">
            Percepta <span className="text-accent">ID</span>
          </span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <a href="#fonctionnalites" className="hover:text-white transition-colors">
              Fonctionnalités
            </a>
            <a href="#conformite" className="hover:text-white transition-colors">
              Conformité
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="hidden sm:inline text-sm text-slate-300 hover:text-accent transition-colors px-3 py-2"
            >
              Connexion
            </Link>
            <a
              href="#contact"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-sombre transition-colors"
            >
              Demander une démo
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-accent/8 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 sm:py-32 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent tracking-wide mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Solution dédiée aux industries extractives
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            Percepta ID — Sécurisez et gérez
            <br />
            <span className="text-accent">les accès de votre site</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            Solution numérique de contrôle d'accès et de gestion du personnel, spécialement
            pensée pour les industries extractives. Du scan CNI aux rapports automatisés, en
            passant par les alertes temps réel.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#contact"
              className="w-full sm:w-auto rounded-lg bg-accent px-8 py-4 text-base font-semibold text-white hover:bg-accent-sombre transition-colors text-center"
            >
              Demander une démo gratuite
            </a>
            <Link
              to="/login"
              className="w-full sm:w-auto rounded-lg border border-white/20 px-8 py-4 text-base font-semibold text-white hover:border-accent hover:text-accent transition-colors text-center"
            >
              Accéder à la plateforme
            </Link>
          </div>
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Conforme Code minier sénégalais
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Données chiffrées et sécurisées
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Accessible depuis mobile et tablette
            </span>
            <span className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Support technique inclus
            </span>
          </div>
        </div>
      </section>

      {/* ── Problème / Solution ───────────────────────────────────────── */}
      <section className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Fini les registres papier</h2>
            <p className="mt-3 text-lg text-slate-400">
              Percepta ID transforme la gestion des accès sur vos sites extractifs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden border border-white/10">
            <div className="bg-red-500/5 border-b md:border-b-0 md:border-r border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="rounded-full bg-red-500/20 w-9 h-9 flex items-center justify-center text-red-400 font-bold">
                  ✗
                </span>
                <h3 className="text-lg font-semibold text-red-400">Sans Percepta ID</h3>
              </div>
              <ul className="space-y-4">
                {BEFORE.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-400 text-sm">
                    <span className="mt-0.5 shrink-0 text-red-500 font-bold">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-accent/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="rounded-full bg-accent/20 w-9 h-9 flex items-center justify-center text-accent font-bold">
                  ✓
                </span>
                <h3 className="text-lg font-semibold text-accent">Avec Percepta ID</h3>
              </div>
              <ul className="space-y-4">
                {AFTER.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-300 text-sm">
                    <span className="mt-0.5 shrink-0 text-accent font-bold">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ───────────────────────────────────────────── */}
      <section id="fonctionnalites" className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Tout ce dont vous avez besoin</h2>
            <p className="mt-3 text-lg text-slate-400">
              Six fonctionnalités clés pour sécuriser et optimiser votre site
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="group rounded-xl border border-white/10 bg-ardoise p-6 hover:border-accent/40 hover:bg-accent/5 transition-all duration-200"
              >
                <div className="text-3xl mb-4">{feat.icon}</div>
                <h3 className="font-semibold text-white group-hover:text-accent transition-colors">
                  {feat.title}
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Conformité légale ─────────────────────────────────────────── */}
      <section id="conformite" className="border-t border-white/10 bg-ardoise">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <span className="inline-block rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-400 tracking-wide mb-4">
              Conformité réglementaire
            </span>
            <h2 className="text-3xl font-bold tracking-tight">
              Conçu pour les exigences du secteur minier
            </h2>
            <p className="mt-3 text-lg text-slate-400 max-w-2xl mx-auto">
              Percepta ID répond aux exigences légales et normatives des industries extractives au
              Sénégal et en Afrique de l'Ouest.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CERTS.map((cert) => (
              <div
                key={cert.code}
                className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center hover:border-green-500/40 transition-colors"
              >
                <div className="text-xl font-bold text-green-400 mb-3">{cert.code}</div>
                <p className="text-xs text-slate-400 leading-relaxed">{cert.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Formulaire de contact ─────────────────────────────────────── */}
      <section id="contact" className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Demander une démo</h2>
            <p className="mt-3 text-lg text-slate-400">
              Notre équipe vous contacte sous 24 h pour organiser une démonstration personnalisée
              sur votre site.
            </p>
          </div>

          {formState === 'sent' ? (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-12 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-green-400">Message envoyé !</h3>
              <p className="mt-2 text-slate-400">
                Nous reviendrons vers vous dans les 24 heures.
              </p>
              <button
                onClick={() => setFormState('idle')}
                className="mt-6 text-sm text-accent hover:underline"
              >
                Envoyer un autre message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Nom complet <span className="text-accent">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={set('name')}
                    placeholder="ex. Mamadou Diallo"
                    className="w-full rounded-lg border border-white/10 bg-ardoise px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Entreprise
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={set('company')}
                    placeholder="ex. Sabodala Gold Operations"
                    className="w-full rounded-lg border border-white/10 bg-ardoise px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email <span className="text-accent">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={set('email')}
                    placeholder="vous@entreprise.com"
                    className="w-full rounded-lg border border-white/10 bg-ardoise px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+221 77 000 00 00"
                    className="w-full rounded-lg border border-white/10 bg-ardoise px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Message <span className="text-accent">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={set('message')}
                  placeholder="Décrivez votre site, le nombre de personnes à gérer, vos questions..."
                  className="w-full rounded-lg border border-white/10 bg-ardoise px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>
              {formState === 'error' && (
                <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3">
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={formState === 'sending'}
                className="w-full rounded-lg bg-accent py-4 text-base font-semibold text-white hover:bg-accent-sombre transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {formState === 'sending' ? 'Envoi en cours…' : 'Envoyer la demande'}
              </button>
              <p className="text-xs text-center text-slate-500">
                Vous pouvez aussi nous écrire directement à{' '}
                <a href="mailto:perceptasn@gmail.com" className="text-accent hover:underline">
                  perceptasn@gmail.com
                </a>
              </p>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-ardoise">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-lg font-semibold tracking-tight">
              Percepta <span className="text-accent">ID</span>
            </span>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-sm text-slate-400">
              <a
                href="mailto:perceptasn@gmail.com"
                className="hover:text-accent transition-colors"
              >
                perceptasn@gmail.com
              </a>
              <span className="hidden sm:inline text-white/20">·</span>
              <a href="tel:+221711279503" className="hover:text-accent transition-colors">
                +221 71 127 95 03
              </a>
              <span className="hidden sm:inline text-white/20">·</span>
              <Link to="/login" className="hover:text-accent transition-colors">
                Connexion
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10 text-center text-xs text-slate-600">
            © 2026 Percepta — Solution de contrôle d'accès pour les industries extractives
          </div>
        </div>
      </footer>
    </div>
  )
}
