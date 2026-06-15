import { useCallback, useEffect, useRef, useState } from 'react'

interface Options {
  /** Durée totale d'inactivité avant déconnexion (défaut 30 min). */
  timeoutMs?: number
  /** Délai d'avertissement avant la déconnexion (défaut 2 min). */
  warningMs?: number
  /** Appelé lorsque le délai d'inactivité total est atteint. */
  onIdle: () => void
  /** Désactive le minuteur (ex : utilisateur non connecté). */
  enabled?: boolean
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
]

/**
 * Déconnexion automatique après une période d'inactivité.
 *
 * Le minuteur se réinitialise à chaque interaction (throttlé à 1 s pour ne pas
 * solliciter le navigateur sur chaque `mousemove`). Un avertissement est exposé
 * `warningMs` avant l'échéance, avec un compte à rebours en secondes.
 */
export function useIdleTimer({
  timeoutMs = 30 * 60 * 1000,
  warningMs = 2 * 60 * 1000,
  onIdle,
  enabled = true,
}: Options) {
  const [warning, setWarning] = useState(false)
  const [remaining, setRemaining] = useState(Math.round(warningMs / 1000))

  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastReset = useRef(0)
  const onIdleRef = useRef(onIdle)
  onIdleRef.current = onIdle

  const clearTimers = useCallback(() => {
    if (warnTimer.current) clearTimeout(warnTimer.current)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (countdown.current) clearInterval(countdown.current)
    warnTimer.current = idleTimer.current = countdown.current = null
  }, [])

  const start = useCallback(() => {
    clearTimers()
    setWarning(false)
    setRemaining(Math.round(warningMs / 1000))

    warnTimer.current = setTimeout(() => {
      setWarning(true)
      let secs = Math.round(warningMs / 1000)
      setRemaining(secs)
      countdown.current = setInterval(() => {
        secs -= 1
        setRemaining(secs > 0 ? secs : 0)
      }, 1000)
    }, timeoutMs - warningMs)

    idleTimer.current = setTimeout(() => {
      clearTimers()
      onIdleRef.current()
    }, timeoutMs)
  }, [clearTimers, timeoutMs, warningMs])

  // Réinitialisation manuelle (bouton « Rester connecté »).
  const stayActive = useCallback(() => {
    lastReset.current = performance.now()
    start()
  }, [start])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      setWarning(false)
      return
    }

    start()

    const onActivity = () => {
      const now = performance.now()
      // Throttle : au plus une réinitialisation par seconde.
      if (now - lastReset.current < 1000) return
      lastReset.current = now
      start()
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true })
    }

    return () => {
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity)
      clearTimers()
    }
  }, [enabled, start, clearTimers])

  return { warning, remaining, stayActive }
}
