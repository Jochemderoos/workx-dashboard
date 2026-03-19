import { jsPDF } from 'jspdf'
import { loadWorkxLogo, drawWorkxLogo } from '@/lib/pdf'
import * as pdfjsLib from 'pdfjs-dist'

// Set worker source for pdfjs
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
}

export interface ExpensePDFItem {
  description: string
  date: string
  amount: number
  expenseType?: string | null
  kilometers?: number | null
  chargeToClient?: string | null
  attachmentUrl?: string | null
  attachmentName?: string | null
}

export interface ExpensePDFData {
  employeeName: string
  bankAccount: string
  holdingName?: string | null
  invoiceNumber?: string | null
  note?: string | null
  items: ExpensePDFItem[]
}

function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '').toUpperCase()
  return clean.replace(/(.{4})/g, '$1 ').trim()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

/**
 * Generate a PDF for an expense declaration.
 * Returns the jsPDF doc and suggested filename, or null on failure.
 */
export async function buildExpensePDF(data: ExpensePDFData): Promise<{ doc: jsPDF; fileName: string } | null> {
  const logoDataUrl = await loadWorkxLogo()

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const isHolding = !!data.holdingName

  let y = 20

  // === HEADER ===
  if (!isHolding) {
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)
    y = 30
  } else {
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(data.holdingName!, 15, y + 5)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Declaratieformulier', 15, y + 14)
    y = 45
  }

  // Date and invoice number on the right
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  const dateText = `Datum: ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`
  doc.text(dateText, pageWidth - 15, 25, { align: 'right' })

  if (data.invoiceNumber?.trim()) {
    doc.text(`Factuurnr: ${data.invoiceNumber.trim()}`, pageWidth - 15, 31, { align: 'right' })
  }

  // === TITLE ===
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(15, y, pageWidth - 15, y)
  y += 15

  if (!isHolding) {
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('DECLARATIEFORMULIER', 15, y)
    y += 15
  }

  // === PERSONAL INFO BOX ===
  const infoBoxHeight = data.invoiceNumber?.trim() ? 38 : 28
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(15, y, pageWidth - 30, infoBoxHeight, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('Naam medewerker:', 20, y + 10)
  doc.text('IBAN:', 20, y + 20)

  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.text(data.employeeName, 60, y + 10)
  doc.setFont('helvetica', 'normal')
  doc.text(formatIBAN(data.bankAccount), 60, y + 20)

  if (data.invoiceNumber?.trim()) {
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    doc.text('Factuurnummer:', 20, y + 30)
    doc.setFontSize(10)
    doc.setTextColor(30, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.text(data.invoiceNumber.trim(), 60, y + 30)
    doc.setFont('helvetica', 'normal')
  }

  y += infoBoxHeight + 12

  // === EXPENSE TABLE ===
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Kostenposten', 15, y)
  y += 8

  // Table header - different columns for Workx vs Holding
  const hasChargeColumn = !isHolding
  const colX = hasChargeColumn
    ? [15, 40, 105, 140, 175]
    : [15, 43, 128, 163]

  doc.setFillColor(249, 255, 133)
  doc.rect(15, y, pageWidth - 30, 8, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('Datum', colX[0] + 2, y + 5.5)
  doc.text('Omschrijving', colX[1] + 2, y + 5.5)
  if (hasChargeColumn) {
    doc.text('Doorbelasten', colX[2] + 2, y + 5.5)
    doc.text('Bedrag', colX[3] + 2, y + 5.5)
  } else {
    doc.text('Bedrag', colX[2] + 2, y + 5.5)
    doc.text('Bijlage', colX[3] + 2, y + 5.5)
  }

  y += 8

  // Table rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  const validItems = data.items.filter(i => i.description && i.date && i.amount > 0)
  validItems.forEach((item, index) => {
    const rowY = y + (index * 10)

    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250)
      doc.rect(15, rowY, pageWidth - 30, 10, 'F')
    }

    doc.setDrawColor(230, 230, 230)
    doc.line(15, rowY + 10, pageWidth - 15, rowY + 10)

    doc.setTextColor(50, 50, 50)
    doc.text(formatDate(item.date), colX[0] + 2, rowY + 6.5)

    let desc = item.description
    if (item.expenseType === 'reiskosten_auto' && item.kilometers) {
      desc = `${item.description} (${item.kilometers} km)`
    }
    const maxDescLen = hasChargeColumn ? 35 : 45
    desc = desc.length > maxDescLen ? desc.substring(0, maxDescLen) + '...' : desc
    doc.text(desc, colX[1] + 2, rowY + 6.5)

    if (hasChargeColumn) {
      if (item.chargeToClient) {
        const chargeText = item.chargeToClient.length > 18
          ? item.chargeToClient.substring(0, 15) + '...'
          : item.chargeToClient
        doc.text(chargeText, colX[2] + 2, rowY + 6.5)
      }
      doc.text(formatCurrency(item.amount), colX[3] + 2, rowY + 6.5)
    } else {
      doc.text(formatCurrency(item.amount), colX[2] + 2, rowY + 6.5)
      if (item.attachmentName) {
        doc.setTextColor(100, 100, 100)
        const attachName = item.attachmentName.length > 15
          ? item.attachmentName.substring(0, 12) + '...'
          : item.attachmentName
        doc.text(attachName, colX[3] + 2, rowY + 6.5)
      }
    }
  })

  y += validItems.length * 10 + 5

  // Total row
  const totalAmount = validItems.reduce((sum, item) => sum + item.amount, 0)
  doc.setFillColor(249, 255, 133)
  doc.rect(15, y, pageWidth - 30, 12, 'F')

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text('TOTAAL TE DECLAREREN:', 20, y + 8)
  doc.setFontSize(14)
  doc.text(formatCurrency(totalAmount), pageWidth - 20, y + 8, { align: 'right' })

  y += 20

  // === NOTES ===
  if (data.note?.trim()) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('Opmerkingen:', 15, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    const noteLines = doc.splitTextToSize(data.note, pageWidth - 30)
    doc.text(noteLines, 15, y)
    y += noteLines.length * 4 + 10
  }

  // === SIGNATURE AREA ===
  y = Math.max(y, pageHeight - 70)

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(15, y, pageWidth - 15, y)
  y += 15

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text('Handtekening:', 15, y)
  doc.text('Datum:', pageWidth / 2 + 10, y)

  y += 20
  doc.setDrawColor(150, 150, 150)
  doc.line(15, y, pageWidth / 2 - 10, y)
  doc.line(pageWidth / 2 + 10, y, pageWidth - 15, y)

  // === FOOTER ===
  if (!isHolding) {
    doc.setFillColor(80, 80, 80)
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Workx advocaten  \u2022  Herengracht 448, 1017 CA Amsterdam  \u2022  +31 (0)20 308 03 20  \u2022  info@workxadvocaten.nl',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    )
  }

  // === ADD ATTACHMENTS AS SEPARATE PAGES ===
  const attachmentsWithData = validItems.filter(item => item.attachmentUrl && item.attachmentUrl.startsWith('data:'))

  for (const item of attachmentsWithData) {
    if (!item.attachmentUrl) continue

    doc.addPage()
    let attachY = 20

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('BIJLAGE', 15, attachY)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`${item.description} - ${formatDate(item.date)} - ${formatCurrency(item.amount)}`, 15, attachY + 8)

    doc.setDrawColor(220, 220, 220)
    doc.line(15, attachY + 12, pageWidth - 15, attachY + 12)
    attachY += 25

    if (item.attachmentUrl.startsWith('data:image/')) {
      try {
        const maxWidth = pageWidth - 30
        const maxHeight = pageHeight - attachY - 20

        doc.addImage(
          item.attachmentUrl,
          item.attachmentUrl.includes('png') ? 'PNG' : 'JPEG',
          15,
          attachY,
          maxWidth,
          maxHeight,
          undefined,
          'MEDIUM'
        )
      } catch {
        doc.setFontSize(10)
        doc.setTextColor(150, 50, 50)
        doc.text(`Kon bijlage niet laden: ${item.attachmentName}`, 15, attachY)
      }
    } else if (item.attachmentUrl.startsWith('data:application/pdf')) {
      // Render PDF pages as images using pdfjs
      try {
        const base64 = item.attachmentUrl.split(',')[1]
        const binaryStr = atob(base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j)
        }

        const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise
        const numPages = pdfDoc.numPages

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (pageNum > 1) {
            // Add new page for subsequent PDF pages
            doc.addPage()
            attachY = 20

            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(30, 30, 30)
            doc.text(`BIJLAGE (pagina ${pageNum}/${numPages})`, 15, attachY)

            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(80, 80, 80)
            doc.text(`${item.description} - ${formatDate(item.date)} - ${formatCurrency(item.amount)}`, 15, attachY + 8)

            doc.setDrawColor(220, 220, 220)
            doc.line(15, attachY + 12, pageWidth - 15, attachY + 12)
            attachY += 25
          } else {
            // Update header for first page to show page count
            if (numPages > 1) {
              doc.setFontSize(8)
              doc.setTextColor(120, 120, 120)
              doc.text(`pagina 1/${numPages}`, pageWidth - 15, 20, { align: 'right' })
            }
          }

          const page = await pdfDoc.getPage(pageNum)
          const scale = 2 // Higher scale for better quality
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')!

          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise

          const imgData = canvas.toDataURL('image/jpeg', 0.85)
          const maxWidth = pageWidth - 30
          const maxHeight = pageHeight - attachY - 20
          const ratio = Math.min(maxWidth / viewport.width, maxHeight / viewport.height)
          const imgW = viewport.width * ratio
          const imgH = viewport.height * ratio

          doc.addImage(imgData, 'JPEG', 15, attachY, imgW, imgH, undefined, 'MEDIUM')
        }
      } catch (pdfError) {
        console.error('Error rendering PDF attachment:', pdfError)
        doc.setFontSize(10)
        doc.setTextColor(150, 50, 50)
        doc.text(`Kon PDF bijlage niet laden: ${item.attachmentName}`, 15, attachY)
      }
    }
  }

  const fileName = isHolding
    ? `Declaratie_${(data.holdingName || '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Declaratie_${data.employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

  return { doc, fileName }
}
