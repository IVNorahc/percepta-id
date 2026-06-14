import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Minimal type for the non-standard beforeinstallprompt event (Chrome/Android).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const IOS_HINT_DISMISSED = 'percepta_ios_install_dismissed'

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export default function PwaManager() {
  // ── Update indicator ────────────────────────────────────────────────────
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      // Check for a new version every hour while the app stays open.
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000)
      }
    },
  })

  // ── Install prompt ──────────────────────────────────────────────────────
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return

    // Android / Chrome: capture the install prompt.
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari never fires beforeinstallprompt → show manual instructions
    // (unless the user dismissed them before).
    if (isIos() && !localStorage.getItem(IOS_HINT_DISMISSED)) {
      setShowIosHint(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installEvent) return
    setInstalling(true)
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
    setInstalling(false)
  }

  const dismissIosHint = () => {
    localStorage.setItem(IOS_HINT_DISMISSED, '1')
    setShowIosHint(false)
  }

  return (
    <>
      {/* ── Update available toast ──────────────────────────────────────── */}
      {needRefresh && (
        <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-accent/30 bg-ardoise shadow-xl">
          <div className="flex items-center gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              ↻
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Nouvelle version disponible</p>
              <p className="text-xs text-slate-400">Rechargez pour mettre à jour Percepta ID.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-sombre transition-colors"
              >
                Recharger
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                aria-label="Ignorer"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Install banner (Android / Chrome) ───────────────────────────── */}
      {installEvent && (
        <div className="fixed bottom-4 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-white/10 bg-ardoise shadow-xl">
          <div className="flex items-center gap-3 p-4">
            <img src="/icon-192x192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Installer Percepta ID</p>
              <p className="text-xs text-slate-400">
                Accès rapide depuis votre écran d'accueil, même hors ligne.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
              >
                {installing ? '…' : 'Installer'}
              </button>
              <button
                onClick={() => setInstallEvent(null)}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Non
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Install hint (iOS Safari) ───────────────────────────────────── */}
      {showIosHint && (
        <div className="fixed bottom-4 left-1/2 z-[55] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-white/10 bg-ardoise shadow-xl">
          <div className="flex items-start gap-3 p-4">
            <img src="/icon-192x192.png" alt="" className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Installer Percepta ID</p>
              <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">
                Appuyez sur <span className="text-accent font-medium">Partager</span>{' '}
                <span aria-hidden>⎙</span> puis{' '}
                <span className="text-accent font-medium">« Sur l'écran d'accueil »</span>.
              </p>
            </div>
            <button
              onClick={dismissIosHint}
              className="shrink-0 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  )
}
