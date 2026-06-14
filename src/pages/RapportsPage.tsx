import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { exportToCsv, exportToPdf, type ExportColumn } from '../lib/export'
import { useSettings } from '../lib/settings'
import { getSignedUrl } from '../lib/storage'

interface AccessRow {
  id: string
  fullName: string
  firstName: string | null
  typePiece: string | null
  idNumber: string
  zone: string
  reason: string
  checkedInAt: string
  checkedOutAt: string | null
  checkoutStatus: 'present' | 'departed'
}

type PeriodKey = 'today' | 'week' | 'month' | 'custom'

const ALL_ZONES = 'Toutes les zones'

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'custom', label: 'Personnalisé' },
]

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Nom', key: 'fullName' },
  { header: 'Prénom', key: 'firstName' },
  { header: 'Type pièce', key: 'typePiece' },
  { header: 'Numéro pièce', key: 'idNumber' },
  { header: 'Zone', key: 'zone' },
  { header: 'Motif', key: 'reason' },
  { header: 'Entrée', key: 'checkedInAt' },
  { header: 'Sortie', key: 'checkedOutAt' },
  { header: 'Durée', key: 'duration' },
]

function getPeriodRange(
  period: PeriodKey,
  dateFrom: string,
  dateTo: string,
): { from: Date; to: Date } {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { from: start, to: now }
  }
  if (period === 'week') {
    const start = new Date(now)
    const day = start.getDay() || 7
    start.setDate(start.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    return { from: start, to: now }
  }
  if (period === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
  }
  return {
    from: dateFrom ? new Date(dateFrom + 'T00:00:00') : new Date(0),
    to: dateTo ? new Date(dateTo + 'T23:59:59') : now,
  }
}

function formatPeriodLabel(period: PeriodKey, dateFrom: string, dateTo: string): string {
  if (period === 'today') return "Aujourd'hui"
  if (period === 'week') return 'Cette semaine'
  if (period === 'month') return 'Ce mois'
  const parts = []
  if (dateFrom) parts.push(`du ${new Date(dateFrom).toLocaleDateString('fr-FR')}`)
  if (dateTo) parts.push(`au ${new Date(dateTo).toLocaleDateString('fr-FR')}`)
  return parts.length > 0 ? parts.join(' ') : 'Période personnalisée'
}

