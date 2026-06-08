import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface DashboardStats {
  onSite: number
  entriesToday: number
  exitsToday: number
}

interface RecentEntry {
  id: string
  fullName: string
  zone: string
  checkedInAt: string
}

interface AlertItem {
  id: string
  message: string
  level: 'info' | 'warning' | 'critical'
  createdAt: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ onSite: 0, entriesToday: 0, exitsToday: 0 })
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [onSiteRes, todayRes, recentRes, alertsRes] = await Promise.all([
        supabase.from('access_logs').select('id', { count: 'exact', head: true }).is('checked_out_at', null),
        supabase.from('access_logs').select('id, checked_out_at').gte('checked_in_at', todayStart.toISOString()),
        supabase
          .from('access_logs')
          .select('id, full_name, zone, checked_in_at')
          .order('checked_in_at', { ascending: false })
          .limit(8),
        supabase.from('alerts').select('id, message, level, created_at').order('created_at', { ascending: false }).limit(5),
      ])

      if (cancelled) return

      const todayRows = todayRes.data ?? []
      setStats({
        onSite: onSiteRes.count ?? 0,
        entriesToday: todayRows.length,
        exitsToday: todayRows.filter((row) => row.checked_out_at).length,
      })

      setRecentEntries(
        (recentRes.data ?? []).map((row) => ({
          id: row.id,
          fullName: row.full_name,
          zone: row.zone,
          checkedInAt: row.checked_in_at,
        })),
      )

      setAlerts(
        (alertsRes.data ?? []).map((row) => ({
          id: row.id,
          message: row.message,
          level: row.level,
          createdAt: row.created_at,
        })),
      )

      setLoading(false)
    }

    loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
      <p className="mt-1 text-sm text-gray-400">Vue d'ensemble de l'activité de votre site en temps réel.</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Personnes sur site" value={stats.onSite} />
        <StatCard label="Entrées aujourd'hui" value={stats.entriesToday} />
        <StatCard label="Sorties aujourd'hui" value={stats.exitsToday} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-lg border border-white/10 p-6">
          <h2 className="font-medium">Dernières personnes enregistrées</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Chargement...</p>
          ) : recentEntries.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Aucune entrée enregistrée pour le moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {recentEntries.map((entry) => (
                <li key={entry.id} className="py-3 flex items-center justify-between text-sm">
                  <div>
                    <p className="text-white">{entry.fullName}</p>
                    <p className="text-gray-500">Zone : {entry.zone}</p>
                  </div>
                  <span className="text-gray-400">
                    {new Date(entry.checkedInAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-white/10 p-6">
          <h2 className="font-medium">Alertes</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Chargement...</p>
          ) : alerts.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">Aucune alerte active.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {alerts.map((alert) => (
                <li
                  key={alert.id}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    alert.level === 'critical'
                      ? 'border-red-500/40 text-red-300 bg-red-500/5'
                      : alert.level === 'warning'
                        ? 'border-or/40 text-or bg-or/5'
                        : 'border-white/10 text-gray-300 bg-white/5'
                  }`}
                >
                  {alert.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-or">{value}</p>
    </div>
  )
}
