import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import QrScanner from '../components/QrScanner'
import StorageImage from '../components/StorageImage'

interface Emp {
  id: string
  nom: string
  prenoms: string
  poste: string | null
  photo_url: string | null
  statut: 'actif' | 'inactif'
}

type Mode = 'scanning' | 'loading' | 'found' | 'confirm' | 'notfound' | 'error'

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PointagePage() {
  const { companyId } = useAuth()
  const [mode, setMode] = useState<Mode>('scanning')
  const [emp, setEmp] = useState<Emp | null>(null)
  const [lastAction, setLastAction] = useState<{ type: 'entree' | 'sortie'; heure: string } | null>(null)
  const [nextType, setNextType] = useState<'entree' | 'sortie'>('entree')
  const [recording, setRecording] = useState(false)
  const [confirmed, setConfirmed] = useState<{ type: 'entree' | 'sortie'; heure: string } | null>(null)

  const handleScan = useCallback(async (text: string) => {
    setMode('loading')
    const code = text.trim()
    const { data: employee } = await supabase
      .from('employees')
      .select('id, nom, prenoms, poste, photo_url, statut')
      .eq('badge_qr_code', code)
      .maybeSingle()

    if (!employee) {
      setMode('notfound')
      return
    }
    // Dernier pointage pour déterminer l'action contextuelle
    const { data: last } = await supabase
      .from('pointages')
      .select('type, heure')
      .eq('employee_id', employee.id)
      .order('heure', { ascending: false })
      .limit(1)
      .maybeSingle()

    setEmp(employee as Emp)
    setLastAction(last ? { type: last.type, heure: last.heure } : null)
    setNextType(last?.type === 'entree' ? 'sortie' : 'entree')
    setMode('found')
  }, [])

  const record = async () => {
    if (!emp) return
    setRecording(true)
    const heure = new Date().toISOString()
    const { error } = await supabase.from('pointages').insert({
      employee_id: emp.id,
      company_id: companyId,
      type: nextType,
      heure,
    })
    setRecording(false)
    if (!error) {
      setConfirmed({ type: nextType, heure })
      setMode('confirm')
    }
  }

  const reset = () => {
    setEmp(null)
    setLastAction(null)
    setConfirmed(null)
    setMode('scanning')
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Pointage</h1>
        <p className="mt-1 text-sm text-slate-400">Scannez le badge de l'employé pour pointer.</p>
      </div>

      {mode === 'scanning' && (
        <div className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-card">
            <QrScanner onScan={handleScan} onError={() => setMode('error')} />
          </div>
          <p className="mt-4 text-center text-sm text-slate-500">Placez le badge dans le cadre…</p>
        </div>
      )}

      {mode === 'loading' && (
        <div className="mt-10 flex flex-col items-center gap-3 py-16">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
          <p className="text-sm text-slate-400">Lecture du badge…</p>
        </div>
      )}

      {mode === 'notfound' && (
        <Centered
          icon="❌"
          tone="red"
          title="Badge inconnu"
          hint="Ce badge ne correspond à aucun employé de votre entreprise."
          onReset={reset}
        />
      )}

      {mode === 'error' && (
        <Centered
          icon="📷"
          tone="neutral"
          title="Caméra inaccessible"
          hint="Autorisez l'accès à la caméra puis réessayez."
          onReset={reset}
        />
      )}

      {mode === 'found' && emp && (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-white/10 bg-ardoise p-5 shadow-card">
            <div className="flex gap-4">
              <StorageImage
                src={emp.photo_url}
                className="h-24 w-24 shrink-0 rounded-lg object-cover border border-white/10"
                fallback={<div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-nuit text-4xl text-slate-600">👤</div>}
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-white">{emp.prenoms} {emp.nom}</p>
                {emp.poste && <p className="mt-0.5 text-sm text-slate-400">{emp.poste}</p>}
                <p className="mt-3 text-xs text-slate-500">Dernière action</p>
                <p className="text-sm text-slate-300">
                  {lastAction
                    ? `${lastAction.type === 'entree' ? 'Entrée' : 'Sortie'} à ${timeStr(lastAction.heure)}`
                    : 'Aucun pointage enregistré'}
                </p>
              </div>
            </div>
            {emp.statut === 'inactif' && (
              <p className="mt-4 rounded-md bg-orange-500/10 border border-orange-500/30 px-3 py-2 text-xs text-orange-400">
                ⚠️ Cet employé est désactivé.
              </p>
            )}
          </div>

          <button
            onClick={record}
            disabled={recording}
            className={`w-full rounded-xl px-6 py-5 text-lg font-bold text-white transition-colors disabled:opacity-50 ${
              nextType === 'entree' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {recording
              ? 'Enregistrement…'
              : nextType === 'entree'
                ? '➡️ Enregistrer l\'entrée'
                : '⬅️ Enregistrer la sortie'}
          </button>
          <button
            onClick={reset}
            className="w-full rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white hover:border-accent hover:text-accent transition-colors"
          >
            Annuler
          </button>
        </div>
      )}

      {mode === 'confirm' && emp && confirmed && (
        <div className="mt-6 space-y-5">
          <div
            className={`rounded-2xl border p-8 text-center shadow-card ${
              confirmed.type === 'entree'
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-red-500/40 bg-red-500/10'
            }`}
          >
            <div className="text-5xl">{confirmed.type === 'entree' ? '✅' : '👋'}</div>
            <p className={`mt-3 font-display text-2xl font-bold ${confirmed.type === 'entree' ? 'text-emerald-400' : 'text-red-400'}`}>
              {confirmed.type === 'entree' ? 'ENTRÉE ENREGISTRÉE' : 'SORTIE ENREGISTRÉE'}
            </p>
            <p className="mt-2 text-white">{emp.prenoms} {emp.nom}</p>
            <p className="text-sm text-slate-400">à {timeStr(confirmed.heure)}</p>
          </div>
          <button
            onClick={reset}
            className="w-full rounded-lg bg-accent px-6 py-4 text-base font-semibold text-white hover:bg-accent-sombre transition-colors"
          >
            Scanner un autre badge
          </button>
        </div>
      )}
    </div>
  )
}

function Centered({
  icon, tone, title, hint, onReset,
}: {
  icon: string
  tone: 'red' | 'neutral'
  title: string
  hint: string
  onReset: () => void
}) {
  return (
    <div className={`mt-6 rounded-2xl border p-8 text-center shadow-card ${
      tone === 'red' ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-ardoise'
    }`}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl">{icon}</div>
      <p className="mt-3 font-display font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{hint}</p>
      <button
        onClick={onReset}
        className="mt-6 rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-white hover:bg-accent-sombre transition-colors"
      >
        Scanner un autre badge
      </button>
    </div>
  )
}
