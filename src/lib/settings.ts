import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

export interface ZoneConfig {
  name: string
  color: 'red' | 'blue' | 'green' | 'orange' | 'gray'
  isDanger: boolean
}

export interface CompanySettings {
  companyName: string
  logoUrl: string | null
  siteAddress: string | null
  phone: string | null
  email: string | null
  zones: ZoneConfig[]
  thresholdWarningH: number
  thresholdCriticalH: number
  thresholdDangerH: number
}

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Percepta ID',
  logoUrl: null,
  siteAddress: null,
  phone: null,
  email: null,
  zones: [
    { name: 'Zone A', color: 'blue', isDanger: false },
    { name: 'Zone B', color: 'green', isDanger: false },
    { name: 'Zone C', color: 'orange', isDanger: false },
    { name: 'Zone Dangereuse', color: 'red', isDanger: true },
  ],
  thresholdWarningH: 8,
  thresholdCriticalH: 12,
  thresholdDangerH: 4,
}

function rowToSettings(row: Record<string, unknown>): CompanySettings {
  return {
    companyName: (row.company_name as string) || DEFAULT_SETTINGS.companyName,
    logoUrl: (row.logo_url as string | null) ?? null,
    siteAddress: (row.site_address as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    zones: ((row.zones as ZoneConfig[] | null) ?? DEFAULT_SETTINGS.zones),
    thresholdWarningH: (row.threshold_warning_h as number) ?? 8,
    thresholdCriticalH: (row.threshold_critical_h as number) ?? 12,
    thresholdDangerH: (row.threshold_danger_h as number) ?? 4,
  }
}

export function useSettings() {
  const { companyId } = useAuth()
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!companyId) {
      // Super-admin (sans entreprise) ou profil pas encore chargé → valeurs par défaut.
      setSettings(DEFAULT_SETTINGS)
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle()
    if (data) setSettings(rowToSettings(data as Record<string, unknown>))
    setLoading(false)
  }, [companyId])

  const save = useCallback(
    async (updates: Partial<CompanySettings>): Promise<string | null> => {
      if (!companyId) return 'Aucune entreprise associée à ce compte.'
      const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (updates.companyName !== undefined) row.company_name = updates.companyName
      if (updates.logoUrl !== undefined) row.logo_url = updates.logoUrl
      if (updates.siteAddress !== undefined) row.site_address = updates.siteAddress
      if (updates.phone !== undefined) row.phone = updates.phone
      if (updates.email !== undefined) row.email = updates.email
      if (updates.zones !== undefined) row.zones = updates.zones
      if (updates.thresholdWarningH !== undefined) row.threshold_warning_h = updates.thresholdWarningH
      if (updates.thresholdCriticalH !== undefined) row.threshold_critical_h = updates.thresholdCriticalH
      if (updates.thresholdDangerH !== undefined) row.threshold_danger_h = updates.thresholdDangerH

      const { error } = await supabase
        .from('company_settings')
        .upsert({ company_id: companyId, ...row }, { onConflict: 'company_id' })

      if (!error) {
        setSettings((s) => ({ ...s, ...updates }))
        return null
      }
      return error.message
    },
    [companyId],
  )

  useEffect(() => {
    load()
  }, [load])

  return { settings, loading, save, refresh: load }
}
