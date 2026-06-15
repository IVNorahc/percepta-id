import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ComputedAlert } from './alerts'

// Envoie un email aux responsables de l'entreprise lorsqu'une alerte se
// déclenche pour la première fois.
//
// Déduplication : on « réserve » l'envoi en insérant une ligne
// (log_id, alert_type) dans alert_notifications. La contrainte UNIQUE fait
// échouer tout insert concurrent → un seul client envoie l'email. Si l'envoi
// échoue, on supprime la réservation pour permettre une nouvelle tentative.
export function useAlertNotifier(alerts: ComputedAlert[]) {
  const { companyId } = useAuth()
  const processed = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!companyId || alerts.length === 0) return

    const claimAndSend = async (alert: ComputedAlert) => {
      const key = `${alert.logId}:${alert.type}`
      if (processed.current.has(key)) return
      processed.current.add(key) // optimiste : évite les doublons pendant l'async

      // 1. Réservation (échoue si déjà notifié → on n'envoie pas).
      const { error: claimError } = await supabase.from('alert_notifications').insert({
        company_id: companyId,
        log_id: alert.logId,
        alert_type: alert.type,
      })
      if (claimError) return // conflit unique ou RLS : déjà pris en charge

      // 2. Envoi de l'email.
      const { error: sendError } = await supabase.functions.invoke('send-alert-notification', {
        body: {
          companyId,
          alert: {
            type: alert.type,
            label: alert.label,
            fullName: alert.fullName,
            zone: alert.zone,
            checkedInAt: alert.checkedInAt,
          },
        },
      })

      // 3. En cas d'échec : on libère la réservation pour réessayer plus tard.
      if (sendError) {
        processed.current.delete(key)
        await supabase
          .from('alert_notifications')
          .delete()
          .eq('log_id', alert.logId)
          .eq('alert_type', alert.type)
      }
    }

    for (const alert of alerts) void claimAndSend(alert)
  }, [alerts, companyId])
}
