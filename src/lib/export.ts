import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'

export interface ExportColumn {
  header: string
  key: string
}

export async function exportToPdf(title: string, columns: ExportColumn[], rows: Record<string, string>[]) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(title, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 25)

  autoTable(doc, {
    startY: 32,
    head: [columns.map((col) => col.header)],
    body: rows.map((row) => columns.map((col) => row[col.key] ?? '')),
    headStyles: { fillColor: [212, 175, 55], textColor: [10, 10, 10] },
    styles: { fontSize: 9 },
  })

  doc.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`)
}

export async function exportToExcel(title: string, columns: ExportColumn[], rows: Record<string, string>[]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(title.slice(0, 31))

  sheet.columns = columns.map((col) => ({ header: col.header, key: col.key, width: 22 }))
  sheet.getRow(1).font = { bold: true }
  rows.forEach((row) => sheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}
