import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { type AlertType, type ComputedAlert, useAlerts } from '../lib/alerts'

export default function AlertesPage() {
  const { alerts, loading, refresh } = useAlerts()
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [ackedOpen, setAckedOpen] = useState(false)

  const active = alerts.filter((a) => !a.isAcked)
  const acked = alerts.filter((a) => a.isAcked)
  const criticalCount = active.filter((a) => a.severity === 'critical').length
  const warningCount = active.filter((a) => a.severity === 'warning').length

  const actionKey = (logId: string, action: string) => `${logId}:${action}`

  async function handleAck(logId: string, type: AlertType) {
    const key = actionKey(logId, `ack_${type}`)
    setPending((p) => ({ ...p, [key]: true }))
    await supabase
      .from('alert_acks')
      .upsert({ log_id: logId, alert_type: type }, { onConflict: 'log_id,alert_type' })
    setPending((p) => ({ ...p, [key]: false }))
    refresh()
  }

  async function handleCheckout(logId: string) {
    const key = actionKey(logId, 'checkout')
    setPending((p) => ({ ...p, [key]: true }))
    await supabase
      .from('access_logs')
      .update({ checkout_status: 'departed', checked_out_at: new Date().toISOString() })
      .eq('id', logId)
    setPending((p) => ({ ...p, [key]: false }))
    refresh()
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Personnes nécessitant une attention immédiate. Vérification automatique toutes les 5 minutes.
          </p>
        </div>
        <button
          onClick={refresh}
          className="shrink-0 rounded-md border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:border-accent hover:text-accent transition-colors"
        >
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4">
        <div className={`rounded-xl border p-3 sm:p-4 shadow-card ${active.length > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-ardoise'}`}>
          <p className="text-xs text-slate-400">Alertes actives</p>
          <p className={`mt-1 text-2xl font-semibold ${active.length > 0 ? 'text-red-300' : 'text-white'}`}>
            {loading ? '—' : active.length}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-4 shadow-card ${criticalCount > 0 ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-ardoise'}`}>
          <p className="text-xs text-slate-400">Critiques</p>
          <p className={`mt-1 text-2xl font-semibold ${criticalCount > 0 ? 'text-red-400' : 'text-white'}`}>
            {loading ? '—' : criticalCount}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-4 shadow-card ${warningCount > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-ardoise'}`}>
          <p className="text-xs text-slate-400">Avertissements</p>
          <p className={`mt-1 text-2xl font-semibold ${warningCount > 0 ? 'text-amber-400' : 'text-white'}`}>
            {loading ? '—' : warningCount}
          </p>
        </div>
      </div>

      {/* Active alerts */}
      <div className="mt-8">
        {loading ? (
          <ul className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="skeleton h-24 w-full rounded-xl" />
            ))}
          </ul>
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center shadow-card">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-2xl text-emerald-400">✓</div>
            <p className="mt-3 font-display font-semibold text-emerald-400">Aucune alerte active</p>
            <p className="mt-1 text-sm text-slate-500">
              Toutes les personnes sur site respectent les durées maximales de présence.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {active.map((alert) => (
              <AlertCard
                key={`${alert.logId}:${alert.type}`}
                alert={alert}
                onAck={() => handleAck(alert.logId, alert.type)}
                onCheckout={() => handleCheckout(alert.logId)}
                ackPending={!!pending[actionKey(alert.logId, `ack_${alert.type}`)]}
                checkoutPending={!!pending[actionKey(alert.logId, 'checkout')]}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Acked alerts (collapsible) */}
      {!loading && acked.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setAckedOpen((o) => !o)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${ackedOpen ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Alertes acquittées ({acked.length})
          </button>
          {ackedOpen && (
            <ul className="mt-3 space-y-2">
              {acked.map((alert) => (
                <AckedAlertCard
                  key={`${alert.logId}:${alert.type}`}
                  alert={alert}
                  onCheckout={() => handleCheckout(alert.logId)}
                  checkoutPending={!!pending[actionKey(alert.logId, 'checkout')]}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function AlertCard({
  alert,
  onAck,
  onCheckout,
  ackPending,
  checkoutPending,
}: {
  alert: ComputedAlert
  onAck: () => void
  onCheckout: () => void
  ackPending: boolean
  checkoutPending: boolean
}) {
  const isCritical = alert.severity === 'critical'
  const entryTime = new Date(alert.checkedInAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li
      className={`rounded-xl border-l-4 border border-white/10 bg-ardoise p-4 shadow-card transition-all duration-200 hover:shadow-card-hover ${
        isCritical ? 'border-l-red-500' : 'border-l-amber-400'
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                isCritical
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {isCritical ? 'CRITIQUE' : 'AVERTISSEMENT'}
            </span>
            {alert.type === 'zone_danger_4h' && (
              <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-red-900/40 text-red-200">
                Zone dangereuse
              </span>
            )}
          </div>
          <p className="mt-2 font-medium text-white">
            {alert.firstName ? `${alert.firstName} ${alert.fullName}` : alert.fullName}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
            <span>Zone : <span className="text-slate-200">{alert.zone}</span></span>
            <span>Entrée : <span className="text-slate-200">{entryTime}</span></span>
            <span className={isCritical ? 'text-red-300' : 'text-amber-300'}>{alert.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">
          <button
            onClick={onAck}
            disabled={ackPending || checkoutPending}
            className="flex-1 sm:flex-none rounded-md border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:border-white/30 hover:text-white transition-colors disabled:opacity-40"
          >
            {ackPending ? 'En cours...' : 'Marquer comme vu'}
          </button>
          <button
            onClick={onCheckout}
            disabled={ackPending || checkoutPending}
            className="flex-1 sm:flex-none rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-sombre transition-colors disabled:opacity-40"
          >
            {checkoutPending ? 'En cours...' : 'Enregistrer la sortie'}
          </button>
        </div>
      </div>
    </li>
  )
}

function AckedAlertCard({
  alert,
  onCheckout,
  checkoutPending,
}: {
  alert: ComputedAlert
  onCheckout: () => void
  checkoutPending: boolean
}) {
  const entryTime = new Date(alert.checkedInAt).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <li className="rounded-lg border border-white/10 bg-ardoise/50 p-3 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex items-center gap-x-3 gap-y-1 flex-wrap text-sm text-slate-500">
        <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-white/5 text-slate-500">Vu</span>
        <span className="text-slate-300 truncate max-w-full">
          {alert.firstName ? `${alert.firstName} ${alert.fullName}` : alert.fullName}
        </span>
        <span className="text-xs">{alert.zone}</span>
        <span className="text-xs">{entryTime}</span>
        <span className="text-xs">{alert.label}</span>
      </div>
      <button
        onClick={onCheckout}
        disabled={checkoutPending}
        className="shrink-0 rounded-md border border-white/10 px-3 py-1 text-xs text-slate-400 hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
      >
        {checkoutPending ? 'En cours...' : 'Enregistrer la sortie'}
      </button>
    </li>
  )
}
