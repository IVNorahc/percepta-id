import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ExportColumn {
  header: string
  key: string
}

export interface PdfExportOptions {
  title: string
  subtitle?: string
  columns: ExportColumn[]
  companyName?: string
  logoUrl?: string | null
}

// Charge une image (logo) et la convertit en PNG dataURL pour jsPDF.
// Retourne null si l'image est introuvable, illisible ou tainted (CORS).
async function loadLogoPng(
  url: string,
): Promise<{ dataUrl: string; w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(null)
      ctx.drawImage(img, 0, 0)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/png'), w, h })
      } catch {
        resolve(null) // canvas tainted
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function exportToPdf(options: PdfExportOptions, rows: Record<string, string>[]) {
  const { title, subtitle, columns, companyName, logoUrl } = options
  const brand = companyName?.trim() || 'Percepta ID'
  const doc = new jsPDF({ orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const genDate = new Date().toLocaleString('fr-FR')

  // Header strip
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageW, 30, 'F')

  // Logo de l'entreprise (si disponible et chargeable)
  let textX = 14
  if (logoUrl) {
    const logo = await loadLogoPng(logoUrl)
    if (logo) {
      const logoH = 16
      const logoW = Math.min(logoH * (logo.w / logo.h), 40)
      doc.addImage(logo.dataUrl, 'PNG', 14, 7, logoW, logoH)
      textX = 14 + logoW + 5
    }
  }

  // Nom de l'entreprise
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(59, 130, 246)
  doc.text(brand, textX, 13)

  // Title
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(title, textX, 24)

  // Subtitle aligned right (période)
  if (subtitle) {
    doc.setFontSize(8.5)
    doc.setTextColor(180, 185, 200)
    doc.text(subtitle, pageW - 14, 24, { align: 'right' })
  }

  autoTable(doc, {
    startY: 36,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => row[c.key] ?? '')),
    headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawPage: (data: any) => {
      doc.setFontSize(7)
      doc.setTextColor(150, 155, 165)
      doc.text(
        `Généré le ${genDate}  —  Page ${data.pageNumber}  —  Propulsé par Percepta ID`,
        pageW / 2,
        pageH - 5,
        { align: 'center' },
      )
    },
  })

  doc.save(`${title.toLowerCase().replace(/[\s/]+/g, '-')}.pdf`)
}

export function exportToCsv(title: string, columns: ExportColumn[], rows: Record<string, string>[]) {
  const sep = ';'
  const header = columns.map((c) => `"${c.header}"`).join(sep)
  const body = rows
    .map((row) => columns.map((c) => `"${(row[c.key] ?? '').replace(/"/g, '""')}"`).join(sep))
    .join('\n')

  // UTF-8 BOM ensures proper encoding in Excel
  const csv = '﻿' + header + '\n' + body
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.toLowerCase().replace(/[\s/]+/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
