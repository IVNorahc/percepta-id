import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportToExcel, exportToPdf, type ExportColumn } from '../lib/export'

interface AccessRow {
  id: string
  fullName: string
  idNumber: string
  zone: string
  reason: string
  checkedInAt: string
  checkedOutAt: string | null
}

const COLUMNS: ExportColumn[] = [
  { header: 'Nom', key: 'fullName' },
  { header: 'CNI', key: 'idNumber' },
  { header: 'Zone', key: 'zone' },
  { header: 'Motif', key: 'reason' },
  { header: 'Entrée', key: 'checkedInAt' },
  { header: 'Sortie', key: 'checkedOutAt' },
]

function startOfDayIso(daysAgo: number) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}

const PERIODS = [
  { label: '7 derniers jours', days: 7 },
  { label: '30 derniers jours', days: 30 },
  { label: '90 derniers jours', days: 90 },
]

export default function RapportsPage() {
  const [periodIndex, setPeriodIndex] = useState(0)
  const [rows, setRows] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function loadReport() {
      const since = startOfDayIso(PERIODS[periodIndex].days)
      const { data } = await supabase
        .from('access_logs')
        .select('id, full_name, id_number, zone, reason, checked_in_at, checked_out_at')
        .gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false })

      if (cancelled) return

      setRows(
        (data ?? []).map((row) => ({
          id: row.id,
          fullName: row.full_name,
          idNumber: row.id_number,
          zone: row.zone,
          reason: row.reason,
          checkedInAt: row.checked_in_at,
          checkedOutAt: row.checked_out_at,
        })),
      )
      setLoading(false)
    }

    loadReport()
    return () => {
      cancelled = true
    }
  }, [periodIndex])

  const stats = useMemo(() => {
    const byZone = new Map<string, number>()
    rows.forEach((row) => byZone.set(row.zone, (byZone.get(row.zone) ?? 0) + 1))
    return {
      total: rows.length,
      stillOnSite: rows.filter((row) => !row.checkedOutAt).length,
      byZone: Array.from(byZone.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [rows])

  const exportRows = () =>
    rows.map((row) => ({
      fullName: row.fullName,
      idNumber: row.idNumber,
      zone: row.zone,
      reason: row.reason,
      checkedInAt: new Date(row.checkedInAt).toLocaleString('fr-FR'),
      checkedOutAt: row.checkedOutAt ? new Date(row.checkedOutAt).toLocaleString('fr-FR') : '—',
    }))

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      await exportToPdf(`Rapport accès - ${PERIODS[periodIndex].label}`, COLUMNS, exportRows())
    } finally {
      setExporting(null)
    }
  }

  const handleExportExcel = async () => {
    setExporting('excel')
    try {
      await exportToExcel(`Rapport accès - ${PERIODS[periodIndex].label}`, COLUMNS, exportRows())
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
          <p className="mt-1 text-sm text-gray-400">Statistiques d'accès et export de données par période.</p>
        </div>
        <select
          value={periodIndex}
          onChange={(e) => setPeriodIndex(Number(e.target.value))}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
        >
          {PERIODS.map((period, index) => (
            <option key={period.label} value={index} className="bg-noir">
              {period.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-white/10 p-6">
          <p className="text-sm text-gray-400">Total des accès</p>
          <p className="mt-2 text-3xl font-semibold text-or">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-white/10 p-6">
          <p className="text-sm text-gray-400">Actuellement sur site</p>
          <p className="mt-2 text-3xl font-semibold text-or">{stats.stillOnSite}</p>
        </div>
        <div className="rounded-lg border border-white/10 p-6">
          <p className="text-sm text-gray-400">Zone la plus fréquentée</p>
          <p className="mt-2 text-lg font-medium text-white">{stats.byZone[0]?.[0] ?? '—'}</p>
          <p className="text-sm text-gray-500">{stats.byZone[0]?.[1] ?? 0} accès</p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 p-6">
        <h2 className="font-medium">Répartition par zone</h2>
        {stats.byZone.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">Aucune donnée pour cette période.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {stats.byZone.map(([zone, count]) => (
              <li key={zone} className="text-sm">
                <div className="flex items-center justify-between text-gray-300">
                  <span>{zone}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5">
                  <div
                    className="h-1.5 rounded-full bg-or"
                    style={{ width: `${stats.total ? Math.round((count / stats.total) * 100) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleExportPdf}
          disabled={loading || rows.length === 0 || exporting !== null}
          className="rounded-md bg-or px-5 py-2.5 text-sm font-medium text-noir hover:bg-or/90 transition-colors disabled:opacity-50"
        >
          {exporting === 'pdf' ? 'Export en cours...' : 'Exporter en PDF'}
        </button>
        <button
          onClick={handleExportExcel}
          disabled={loading || rows.length === 0 || exporting !== null}
          className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:border-or hover:text-or transition-colors disabled:opacity-50"
        >
          {exporting === 'excel' ? 'Export en cours...' : 'Exporter en Excel'}
        </button>
        {loading && <span className="text-sm text-gray-500">Chargement des données...</span>}
      </div>
    </div>
  )
}
