import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import StorageImage from '../components/StorageImage'

interface Emp {
  id: string
  nom: string
  prenoms: string
  poste: string | null
  photo_url: string | null
}

interface Pointage {
  employee_id: string
  type: 'entree' | 'sortie'
  heure: string
}

interface PresentRow extends Emp {
  arrivee: string
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function PresencePage() {
  const [present, setPresent] = useState<PresentRow[]>([])
  const [absent, setAbsent] = useState<Emp[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef(`presence_${Math.random().toString(36).slice(2)}`)

  const load = useCallback(async () => {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const [empRes, pointRes] = await Promise.all([
      supabase.from('employees').select('id, nom, prenoms, poste, photo_url').eq('statut', 'actif'),
      supabase
        .from('pointages')
        .select('employee_id, type, heure')
        .gte('heure', dayStart.toISOString())
        .order('heure', { ascending: true }),
    ])

    const employees = (empRes.data ?? []) as Emp[]
    const pointages = (pointRes.data ?? []) as Pointage[]

    // Regrouper les pointages du jour par employé
    const byEmp = new Map<string, Pointage[]>()
    for (const p of pointages) {
      const arr = byEmp.get(p.employee_id) ?? []
      arr.push(p)
      byEmp.set(p.employee_id, arr)
    }

    const presents: PresentRow[] = []
    const absents: Emp[] = []
    for (const e of employees) {
      const ps = byEmp.get(e.id) ?? []
      const last = ps[ps.length - 1]
      if (last && last.type === 'entree') {
        const firstEntry = ps.find((p) => p.type === 'entree')
        presents.push({ ...e, arrivee: firstEntry?.heure ?? last.heure })
      } else {
        absents.push(e)
      }
    }
    presents.sort((a, b) => new Date(a.arrivee).getTime() - new Date(b.arrivee).getTime())
    absents.sort((a, b) => `${a.prenoms} ${a.nom}`.localeCompare(`${b.prenoms} ${b.nom}`))

    setPresent(presents)
    setAbsent(absents)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const ch = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const total = present.length + absent.length

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Présence du jour</h1>
          <p className="mt-1 text-sm text-slate-400">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={load}
          className="self-start sm:self-auto rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors"
        >
          ↻ Rafraîchir
        </button>
      </div>

      {/* Compteurs */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Counter label="Présents" value={present.length} color="text-emerald-400" loading={loading} />
        <Counter label="Absents" value={absent.length} color="text-slate-300" loading={loading} />
        <Counter label="Total actifs" value={total} color="text-white" loading={loading} />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Présents */}
        <section className="rounded-xl border border-white/10 bg-ardoise p-5 shadow-card">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Présents ({present.length})
          </h2>
          {loading ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-md" />)}</div>
          ) : present.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Aucun employé présent pour le moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {present.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <StorageImage
                      src={e.photo_url}
                      className="h-8 w-8 rounded-full object-cover border border-white/10"
                      fallback={<div className="flex h-8 w-8 items-center justify-center rounded-full bg-nuit border border-white/10 text-xs text-slate-500">👤</div>}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{e.prenoms} {e.nom}</p>
                      <p className="text-xs text-slate-500 truncate">{e.poste ?? '—'}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-emerald-400">Arrivé à {timeStr(e.arrivee)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Absents */}
        <section className="rounded-xl border border-white/10 bg-ardoise p-5 shadow-card">
          <h2 className="font-display font-semibold flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-500" /> Absents ({absent.length})
          </h2>
          {loading ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-12 w-full rounded-md" />)}</div>
          ) : absent.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Tous les employés actifs sont présents.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {absent.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <StorageImage
                    src={e.photo_url}
                    className="h-8 w-8 rounded-full object-cover border border-white/10 opacity-60"
                    fallback={<div className="flex h-8 w-8 items-center justify-center rounded-full bg-nuit border border-white/10 text-xs text-slate-600">👤</div>}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-400 truncate">{e.prenoms} {e.nom}</p>
                    <p className="text-xs text-slate-600 truncate">{e.poste ?? '—'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function Counter({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ardoise p-4 sm:p-5 shadow-card">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      {loading ? <div className="skeleton mt-2 h-8 w-12" /> : <p className={`mt-1 font-display text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>}
    </div>
  )
}
