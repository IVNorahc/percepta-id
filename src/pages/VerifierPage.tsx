import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../lib/settings'
import { formatDurationH } from '../lib/alerts'
import QrScanner from '../components/QrScanner'

interface VerifiedLog {
  id: string
  fullName: string
  firstName: string | null
  idNumber: string
  typePiece: string | null
  zone: string
  checkedInAt: string
  checkedOutAt: string | null
  checkoutStatus: 'present' | 'departed'
  photoUrl: string | null
}

type Mode = 'scanning' | 'loading' | 'result' | 'notfound' | 'error'

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

export default function VerifierPage() {
  const { settings } = useSettings()
  const [mode, setMode] = useState<Mode>('scanning')
  const [result, setResult] = useState<VerifiedLog | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const handleScan = useCallback(async (text: string) => {
    setMode('loading')
    const logId = text.trim()
    const { data, error } = await supabase
      .from('access_logs')
      .select(
        'id, full_name, first_name, id_number, type_piece, zone, checked_in_at, checked_out_at, checkout_status, photo_url',
      )
      .eq('id', logId)
      .maybeSingle()

    if (error || !data) {
      setResult(null)
      setMode('notfound')
      return
    }
    setResult({
      id: data.id,
      fullName: data.full_name,
      firstName: data.first_name ?? null,
      idNumber: data.id_number,
      typePiece: data.type_piece ?? null,
      zone: data.zone,
      checkedInAt: data.checked_in_at,
      checkedOutAt: data.checked_out_at ?? null,
      checkoutStatus: data.checkout_status ?? (data.checked_out_at ? 'departed' : 'present'),
      photoUrl: data.photo_url ?? null,
    })
    setMode('result')
  }, [])

  const handleCheckout = async () => {
    if (!result) return
    setCheckingOut(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('access_logs')
      .update({ checked_out_at: now, checkout_status: 'departed' })
      .eq('id', result.id)
    if (!error) {
      setResult((r) => (r ? { ...r, checkedOutAt: now, checkoutStatus: 'departed' } : r))
    }
    setCheckingOut(false)
  }

  const rescan = () => {
    setResult(null)
    setMode('scanning')
  }

  const displayName = (r: VerifiedLog) =>
    r.firstName ? `${r.firstName} ${r.fullName}` : r.fullName

  // Statut visuel
  const statusInfo = (() => {
    if (!result) return null
    if (result.checkoutStatus === 'departed') {
      return { label: '❌ SORTI', cls: 'bg-red-500/15 text-red-400 border-red-500/40' }
    }
    const h = hoursSince(result.checkedInAt)
    if (h >= settings.thresholdWarningH) {
      return { label: '⚠️ ALERTE', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/40' }
    }
    return { label: '✅ SUR SITE', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' }
  })()

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Vérification de badge visiteur</h1>
        <p className="mt-1 text-sm text-slate-400">
          Scannez le QR code d'un badge pour vérifier l'accès en temps réel.
        </p>
      </div>

      {/* ── Scanner ─────────────────────────────────────────────────────── */}
      {mode === 'scanning' && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
            <QrScanner onScan={handleScan} onError={() => setMode('error')} />
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">
            Placez le QR code du badge dans le cadre…
          </p>
        </div>
      )}

      {/* ── Chargement ──────────────────────────────────────────────────── */}
      {mode === 'loading' && (
        <div className="mt-10 flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
          <p className="text-sm text-slate-400">Vérification…</p>
        </div>
      )}

      {/* ── Badge introuvable ───────────────────────────────────────────── */}
      {mode === 'notfound' && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl">
            ❌
          </div>
          <p className="mt-3 font-display font-semibold text-red-400">Badge introuvable</p>
          <p className="mt-1 text-sm text-slate-500">
            Ce QR code ne correspond à aucune entrée de votre entreprise.
          </p>
          <button
            onClick={rescan}
            className="mt-6 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors"
          >
            Scanner un autre badge
          </button>
        </div>
      )}

      {/* ── Erreur caméra ───────────────────────────────────────────────── */}
      {mode === 'error' && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-ardoise p-8 text-center shadow-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">
            📷
          </div>
          <p className="mt-3 font-display font-semibold text-white">Caméra inaccessible</p>
          <p className="mt-1 text-sm text-slate-500">
            Autorisez l'accès à la caméra dans votre navigateur, puis réessayez.
          </p>
          <button
            onClick={rescan}
            className="mt-6 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ── Résultat ────────────────────────────────────────────────────── */}
      {mode === 'result' && result && statusInfo && (
        <div className="mt-6 space-y-5">
          {/* Bandeau statut */}
          <div className={`rounded-2xl border p-5 text-center shadow-card ${statusInfo.cls}`}>
            <p className="font-display text-2xl font-bold tracking-tight">{statusInfo.label}</p>
            {result.checkoutStatus === 'present' && (
              <p className="mt-1 text-sm opacity-80">
                Présence : {formatDurationH(hoursSince(result.checkedInAt))}
              </p>
            )}
          </div>

          {/* Carte identité */}
          <div className="rounded-2xl border border-white/10 bg-ardoise p-5 shadow-card">
            <div className="flex gap-4">
              {result.photoUrl ? (
                <img
                  src={result.photoUrl}
                  alt=""
                  className="h-28 w-24 shrink-0 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-28 w-24 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-nuit text-4xl text-slate-600">
                  👤
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-white">{displayName(result)}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{result.idNumber}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-block rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                    {result.zone}
                  </span>
                  <span className="inline-block rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {result.typePiece ?? 'CNI'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
              <div>
                <p className="text-xs text-slate-500">Heure d'entrée</p>
                <p className="mt-0.5 text-white">
                  {new Date(result.checkedInAt).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">
                  {result.checkoutStatus === 'departed' ? 'Heure de sortie' : 'Durée de présence'}
                </p>
                <p className="mt-0.5 text-white">
                  {result.checkoutStatus === 'departed' && result.checkedOutAt
                    ? new Date(result.checkedOutAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : formatDurationH(hoursSince(result.checkedInAt))}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row">
            {result.checkoutStatus === 'present' && (
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="flex-1 rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors disabled:opacity-50"
              >
                {checkingOut ? 'Enregistrement…' : 'Enregistrer la sortie'}
              </button>
            )}
            <button
              onClick={rescan}
              className="flex-1 rounded-lg border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:border-accent hover:text-accent transition-colors"
            >
              Scanner un autre badge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
