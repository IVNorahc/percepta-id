import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

export type AlertType = 'over_8h' | 'over_12h' | 'zone_danger_4h'
export type AlertSeverity = 'warning' | 'critical'

export interface ComputedAlert {
  logId: string
  type: AlertType
  severity: AlertSeverity
  label: string
  fullName: string
  firstName: string | null
  zone: string
  checkedInAt: string
  hoursOnSite: number
  isAcked: boolean
}

export interface AlertThresholds {
  warningH: number
  criticalH: number
  dangerH: number
  dangerZones: string[]
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  warningH: 8,
  criticalH: 12,
  dangerH: 4,
  dangerZones: ['Zone Dangereuse'],
}

export function formatDurationH(hours: number): string {
  const totalMin = Math.floor(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

interface PresentLog {
  id: string
  full_name: string
  first_name: string | null
  zone: string
  checked_in_at: string
}

export function buildAlerts(
  logs: PresentLog[],
  acks: Array<{ log_id: string; alert_type: string }>,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): ComputedAlert[] {
  const ackSet = new Set(acks.map((a) => `${a.log_id}:${a.alert_type}`))
  const results: ComputedAlert[] = []
  const now = Date.now()
  const { warningH, criticalH, dangerH, dangerZones } = thresholds

  for (const log of logs) {
    const hours = (now - new Date(log.checked_in_at).getTime()) / 3_600_000
    const isDanger = dangerZones.includes(log.zone)

    if (isDanger && hours >= dangerH) {
      const type: AlertType = 'zone_danger_4h'
      results.push({
        logId: log.id,
        type,
        severity: 'critical',
        label: `Zone dangereuse depuis ${formatDurationH(hours)}`,
        fullName: log.full_name,
        firstName: log.first_name,
        zone: log.zone,
        checkedInAt: log.checked_in_at,
        hoursOnSite: hours,
        isAcked: ackSet.has(`${log.id}:${type}`),
      })
    }

    if (hours >= criticalH) {
      const type: AlertType = 'over_12h'
      results.push({
        logId: log.id,
        type,
        severity: 'critical',
        label: `Sur site depuis ${formatDurationH(hours)}`,
        fullName: log.full_name,
        firstName: log.first_name,
        zone: log.zone,
        checkedInAt: log.checked_in_at,
        hoursOnSite: hours,
        isAcked: ackSet.has(`${log.id}:${type}`),
      })
    } else if (hours >= warningH) {
      const type: AlertType = 'over_8h'
      results.push({
        logId: log.id,
        type,
        severity: 'warning',
        label: `Sur site depuis ${formatDurationH(hours)}`,
        fullName: log.full_name,
        firstName: log.first_name,
        zone: log.zone,
        checkedInAt: log.checked_in_at,
        hoursOnSite: hours,
        isAcked: ackSet.has(`${log.id}:${type}`),
      })
    }
  }

  return results.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
    return b.hoursOnSite - a.hoursOnSite
  })
}

export function useAlerts(refreshIntervalMs = 5 * 60 * 1000) {
  const { companyId } = useAuth()
  const [alerts, setAlerts] = useState<ComputedAlert[]>([])
  const [loading, setLoading] = useState(true)
  const cancelRef = useRef(false)
  const channelRef = useRef(`alerts_${Math.random().toString(36).slice(2)}`)

  const load = useCallback(async () => {
    // access_logs et alert_acks sont isolés par RLS ; seuls les seuils
    // de l'entreprise courante doivent être ciblés explicitement.
    const settingsQuery = companyId
      ? supabase
          .from('company_settings')
          .select('threshold_warning_h, threshold_critical_h, threshold_danger_h, zones')
          .eq('company_id', companyId)
          .maybeSingle()
      : Promise.resolve({ data: null })

    const [logsRes, acksRes, settingsRes] = await Promise.all([
      supabase
        .from('access_logs')
        .select('id, full_name, first_name, zone, checked_in_at')
        .eq('checkout_status', 'present'),
      supabase.from('alert_acks').select('log_id, alert_type'),
      settingsQuery,
    ])
    if (cancelRef.current) return

    let thresholds = DEFAULT_THRESHOLDS
    if (settingsRes.data) {
      const d = settingsRes.data as {
        threshold_warning_h: number
        threshold_critical_h: number
        threshold_danger_h: number
        zones: Array<{ name: string; isDanger?: boolean }>
      }
      const dangerZones = (d.zones ?? [])
        .filter((z) => z.isDanger)
        .map((z) => z.name)
      thresholds = {
        warningH: d.threshold_warning_h ?? 8,
        criticalH: d.threshold_critical_h ?? 12,
        dangerH: d.threshold_danger_h ?? 4,
        dangerZones: dangerZones.length > 0 ? dangerZones : ['Zone Dangereuse'],
      }
    }

    setAlerts(buildAlerts(logsRes.data ?? [], acksRes.data ?? [], thresholds))
    setLoading(false)
  }, [companyId])

  useEffect(() => {
    cancelRef.current = false
    load()
    const timer = setInterval(load, refreshIntervalMs)
    const ch = supabase
      .channel(channelRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_logs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_acks' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, load)
      .subscribe()
    return () => {
      cancelRef.current = true
      clearInterval(timer)
      supabase.removeChannel(ch)
    }
  }, [load, refreshIntervalMs])

  return { alerts, loading, refresh: load }
}
