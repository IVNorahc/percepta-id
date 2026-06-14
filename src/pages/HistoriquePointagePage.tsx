import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportToCsv, type ExportColumn } from '../lib/export'
import { formatDurationH } from '../lib/alerts'

interface Emp {
  id: string
  nom: string
  prenoms: string
}

interface Pointage {
  employee_id: string
  type: 'entree' | 'sortie'
  heure: string
}

interface DayRow {
  employeeId: string
  employeeName: string
  date: string // YYYY-MM-DD
  entree: string | null
  sortie: string | null
  durationMs: number | null
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function timeStr(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Employé', key: 'employee' },
  { header: 'Date', key: 'date' },
  { header: 'Entrée', key: 'entree' },
  { header: 'Sortie', key: 'sortie' },
  { header: 'Durée', key: 'duree' },
]

export default function HistoriquePointagePage() {
  const [employees, setEmployees] = useState<Emp[]>([])
  const [employeeId, setEmployeeId] = useState('all')
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState<DayRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, nom, prenoms')
      .order('nom', { ascending: true })
      .then(({ data }) => setEmployees((data ?? []) as Emp[]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)

    let query = supabase
      .from('pointages')
      .select('employee_id, type, heure')
      .gte('heure', start.toISOString())
      .lt('heure', end.toISOString())
      .order('heure', { ascending: true })
    if (employeeId !== 'all') query = query.eq('employee_id', employeeId)

    const { data } = await query
    const pointages = (data ?? []) as Pointage[]

    const nameOf = new Map(employees.map((e) => [e.id, `${e.prenoms} ${e.nom}`]))

    // Agréger par employé + jour : 1re entrée, dernière sortie
    const map = new Map<string, DayRow>()
    for (const p of pointages) {
      const dateKey = localDateKey(p.heure)
      const key = `${p.employee_id}|${dateKey}`
      let row = map.get(key)
      if (!row) {
        row = {
          employeeId: p.employee_id,
          employeeName: nameOf.get(p.employee_id) ?? '—',
          date: dateKey,
          entree: null,
          sortie: null,
          durationMs: null,
        }
        map.set(key, row)
      }
      if (p.type === 'entree') {
        if (!row.entree || new Date(p.heure) < new Date(row.entree)) row.entree = p.heure
      } else {
        if (!row.sortie || new Date(p.heure) > new Date(row.sortie)) row.sortie = p.heure
      }
    }
    for (const row of map.values()) {
      if (row.entree && row.sortie) {
        const ms = new Date(row.sortie).getTime() - new Date(row.entree).getTime()
        row.durationMs = ms > 0 ? ms : null
      }
    }

    const result = Array.from(map.values()).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return a.employeeName.localeCompare(b.employeeName)
    })
    setRows(result)
    setLoading(false)
  }, [month, employeeId, employees])

  useEffect(() => { load() }, [load])

  const totalDuration = useMemo(
    () => rows.reduce((acc, r) => acc + (r.durationMs ?? 0), 0),
    [rows],
  )

  const fmtDate = (key: string) =>
    new Date(key + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  const handleExport = () => {
    const exportRows = rows.map((r) => ({
      employee: r.employeeName,
      date: new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR'),
      entree: timeStr(r.entree),
      sortie: timeStr(r.sortie),
      duree: r.durationMs != null ? formatDurationH(r.durationMs / 3_600_000) : '—',
    }))
    const who = employeeId === 'all' ? 'tous' : (employees.find((e) => e.id === employeeId)?.nom ?? 'employe')
    exportToCsv(`pointages-${month}-${who}`, EXPORT_COLUMNS, exportRows)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historique de pointage</h1>
          <p className="mt-1 text-sm text-slate-400">Heures travaillées par jour — export pour la paie.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={loading || rows.length === 0}
          className="self-start sm:self-auto rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          Exporter Excel
        </button>
      </div>

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap gap-3 rounded-xl border border-white/10 bg-ardoise p-4 shadow-card">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="all" className="bg-nuit">Tous les employés</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id} className="bg-nuit">{e.prenoms} {e.nom}</option>
          ))}
        </select>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-md border border-white/10 bg-nuit px-3 py-2 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
        />
        {!loading && rows.length > 0 && (
          <div className="ml-auto self-center text-sm text-slate-400">
            Total : <span className="font-semibold text-white">{formatDurationH(totalDuration / 3_600_000)}</span>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="mt-4 rounded-xl border border-white/10 shadow-card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-ardoise text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Employé</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Entrée</th>
              <th className="px-4 py-3 text-left font-medium">Sortie</th>
              <th className="px-4 py-3 text-right font-medium">Durée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-32" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-20" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-12" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-12" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-14 ml-auto" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">🗓️</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">Aucun pointage</p>
                    <p className="mt-1 text-xs text-slate-500">Aucune donnée pour cette période / cet employé.</p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.employeeId}|${r.date}`} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-white">{r.employeeName}</td>
                  <td className="px-4 py-3 text-slate-400 capitalize">{fmtDate(r.date)}</td>
                  <td className="px-4 py-3 text-emerald-400">{timeStr(r.entree)}</td>
                  <td className="px-4 py-3 text-red-400">{timeStr(r.sortie)}</td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {r.durationMs != null ? formatDurationH(r.durationMs / 3_600_000) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
