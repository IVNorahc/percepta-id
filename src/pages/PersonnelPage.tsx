import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import BadgeModal, { type BadgeData } from '../components/BadgeModal'
import { useSettings } from '../lib/settings'

interface PersonRecord {
  id: string
  fullName: string
  firstName: string | null
  idNumber: string
  zone: string
  reason: string
  company: string | null
  birthDate: string | null
  nationality: string | null
  checkedInAt: string
  checkedOutAt: string | null
  checkoutStatus: 'present' | 'departed'
  photoUrl: string | null
}

const ALL_ZONES = 'Toutes les zones'

export default function PersonnelPage() {
  const { settings } = useSettings()
  const zoneFilters = [ALL_ZONES, ...settings.zones.map((z) => z.name)]
  const [records, setRecords] = useState<PersonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState(ALL_ZONES)
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'departed'>('all')
  const [selected, setSelected] = useState<PersonRecord | null>(null)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [badgeRecord, setBadgeRecord] = useState<BadgeData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPersonnel() {
      const { data } = await supabase
        .from('access_logs')
        .select(
          'id, full_name, first_name, id_number, zone, reason, company, birth_date, nationality, checked_in_at, checked_out_at, checkout_status, photo_url',
        )
        .order('checked_in_at', { ascending: false })

      if (cancelled) return

      setRecords(
        (data ?? []).map((r) => ({
          id: r.id,
          fullName: r.full_name,
          firstName: r.first_name ?? null,
          idNumber: r.id_number,
          zone: r.zone,
          reason: r.reason,
          company: r.company ?? null,
          birthDate: r.birth_date ?? null,
          nationality: r.nationality ?? null,
          checkedInAt: r.checked_in_at,
          checkedOutAt: r.checked_out_at,
          checkoutStatus: r.checkout_status ?? (r.checked_out_at ? 'departed' : 'present'),
          photoUrl: r.photo_url ?? null,
        })),
      )
      setLoading(false)
    }

    loadPersonnel()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records.filter((r) => {
      const name = `${r.firstName ?? ''} ${r.fullName}`.toLowerCase()
      const matchesSearch = !query || name.includes(query) || r.idNumber.toLowerCase().includes(query)
      const matchesZone = zoneFilter === ALL_ZONES || r.zone === zoneFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'present' && r.checkoutStatus === 'present') ||
        (statusFilter === 'departed' && r.checkoutStatus === 'departed')
      return matchesSearch && matchesZone && matchesStatus
    })
  }, [records, search, zoneFilter, statusFilter])

  const history = useMemo(
    () => (selected ? records.filter((r) => r.idNumber === selected.idNumber) : []),
    [records, selected],
  )

  const handleCheckout = async (record: PersonRecord) => {
    setCheckingOut(record.id)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('access_logs')
      .update({ checked_out_at: now, checkout_status: 'departed' })
      .eq('id', record.id)

    if (!error) {
      setRecords((prev) =>
        prev.map((r) =>
          r.id === record.id ? { ...r, checkedOutAt: now, checkoutStatus: 'departed' } : r,
        ),
      )
      if (selected?.id === record.id) {
        setSelected((s) => s ? { ...s, checkedOutAt: now, checkoutStatus: 'departed' } : s)
      }
    }
    setCheckingOut(null)
  }

  const displayName = (r: PersonRecord) =>
    r.firstName ? `${r.firstName} ${r.fullName}` : r.fullName

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Personnel</h1>
      <p className="mt-1 text-sm text-slate-400">
        {records.filter((r) => r.checkoutStatus === 'present').length} personne(s) actuellement sur site.
      </p>

      {/* Filtres */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Rechercher par nom, prénom ou numéro CNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-white/10 bg-ardoise px-3 py-2 text-sm text-white outline-none focus:border-accent placeholder:text-slate-600"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-ardoise px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          {zoneFilters.map((z) => (
            <option key={z} value={z} className="bg-nuit">{z}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-md border border-white/10 bg-ardoise px-3 py-2 text-sm text-white outline-none focus:border-accent"
        >
          <option value="all" className="bg-nuit">Tous les statuts</option>
          <option value="present" className="bg-nuit">Sur site</option>
          <option value="departed" className="bg-nuit">Sortis</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="mt-6 rounded-xl border border-white/10 shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ardoise text-slate-400">
            <tr>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Nom</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden sm:table-cell">CNI</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden md:table-cell">Zone</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden lg:table-cell">Entreprise</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap hidden md:table-cell">Entrée</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Statut</th>
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><div className="skeleton h-3.5 w-28" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-3.5 w-16" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="skeleton h-3.5 w-20" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="skeleton h-3.5 w-24" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-5 w-16 rounded-full" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-6 w-20 rounded-md" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">🔍</span>
                    <p className="mt-3 text-sm font-medium text-slate-300">Aucun résultat</p>
                    <p className="mt-1 text-xs text-slate-500">Ajustez la recherche ou les filtres pour voir d'autres personnes.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => setSelected(record)}
                  className={`cursor-pointer hover:bg-white/5 transition-colors ${selected?.id === record.id ? 'bg-white/5' : ''}`}
                >
                  <td className="px-4 py-3 text-white max-w-[140px] truncate">{displayName(record)}</td>
                  <td className="px-4 py-3 text-slate-400 hidden sm:table-cell font-mono text-xs">{record.idNumber}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell">{record.zone}</td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{record.company ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">
                    {new Date(record.checkedInAt).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs whitespace-nowrap ${
                        record.checkoutStatus === 'present'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {record.checkoutStatus === 'present' ? 'Sur site' : 'Sorti'}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {record.checkoutStatus === 'present' ? (
                      <div className="flex flex-col gap-1 sm:flex-row">
                        <button
                          onClick={() => handleCheckout(record)}
                          disabled={checkingOut === record.id}
                          className="rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:border-accent hover:text-accent transition-colors disabled:opacity-40 whitespace-nowrap"
                        >
                          {checkingOut === record.id ? '...' : 'Enregistrer sortie'}
                        </button>
                        <button
                          onClick={() => setBadgeRecord({
                            logId: record.id,
                            fullName: record.fullName,
                            firstName: record.firstName,
                            zone: record.zone,
                            checkedInAt: record.checkedInAt,
                            photoUrl: record.photoUrl,
                          })}
                          className="rounded-md border border-white/20 px-3 py-1 text-xs text-slate-300 hover:border-white/40 hover:text-white transition-colors whitespace-nowrap"
                        >
                          Voir le badge
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">
                        {record.checkedOutAt
                          ? new Date(record.checkedOutAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {badgeRecord && (
        <BadgeModal
          data={badgeRecord}
          onClose={() => setBadgeRecord(null)}
        />
      )}

      {/* Panneau historique */}
      {selected && (
        <div className="mt-6 rounded-lg border border-white/10 bg-ardoise p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium">{displayName(selected)}</h2>
              <p className="mt-0.5 text-xs text-slate-500 font-mono">{selected.idNumber}</p>
              {selected.nationality && <p className="mt-0.5 text-xs text-slate-500">{selected.nationality}</p>}
              {selected.birthDate && <p className="mt-0.5 text-xs text-slate-500">Né(e) le {selected.birthDate}</p>}
              {selected.company && <p className="mt-0.5 text-xs text-slate-500">{selected.company}</p>}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-slate-400 hover:text-accent shrink-0"
            >
              Fermer
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500 uppercase tracking-wider">
            Historique des accès — {history.length} visite(s)
          </p>
          <ul className="mt-2 divide-y divide-white/5">
            {history.map((entry) => (
              <li key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                <div>
                  <p className="text-white">{entry.zone}</p>
                  <p className="text-slate-500 text-xs">{entry.reason}</p>
                </div>
                <div className="text-slate-400 text-xs sm:text-right">
                  <p>Entrée : {new Date(entry.checkedInAt).toLocaleString('fr-FR')}</p>
                  {entry.checkedOutAt && (
                    <p>Sortie : {new Date(entry.checkedOutAt).toLocaleString('fr-FR')}</p>
                  )}
                  {entry.checkoutStatus === 'present' && (
                    <p className="text-accent">Toujours sur site</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
