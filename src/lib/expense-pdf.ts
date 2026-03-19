import { jsPDF } from 'jspdf'
import { loadWorkxLogo, drawWorkxLogo } from '@/lib/pdf'
import { PDFDocument, rgb } from 'pdf-lib'

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
  createdAt?: string | null
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
  const pdfDate = data.createdAt ? new Date(data.createdAt) : new Date()

  let y = 15

  // === HEADER ===
  if (!isHolding) {
    // Dark header bar
    doc.setFillColor(45, 45, 45)
    doc.rect(0, 0, pageWidth, 32, 'F')

    // Lime accent line under header
    doc.setFillColor(249, 255, 133)
    doc.rect(0, 32, pageWidth, 1.2, 'F')

    // Logo in header — constrained height to prevent stretching
    const logoW = 30
    const logoH = logoW * 0.414
    const logoY = (32 - logoH) / 2
    drawWorkxLogo(doc, 12, logoY, logoW, logoDataUrl)

    // Title in header
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('DECLARATIEFORMULIER', 48, 15)

    // Date + invoice in header right-aligned
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 180)
    const dateText = pdfDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(dateText, pageWidth - 15, 14, { align: 'right' })
    if (data.invoiceNumber?.trim()) {
      doc.text(`Factuurnr: ${data.invoiceNumber.trim()}`, pageWidth - 15, 20, { align: 'right' })
    }

    y = 42
  } else {
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(data.holdingName!, 15, y + 5)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Declaratieformulier', 15, y + 14)

    // Date and invoice number on the right
    doc.setFontSize(9)
    doc.setTextColor(100, 100, 100)
    const dateText = `Datum: ${pdfDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`
    doc.text(dateText, pageWidth - 15, 20, { align: 'right' })
    if (data.invoiceNumber?.trim()) {
      doc.text(`Factuurnr: ${data.invoiceNumber.trim()}`, pageWidth - 15, 26, { align: 'right' })
    }

    y = 45
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
    ? [15, 40, 120, 150, 175]
    : [15, 43, 135, 170]

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
    const maxDescLen = hasChargeColumn ? 45 : 55
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

  // === ADD IMAGE ATTACHMENTS AS SEPARATE PAGES ===
  const imageAttachments = validItems.filter(item => item.attachmentUrl && item.attachmentUrl.startsWith('data:image/'))

  for (const item of imageAttachments) {
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

    try {
      const maxWidth = pageWidth - 30
      const maxHeight = pageHeight - attachY - 20

      // Get actual image dimensions to maintain aspect ratio
      const imgDims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = reject
        img.src = item.attachmentUrl!
      })

      // Scale to fit within maxWidth x maxHeight while keeping aspect ratio
      let imgW = imgDims.w
      let imgH = imgDims.h
      const scaleW = maxWidth / imgW
      const scaleH = maxHeight / imgH
      const scale = Math.min(scaleW, scaleH, 1) // Don't upscale
      imgW = imgW * scale
      imgH = imgH * scale

      doc.addImage(
        item.attachmentUrl,
        item.attachmentUrl.includes('png') ? 'PNG' : 'JPEG',
        15,
        attachY,
        imgW,
        imgH,
        undefined,
        'MEDIUM'
      )
    } catch {
      doc.setFontSize(10)
      doc.setTextColor(150, 50, 50)
      doc.text(`Kon bijlage niet laden: ${item.attachmentName}`, 15, attachY)
    }
  }

  const fileName = isHolding
    ? `Declaratie_${(data.holdingName || '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Declaratie_${data.employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

  // Merge PDF attachments using pdf-lib
  const pdfAttachments = validItems.filter(
    i => i.attachmentUrl && i.attachmentUrl.startsWith('data:application/pdf')
  )

  if (pdfAttachments.length > 0) {
    try {
      // Convert jsPDF output to pdf-lib document
      const jsPdfBytes = doc.output('arraybuffer')
      const mergedPdf = await PDFDocument.load(jsPdfBytes)
      let attachedCount = 0

      for (const item of pdfAttachments) {
        if (!item.attachmentUrl) continue
        try {
          const base64 = item.attachmentUrl.split(',')[1]
          if (!base64) {
            console.error('PDF attachment has no base64 data after comma split')
            continue
          }
          const binaryStr = atob(base64)
          const bytes = new Uint8Array(binaryStr.length)
          for (let j = 0; j < binaryStr.length; j++) {
            bytes[j] = binaryStr.charCodeAt(j)
          }

          const attachmentPdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const pages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices())
          pages.forEach(page => mergedPdf.addPage(page))
          attachedCount++
        } catch (attachErr) {
          console.error('Error merging PDF attachment:', item.attachmentName, attachErr)
          // Add a fallback page noting the attachment couldn't be embedded
          const failPage = mergedPdf.addPage()
          const { width, height } = failPage.getSize()
          failPage.drawText(`BIJLAGE: ${item.attachmentName || 'onbekend'}`, { x: 50, y: height - 80, size: 16, color: rgb(0.2, 0.2, 0.2) })
          failPage.drawText('Deze PDF-bijlage kon niet automatisch worden samengevoegd.', { x: 50, y: height - 110, size: 11, color: rgb(0.5, 0.5, 0.5) })
          failPage.drawText('Download de bijlage apart vanuit het declaratieformulier.', { x: 50, y: height - 130, size: 11, color: rgb(0.5, 0.5, 0.5) })
        }
      }

      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

      // Return a compatible object that can be saved
      return {
        doc: {
          save: (name: string) => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            a.click()
            URL.revokeObjectURL(url)
          }
        } as any,
        fileName,
      }
    } catch (mergeErr) {
      console.error('Error in PDF merge flow:', mergeErr)
      // Fall back to jsPDF without merged attachments
      return { doc, fileName }
    }
  }

  return { doc, fileName }
}
