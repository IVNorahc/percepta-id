import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

export type AlertType = 'over_8h' | 'over_12h' | 'zone_danger_4h' | 'id_expired'
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
  dangerZones: ['Zone dangereuse'],
}

export function formatDurationH(hours: number): string {
  const totalMin = Math.floor(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// ── Dates des pièces d'identité ───────────────────────────────────────────────
// expiry_date est stocké en texte (issu de l'OCR) : formats variés possibles.

export function parseFlexibleDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const str = s.trim()
  // ISO : YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3])
    return isNaN(d.getTime()) ? null : d
  }
  // JJ/MM/AAAA, JJ-MM-AAAA, JJ.MM.AAAA (format OCR français)
  m = str.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/)
  if (m) {
    let year = +m[3]
    if (year < 100) year += 2000
    const d = new Date(year, +m[2] - 1, +m[1])
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Retourne true si la pièce est expirée (date d'expiration strictement avant aujourd'hui).
export function isIdExpired(expiry: string | null | undefined): boolean {
  const d = parseFlexibleDate(expiry)
  if (!d) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

interface PresentLog {
  id: string
  full_name: string
  first_name: string | null
  zone: string
  checked_in_at: string
  expiry_date?: string | null
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

// Alertes "pièce expirée" pour les personnes présentes dont la pièce a expiré.
export function buildExpiredIdAlerts(
  logs: PresentLog[],
  acks: Array<{ log_id: string; alert_type: string }>,
): ComputedAlert[] {
  const ackSet = new Set(acks.map((a) => `${a.log_id}:${a.alert_type}`))
  const now = Date.now()
  const results: ComputedAlert[] = []

  for (const log of logs) {
    const exp = parseFlexibleDate(log.expiry_date)
    if (!exp) continue
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (exp >= today) continue

    const type: AlertType = 'id_expired'
    results.push({
      logId: log.id,
      type,
      severity: 'critical',
      label: `Pièce expirée le ${formatDateFr(exp)}`,
      fullName: log.full_name,
      firstName: log.first_name,
      zone: log.zone,
      checkedInAt: log.checked_in_at,
      hoursOnSite: (now - new Date(log.checked_in_at).getTime()) / 3_600_000,
      isAcked: ackSet.has(`${log.id}:${type}`),
    })
  }
  return results
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
        .select('id, full_name, first_name, zone, checked_in_at, expiry_date')
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
        dangerZones: dangerZones.length > 0 ? dangerZones : ['Zone dangereuse'],
      }
    }

    const logs = logsRes.data ?? []
    const acks = acksRes.data ?? []
    const merged = [...buildAlerts(logs, acks, thresholds), ...buildExpiredIdAlerts(logs, acks)]
    merged.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
      return b.hoursOnSite - a.hoursOnSite
    })
    setAlerts(merged)
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
