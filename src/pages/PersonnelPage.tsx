import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PersonRecord {
  id: string
  fullName: string
  idNumber: string
  zone: string
  reason: string
  checkedInAt: string
  checkedOutAt: string | null
}

const ZONE_FILTERS = ['Toutes les zones', 'Entrée principale', 'Zone d\'extraction', 'Atelier', 'Bureaux administratifs', 'Zone de stockage']

export default function PersonnelPage() {
  const [records, setRecords] = useState<PersonRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [zoneFilter, setZoneFilter] = useState(ZONE_FILTERS[0])
  const [selected, setSelected] = useState<PersonRecord | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPersonnel() {
      const { data } = await supabase
        .from('access_logs')
        .select('id, full_name, id_number, zone, reason, checked_in_at, checked_out_at')
        .order('checked_in_at', { ascending: false })

      if (cancelled) return

      setRecords(
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

    loadPersonnel()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return records.filter((record) => {
      const matchesSearch =
        !query || record.fullName.toLowerCase().includes(query) || record.idNumber.toLowerCase().includes(query)
      const matchesZone = zoneFilter === ZONE_FILTERS[0] || record.zone === zoneFilter
      return matchesSearch && matchesZone
    })
  }, [records, search, zoneFilter])

  const history = useMemo(
    () => (selected ? records.filter((record) => record.idNumber === selected.idNumber) : []),
    [records, selected],
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Personnel</h1>
      <p className="mt-1 text-sm text-gray-400">Liste de toutes les personnes enregistrées sur vos sites.</p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Rechercher par nom ou numéro de CNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-or"
        >
          {ZONE_FILTERS.map((option) => (
            <option key={option} value={option} className="bg-noir">
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-gray-400">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-4 py-3">CNI</th>
              <th className="text-left font-medium px-4 py-3">Zone</th>
              <th className="text-left font-medium px-4 py-3">Motif</th>
              <th className="text-left font-medium px-4 py-3">Entrée</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Chargement...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Aucun résultat pour ces critères.
                </td>
              </tr>
            ) : (
              filtered.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => setSelected(record)}
                  className="cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 text-white">{record.fullName}</td>
                  <td className="px-4 py-3 text-gray-400">{record.idNumber}</td>
                  <td className="px-4 py-3 text-gray-400">{record.zone}</td>
                  <td className="px-4 py-3 text-gray-400">{record.reason}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(record.checkedInAt).toLocaleString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        record.checkedOutAt ? 'bg-white/10 text-gray-400' : 'bg-or/10 text-or'
                      }`}
                    >
                      {record.checkedOutAt ? 'Sorti' : 'Sur site'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6 rounded-lg border border-white/10 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Historique des accès — {selected.fullName}</h2>
            <button onClick={() => setSelected(null)} className="text-sm text-gray-400 hover:text-or">
              Fermer
            </button>
          </div>
          <ul className="mt-4 divide-y divide-white/5">
            {history.map((entry) => (
              <li key={entry.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-white">{entry.zone}</p>
                  <p className="text-gray-500">{entry.reason}</p>
                </div>
                <div className="text-right text-gray-400">
                  <p>Entrée : {new Date(entry.checkedInAt).toLocaleString('fr-FR')}</p>
                  {entry.checkedOutAt && <p>Sortie : {new Date(entry.checkedOutAt).toLocaleString('fr-FR')}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