function formatDuration(from: string, to: string | null): string {
  if (!to) return '—'
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (ms <= 0) return '—'
  const totalMin = Math.round(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function RapportsPage() {
  const { settings } = useSettings()
  const zoneOptions = [ALL_ZONES, ...settings.zones.map((z) => z.name)]
  const [period, setPeriod] = useState<PeriodKey>('week')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [zoneFilter, setZoneFilter] = useState(ALL_ZONES)
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'departed'>('all')
  const [rows, setRows] = useState<AccessRow[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)

  useEffect(() => {
    if (period === 'custom' && !dateFrom) {
      setLoading(false)
      setRows([])
      return
    }

    let cancelled = false
    setLoading(true)

    async function loadReport() {
      const { from, to } = getPeriodRange(period, dateFrom, dateTo)
      const { data } = await supabase
        .from('access_logs')
        .select(
          'id, full_name, first_name, type_piece, id_number, zone, reason, checked_in_at, checked_out_at, checkout_status',
        )
        .gte('checked_in_at', from.toISOString())
        .lte('checked_in_at', to.toISOString())
        .order('checked_in_at', { ascending: false })

      if (cancelled) return

      setRows(
        (data ?? []).map((r) => ({
          id: r.id,
          fullName: r.full_name,
          firstName: r.first_name ?? null,
          typePiece: r.type_piece ?? null,
          idNumber: r.id_number,
          zone: r.zone,
          reason: r.reason,
          checkedInAt: r.checked_in_at,
          checkedOutAt: r.checked_out_at ?? null,
          checkoutStatus: r.checkout_status ?? (r.checked_out_at ? 'departed' : 'present'),
        })),
      )
      setLoading(false)
    }

    loadReport()
    return () => { cancelled = true }
  }, [period, dateFrom, dateTo])

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const matchZone = zoneFilter === ALL_ZONES || r.zone === zoneFilter
        const matchStatus =
          statusFilter === 'all' ||
          (statusFilter === 'present' && r.checkoutStatus === 'present') ||
          (statusFilter === 'departed' && r.checkoutStatus === 'departed')
        return matchZone && matchStatus
      }),
    [rows, zoneFilter, statusFilter],
  )

  const stats = useMemo(() => {
    const byZone = new Map<string, number>()
    filtered.forEach((r) => byZone.set(r.zone, (byZone.get(r.zone) ?? 0) + 1))

    const durations = filtered
      .filter((r) => r.checkedOutAt)
      .map((r) => new Date(r.checkedOutAt!).getTime() - new Date(r.checkedInAt).getTime())

    const avgMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    const avgMin = Math.round(avgMs / 60000)
    const avgH = Math.floor(avgMin / 60)
    const avgM = avgMin % 60
    const avgDuration =
      durations.length === 0
        ? '—'
        : avgH > 0
          ? `${avgH}h${avgM.toString().padStart(2, '0')}`
          : `${avgMin}min`

    return {
      total: filtered.length,
      avgDuration,
      byZone: Array.from(byZone.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [filtered])

  const periodLabel = formatPeriodLabel(period, dateFrom, dateTo)

  const buildExportRows = () =>
    filtered.map((r) => ({
      fullName: r.fullName,
      firstName: r.firstName ?? '—',
      typePiece: r.typePiece ?? 'CNI',
      idNumber: r.idNumber,
      zone: r.zone,
      reason: r.reason,
      checkedInAt: formatDatetime(r.checkedInAt),
      checkedOutAt: r.checkedOutAt ? formatDatetime(r.checkedOutAt) : '—',
      duration: formatDuration(r.checkedInAt, r.checkedOutAt),
    }))

  const handleExportPdf = async () => {
    setExporting('pdf')
    try {
      const signedLogo = await getSignedUrl(settings.logoUrl)
      await exportToPdf(
        {
          title: 'Rapport des présences',
          subtitle: periodLabel,
          columns: EXPORT_COLUMNS,
          companyName: settings.companyName,
          logoUrl: signedLogo,
        },
        buildExportRows(),
      )
    } finally {
      setExporting(null)
    }
  }

  const handleExportCsv = () => {
    setExporting('csv')
    try {
      exportToCsv(`rapport-presences-${periodLabel}`, EXPORT_COLUMNS, buildExportRows())
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapports</h1>
          <p className="mt-1 text-sm text-slate-400">
            Statistiques d'accès et export par période.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            onClick={handleExportPdf}
            disabled={loading || filtered.length === 0 || exporting !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {exporting === 'pdf' ? 'Export...' : 'Exporter PDF'}
          </button>
          <button
            onClick={handleExportCsv}
            disabled={loading || filtered.length === 0 || exporting !== null}
            className="rounded-md border border-white/20 px-4 py-2 text-sm text-white hover:border-accent hover:text-accent transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {exporting === 'csv' ? 'Export...' : 'Exporter Excel'}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="mt-6 rounded-xl border border-white/10 bg-ardoise p-4 shadow-card">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Filtres</p>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Période — boutons toggle */}
          <div className="flex gap-1 flex-wrap">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  period === p.key
                    ? 'bg-accent text-white'
                    : 'border border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Zone */}
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="rounded-md border border-white/10 bg-nuit px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
          >
            {zoneOptions.map((z) => (
              <option key={z} value={z} className="bg-nuit">{z}</option>
            ))}
          </select>

          {/* Statut */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-md border border-white/10 bg-nuit px-3 py-1.5 text-sm text-white outline-none focus:border-accent"
          >
            <option value="all" className="bg-nuit">Tous les statuts</option>
            <option value="present" className="bg-nuit">Sur site</option>
            <option value="departed" className="bg-nuit">Sortis</option>
          </select>
        </div>

        {/* Dates personnalisées */}
        {period === 'custom' && (
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Du</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-md border border-white/10 bg-nuit px-3 py-1.5 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">au</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-md border border-white/10 bg-nuit px-3 py-1.5 text-sm text-white outline-none focus:border-accent [color-scheme:dark]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-5 shadow-card">
          <p className="text-sm text-slate-400">Total entrées</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-accent">{stats.total}</p>
          <p className="mt-0.5 text-xs text-slate-500">{periodLabel}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-ardoise p-5 shadow-card">
          <p className="text-sm text-slate-400">Durée moyenne</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-white">{stats.avgDuration}</p>
          <p className="mt-0.5 text-xs text-slate-500">des présences avec sortie enregistrée</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-ardoise p-5 shadow-card">
          <p className="mb-3 text-sm text-slate-400">Répartition par zone</p>
          {stats.byZone.length === 0 ? (
            <p className="text-sm text-slate-600">—</p>
          ) : (
            <ul className="space-y-2.5">
              {stats.byZone.slice(0, 4).map(([zone, count]) => (
                <li key={zone} className="text-xs">
                  <div className="flex items-center justify-between text-slate-300 mb-1">
                    <span className="truncate mr-2">{zone}</span>
                    <span className="shrink-0 text-slate-500">
                      {count} ({stats.total ? Math.round((count / stats.total) * 100) : 0}%)
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5">
                    <div
                      className="h-1 rounded-full bg-accent transition-all"
                      style={{ width: `${stats.total ? Math.round((count / stats.total) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Tableau des présences */}
      <div className="mt-4 rounded-xl border border-white/10 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ardoise text-slate-400">
            <tr>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Nom</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden sm:table-cell">Prénom</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden md:table-cell">Type</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden md:table-cell">Numéro</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden lg:table-cell">Zone</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Entrée</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden lg:table-cell">Sortie</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden xl:table-cell">Durée</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-28" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="skeleton h-3.5 w-20" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-5 w-12 rounded" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="skeleton h-3.5 w-16" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="skeleton h-3.5 w-12" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                </tr>
              ))
            ) : period === 'custom' && !dateFrom ? (
              <tr>
                <td colSpan={9} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">📅</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">Choisissez une période</p>
                    <p className="mt-1 text-xs text-slate-500">Sélectionnez une date de début pour afficher les données.</p>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">📊</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">Aucune entrée sur cette période</p>
                    <p className="mt-1 text-xs text-slate-500">Essayez une autre période ou d'autres filtres.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-white font-medium max-w-[130px] truncate">
                    {r.fullName}
                  </td>
                  <td className="px-4 py-3 text-slate-300 hidden sm:table-cell">
                    {r.firstName ?? '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="rounded px-1.5 py-0.5 text-xs bg-white/5 text-slate-400 font-mono">
                      {r.typePiece ?? 'CNI'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono text-xs">
                    {r.idNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{r.zone}</td>
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                    {formatDatetime(r.checkedInAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell whitespace-nowrap text-xs">
                    {r.checkedOutAt ? formatDatetime(r.checkedOutAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell text-xs">
                    {formatDuration(r.checkedInAt, r.checkedOutAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                        r.checkoutStatus === 'present'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {r.checkoutStatus === 'present' ? 'Sur site' : 'Sorti'}
                    </span>
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
