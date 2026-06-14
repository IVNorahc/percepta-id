import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Scanner QR réutilisable. Ouvre la caméra arrière au montage, appelle onScan
// une seule fois par lecture, et libère la caméra au démontage.
// Le parent contrôle l'arrêt en démontant le composant (rendu conditionnel).
export default function QrScanner({
  onScan,
  onError,
}: {
  onScan: (text: string) => void
  onError?: () => void
}) {
  const regionId = useRef(`qr-${Math.random().toString(36).slice(2)}`)
  const onScanRef = useRef(onScan)
  const onErrorRef = useRef(onError)
  onScanRef.current = onScan
  onErrorRef.current = onError
  const processing = useRef(false)

  useEffect(() => {
    const html5 = new Html5Qrcode(regionId.current)
    let active = true

    html5
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText) => {
          if (processing.current) return
          processing.current = true
          onScanRef.current(decodedText)
        },
        () => {
          /* échecs de décodage par frame — ignorés */
        },
      )
      .catch(() => {
        if (active) onErrorRef.current?.()
      })

    return () => {
      active = false
      try {
        if (html5.isScanning) {
          html5
            .stop()
            .then(() => html5.clear())
            .catch(() => {})
        } else {
          html5.clear()
        }
      } catch {
        /* ignore */
      }
    }
  }, [])

  return (
    <div
      id={regionId.current}
      className="w-full overflow-hidden [&_video]:w-full [&_video]:object-cover"
    />
  )
}
