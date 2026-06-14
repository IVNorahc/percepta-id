import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAlerts } from '../lib/alerts'
import DashboardCharts from '../components/DashboardCharts'

interface DashboardStats {
  onSite: number
  entriesToday: number
  exitsToday: number
}

interface RecentEntry {
  id: string
  fullName: string
  firstName: string | null
  zone: string
  checkedInAt: string
  checkoutStatus: 'present' | 'departed'
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({ onSite: 0, entriesToday: 0, exitsToday: 0 })
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { alerts: computedAlerts, loading: alertsLoading } = useAlerts()
  const unackedAlerts = computedAlerts.filter((a) => !a.isAcked)
  const hasCritical = unackedAlerts.some((a) => a.severity === 'critical')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [onSiteRes, todayRes, recentRes] = await Promise.all([
        supabase
          .from('access_logs')
          .select('id', { count: 'exact', head: true })
          .eq('checkout_status', 'present'),
        supabase
          .from('access_logs')
          .select('id, checked_out_at')
          .gte('checked_in_at', todayStart.toISOString()),
        supabase
          .from('access_logs')
          .select('id, full_name, first_name, zone, checked_in_at, checkout_status')
          .order('checked_in_at', { ascending: false })
          .limit(10),
      ])

      if (cancelled) return

      const todayRows = todayRes.data ?? []
      setStats({
        onSite: onSiteRes.count ?? 0,
        entriesToday: todayRows.length,
        exitsToday: todayRows.filter((r) => r.checked_out_at).length,
      })

      setRecentEntries(
        (recentRes.data ?? []).map((r) => ({
          id: r.id,
          fullName: r.full_name,
          firstName: r.first_name ?? null,
          zone: r.zone,
          checkedInAt: r.checked_in_at,
          checkoutStatus: r.checkout_status,
        })),
      )

