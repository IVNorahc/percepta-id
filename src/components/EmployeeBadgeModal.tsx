import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'
import { useSettings } from '../lib/settings'

export interface EmployeeBadge {
  id: string
  nom: string
  prenoms: string
  poste: string | null
  zoneAutorisee: string | null
  photoUrl: string | null
  badgeQrCode: string
}

function handlePrint(label: string) {
  const content = document.getElementById('emp-badge-content')
  if (!content) return
  const win = window.open('', '_blank', 'width=420,height=640,toolbar=0,menubar=0,scrollbars=0')
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Badge ${label}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white; display: flex; justify-content: center; align-items: flex-start;
      padding: 16px; min-height: 100vh;
    }
    @media print {
      @page { size: 86mm 135mm; margin: 4mm; }
      body { padding: 0; align-items: center; min-height: unset; }
    }
  </style>
</head>
<body>${content.outerHTML}</body>
</html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}

export default function EmployeeBadgeModal({
  data,
  onClose,
}: {
  data: EmployeeBadge
  onClose: () => void
}) {
  const { settings } = useSettings()
  const displayName = `${data.prenoms} ${data.nom}`.toUpperCase()

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-xs">
        <div
          id="emp-badge-content"
          style={{
            background: 'white',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ background: '#0F172A', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {settings.logoUrl && (
                <img
                  src={settings.logoUrl}
                  alt=""
                  style={{ height: 24, width: 24, objectFit: 'contain', borderRadius: 4, background: '#fff', flexShrink: 0 }}
                />
              )}
              <div style={{ color: '#FFFFFF', fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>
                {settings.companyName}
              </div>
            </div>
            <div style={{ color: '#64748B', fontSize: 10, marginTop: 2, letterSpacing: 0.5 }}>
              BADGE EMPLOYÉ
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0 }}>
              {data.photoUrl ? (
                <img
                  src={data.photoUrl}
                  alt="Photo"
                  style={{ width: 76, height: 96, objectFit: 'cover', borderRadius: 6, border: '1.5px solid #E2E8F0', display: 'block' }}
                />
              ) : (
                <div style={{ width: 76, height: 96, borderRadius: 6, border: '1.5px solid #E2E8F0', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 32 }}>
                  &#128100;
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A', lineHeight: 1.25, marginBottom: 6, wordBreak: 'break-word' }}>
                {displayName}
              </div>
              {data.poste && (
                <div style={{ color: '#475569', fontSize: 11, marginBottom: 8 }}>{data.poste}</div>
              )}
              {data.zoneAutorisee && (
                <div style={{ display: 'inline-block', borderRadius: 4, padding: '3px 8px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
                  {data.zoneAutorisee}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: '#E2E8F0', margin: '0 18px' }} />

          {/* QR */}
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <QRCodeSVG value={data.badgeQrCode} size={76} level="M" style={{ flexShrink: 0, display: 'block' }} />
            <div>
              <div style={{ color: '#94A3B8', fontSize: 8, letterSpacing: 0.8, marginBottom: 4 }}>
                BADGE DE POINTAGE
              </div>
              <div style={{ fontFamily: 'Courier New, Courier, monospace', fontWeight: 700, fontSize: 11, color: '#0F172A', letterSpacing: 0.3, wordBreak: 'break-all' }}>
                {data.badgeQrCode.slice(0, 18)}
              </div>
              <div style={{ color: '#94A3B8', fontSize: 8, marginTop: 6 }}>
                Scanner pour pointer l'entrée/sortie
              </div>
            </div>
          </div>

          <div style={{ background: '#F1F5F9', padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ color: '#94A3B8', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>
              BADGE NOMINATIF — NON TRANSFÉRABLE
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={() => handlePrint(data.badgeQrCode.slice(0, 8))}
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
