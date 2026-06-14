import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useSettings } from '../lib/settings'
import StorageImage from './StorageImage'

export interface BadgeData {
  logId: string
  fullName: string
  firstName: string | null
  zone: string
  checkedInAt: string
  photoUrl: string | null
}

export function generateBadgeNumber(logId: string, checkedInAt: string): string {
  const d = new Date(checkedInAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const suffix = logId.replace(/-/g, '').slice(-6, -3).toUpperCase()
  return `PID-${y}${m}${day}-${suffix}`
}

// Palette hex par nom de couleur (les zones stockent un nom : blue/green/orange/red/gray).
const BADGE_PALETTE: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  green: { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  orange: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  red: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  gray: { bg: '#F8FAFC', text: '#475569', border: '#CBD5E1' },
}

function handlePrint(badgeNumber: string) {
  const content = document.getElementById('badge-card-content')
  if (!content) return
  const win = window.open('', '_blank', 'width=420,height=640,toolbar=0,menubar=0,scrollbars=0')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Badge ${badgeNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
      min-height: 100vh;
    }
    @media print {
      @page { size: 86mm 135mm; margin: 4mm; }
      body { padding: 0; align-items: center; min-height: unset; }
    }
  </style>
</head>
<body>
  ${content.outerHTML}
</body>
</html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print(); }, 300)
}

interface BadgeModalProps {
  data: BadgeData
  onClose: () => void
}

export default function BadgeModal({ data, onClose }: BadgeModalProps) {
  const { settings } = useSettings()
  const badgeNumber = generateBadgeNumber(data.logId, data.checkedInAt)
  const zoneConf = settings.zones.find((z) => z.name === data.zone)
  const zc = BADGE_PALETTE[zoneConf?.color ?? 'gray'] ?? BADGE_PALETTE.gray
  const displayName = data.firstName
    ? `${data.firstName} ${data.fullName}`.toUpperCase()
    : data.fullName.toUpperCase()
  const entryDate = new Date(data.checkedInAt)
  const entryDateStr = entryDate.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const entryTimeStr = entryDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xs">

        {/* Badge card — inline styles only for reliable print */}
        <div
          id="badge-card-content"
          style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          }}
        >
          {/* Header — white-label : logo + nom de l'entreprise */}
          <div style={{ background: '#0F172A', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StorageImage
                src={settings.logoUrl}
                alt=""
                style={{
                  height: 24,
                  width: 24,
                  objectFit: 'contain',
                  borderRadius: 4,
                  background: '#fff',
                  flexShrink: 0,
                }}
                fallback={null}
              />
              <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>
                {settings.companyName}
              </div>
            </div>
            <div style={{ color: '#64748B', fontSize: 10, marginTop: 2, letterSpacing: 0.5 }}>
              ACCÈS CONTRÔLÉ
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            {/* Photo */}
            <div style={{ flexShrink: 0 }}>
              <StorageImage
                src={data.photoUrl}
                alt="Photo"
                style={{
                  width: 76,
                  height: 96,
                  objectFit: 'cover',
                  borderRadius: 6,
                  border: '1.5px solid #E2E8F0',
                  display: 'block',
                }}
                fallback={
                  <div style={{
                    width: 76,
                    height: 96,
                    borderRadius: 6,
                    border: '1.5px solid #E2E8F0',
                    background: '#F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94A3B8',
                    fontSize: 32,
                  }}>
                    &#128100;
                  </div>
                }
              />
            </div>

            {/* Identity info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 700,
                fontSize: 14,
                color: '#0F172A',
                lineHeight: 1.25,
                marginBottom: 8,
                wordBreak: 'break-word',
              }}>
                {displayName}
              </div>
              <div style={{
                display: 'inline-block',
                borderRadius: 4,
                padding: '3px 8px',
                background: zc.bg,
                color: zc.text,
                border: `1px solid ${zc.border}`,
                fontSize: 10,
                fontWeight: 700,
                marginBottom: 10,
                letterSpacing: 0.3,
              }}>
                {data.zone}
              </div>
              <div style={{ color: '#64748B', fontSize: 10, lineHeight: 1.4, marginTop: 2 }}>
                Heure d'entrée
              </div>
              <div style={{ fontWeight: 700, color: '#0F172A', fontSize: 15, lineHeight: 1.3 }}>
                {entryTimeStr}
              </div>
              <div style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                {entryDateStr}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#E2E8F0', margin: '0 18px' }} />

          {/* QR code + Badge number */}
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <QRCodeSVG
              value={data.logId}
              size={76}
              level="M"
              style={{ flexShrink: 0, display: 'block' }}
            />
            <div>
              <div style={{ color: '#94A3B8', fontSize: 8, letterSpacing: 0.8, marginBottom: 4 }}>
                N° DE BADGE
              </div>
              <div style={{
                fontFamily: 'Courier New, Courier, monospace',
                fontWeight: 700,
                fontSize: 13,
                color: '#0F172A',
                letterSpacing: 0.5,
              }}>
                {badgeNumber}
              </div>
              <div style={{ color: '#94A3B8', fontSize: 8, marginTop: 6, letterSpacing: 0.3 }}>
                Scanner pour vérifier l'accès
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: '#F1F5F9', padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>
              BADGE D'ACCÈS TEMPORAIRE — NON TRANSFÉRABLE
            </div>
          </div>
        </div>

        {/* Action buttons (screen only, not printed) */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => handlePrint(badgeNumber)}
            className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-sombre transition-colors"
          >
            Imprimer le badge
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-white/20 px-4 py-2.5 text-sm text-slate-300 hover:border-white/40 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