      setLoading(false)
    }

    load()

    // Mise à jour en temps réel sur toute modification d'access_logs
    const channel = supabase
      .channel('dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs' }, () => {
        if (!cancelled) load()
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
      <p className="mt-1 text-sm text-slate-400">Vue d'ensemble de l'activité du site en temps réel.</p>

      {/* Alertes actives — section en haut, visible seulement si alertes non acquittées */}
      {!alertsLoading && unackedAlerts.length > 0 && (
        <div className={`mt-6 rounded-lg border p-4 ${hasCritical ? 'border-red-500/40 bg-red-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className={`w-4 h-4 ${hasCritical ? 'text-red-400' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className={`font-medium ${hasCritical ? 'text-red-300' : 'text-amber-300'}`}>
                {unackedAlerts.length} alerte{unackedAlerts.length > 1 ? 's' : ''} active{unackedAlerts.length > 1 ? 's' : ''}
              </span>
            </div>
            <Link to="/alertes" className="text-xs text-accent hover:text-white transition-colors">
              Voir toutes les alertes →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {unackedAlerts.slice(0, 3).map((a) => (
              <li
                key={`${a.logId}:${a.type}`}
                className={`rounded px-3 py-2 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-4 ${
                  a.severity === 'critical'
                    ? 'bg-red-500/10 border border-red-500/20 text-red-200'
                    : 'bg-amber-500/10 border border-amber-500/20 text-amber-200'
                }`}
              >
                <span className="font-medium truncate">
                  {a.firstName ? `${a.firstName} ${a.fullName}` : a.fullName}
                </span>
                <span className="sm:shrink-0 text-xs opacity-80">
                  {a.zone} — {a.label}
                </span>
              </li>
            ))}
            {unackedAlerts.length > 3 && (
              <li className="text-xs text-slate-500 pl-3">
                +{unackedAlerts.length - 3} autre{unackedAlerts.length - 3 > 1 ? 's' : ''} alerte{unackedAlerts.length - 3 > 1 ? 's' : ''}
              </li>
            )}
          </ul>
        </div>
      )}

      <div className={`${unackedAlerts.length > 0 ? 'mt-4' : 'mt-6'} grid grid-cols-1 sm:grid-cols-3 gap-4`}>
        <StatCard label="Personnes sur site" value={stats.onSite} loading={loading} highlight />
        <StatCard label="Entrées aujourd'hui" value={stats.entriesToday} loading={loading} />
        <StatCard label="Sorties aujourd'hui" value={stats.exitsToday} loading={loading} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-white/10 bg-ardoise p-6 shadow-card">
          <h2 className="font-display font-semibold">10 dernières personnes enregistrées</h2>
          {loading ? (
            <ul className="mt-4 divide-y divide-white/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-2">
                    <div className="skeleton h-3.5 w-32" />
                    <div className="skeleton h-2.5 w-20" />
                  </div>
                  <div className="skeleton h-5 w-16 rounded-full" />
                </li>
              ))}
            </ul>
          ) : recentEntries.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Aucune entrée enregistrée"
              hint="Les personnes scannées apparaîtront ici en temps réel."
            />
          ) : (
            <ul className="mt-4 divide-y divide-white/5">
              {recentEntries.map((entry) => (
                <li key={entry.id} className="py-3 flex items-center justify-between text-sm gap-2">
                  <div className="min-w-0">
                    <p className="text-white truncate">
                      {entry.firstName ? `${entry.firstName} ${entry.fullName}` : entry.fullName}
                    </p>
                    <p className="text-slate-500 text-xs">Zone : {entry.zone}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-slate-400 text-xs">
                      {new Date(entry.checkedInAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs ${
                        entry.checkoutStatus === 'present'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {entry.checkoutStatus === 'present' ? 'Sur site' : 'Sorti'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-ardoise p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Alertes de présence</h2>
            <Link to="/alertes" className="text-xs text-slate-400 hover:text-white transition-colors">
              Toutes →
            </Link>
          </div>
          {alertsLoading ? (
            <ul className="mt-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="skeleton h-10 w-full rounded-md" />
              ))}
            </ul>
          ) : computedAlerts.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Aucune alerte active"
              hint="Tout le personnel respecte les durées de présence."
              tone="success"
            />
          ) : (
            <ul className="mt-4 space-y-2">
              {computedAlerts.slice(0, 5).map((alert) => (
                <li
                  key={`${alert.logId}:${alert.type}`}
                  className={`rounded-md border px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                    alert.isAcked
                      ? 'border-white/10 text-slate-500 bg-white/5'
                      : alert.severity === 'critical'
                        ? 'border-red-500/40 text-red-300 bg-red-500/5'
                        : 'border-amber-500/40 text-amber-400 bg-amber-500/5'
                  }`}
                >
                  <span className="truncate">
                    {alert.firstName ? `${alert.firstName} ${alert.fullName}` : alert.fullName}
                  </span>
                  <span className="shrink-0 text-xs opacity-70">{alert.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Graphiques temps réel */}
      <DashboardCharts />
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
  loading,
}: {
  label: string
  value: number
  highlight?: boolean
  loading?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-6 shadow-card transition-all duration-200 hover:shadow-card-hover ${
        highlight ? 'border-accent/30 bg-accent/5 hover:border-accent/50' : 'border-white/10 bg-ardoise hover:border-white/20'
      }`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      {loading ? (
        <div className="skeleton mt-3 h-8 w-16" />
      ) : (
        <p className={`mt-2 font-display text-3xl font-bold ${highlight ? 'text-accent' : 'text-white'}`}>
          {value}
        </p>
      )}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  hint,
  tone = 'neutral',
}: {
  icon: string
  title: string
  hint?: string
  tone?: 'neutral' | 'success'
}) {
  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 px-6 py-10 text-center">
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full text-xl ${
          tone === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-400'
        }`}
      >
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 max-w-xs">{hint}</p>}
    </div>
  )
}
