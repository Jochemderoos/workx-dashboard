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
export interface PDFAttachmentDownload {
  blob: Blob
  fileName: string
}

export async function buildExpensePDF(data: ExpensePDFData): Promise<{ doc: jsPDF; fileName: string; pdfAttachments?: PDFAttachmentDownload[] } | null> {
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

  const fileName = isHolding
    ? `Declaratie_${(data.holdingName || '').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Declaratie_${data.employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

  // === Build PDF attachment downloads (always, outside try/catch) ===
  const pdfAttachmentItems = validItems.filter(
    i => i.attachmentUrl && i.attachmentUrl.startsWith('data:application/pdf')
  )
  const pdfAttachmentDownloads: PDFAttachmentDownload[] = []
  for (const item of pdfAttachmentItems) {
    if (!item.attachmentUrl) continue
    const base64 = item.attachmentUrl.split(',')[1]
    if (!base64) continue
    console.log(`[PDF] PDF bijlage gevonden: ${item.attachmentName}, base64 length: ${base64.length}`)
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let j = 0; j < binaryStr.length; j++) {
      bytes[j] = binaryStr.charCodeAt(j)
    }
    pdfAttachmentDownloads.push({
      blob: new Blob([bytes], { type: 'application/pdf' }),
      fileName: item.attachmentName || `bijlage-${pdfAttachmentDownloads.length + 1}.pdf`,
    })
  }

  // === MERGE ALL ATTACHMENTS INTO ONE PDF ===
  const imageAttachments = validItems.filter(
    i => i.attachmentUrl && i.attachmentUrl.startsWith('data:image/')
  )

  if (imageAttachments.length > 0 || pdfAttachmentItems.length > 0) {
    try {
      const jsPdfBytes = doc.output('arraybuffer')
      const mergedPdf = await PDFDocument.load(jsPdfBytes)

      // Add image attachments via pdf-lib (direct byte embedding, no canvas)
      for (const item of imageAttachments) {
        if (!item.attachmentUrl) continue
        try {
          const mimeHeader = item.attachmentUrl.substring(0, 40)
          const base64 = item.attachmentUrl.split(',')[1]
          console.log(`[PDF] Bijlage: ${item.attachmentName}, mime: ${mimeHeader}, base64 length: ${base64?.length || 0}`)

          if (!base64 || base64.length < 100) {
            console.error('[PDF] Bijlage data is leeg of te kort!')
            throw new Error('Bijlage data is leeg')
          }

          const binaryStr = atob(base64)
          const imgBytes = new Uint8Array(binaryStr.length)
          for (let j = 0; j < binaryStr.length; j++) {
            imgBytes[j] = binaryStr.charCodeAt(j)
          }
          console.log(`[PDF] Decoded bytes: ${imgBytes.length}, first bytes: ${imgBytes.slice(0, 4).join(',')}`)

          // Detect format: JPEG starts with FF D8, PNG starts with 89 50 4E 47
          const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50
          const isJpeg = imgBytes[0] === 0xFF && imgBytes[1] === 0xD8
          console.log(`[PDF] Format detectie: isPng=${isPng}, isJpeg=${isJpeg}`)

          let embeddedImg
          if (isPng) {
            embeddedImg = await mergedPdf.embedPng(imgBytes)
          } else if (isJpeg) {
            embeddedImg = await mergedPdf.embedJpg(imgBytes)
          } else {
            // Unknown format — convert via canvas as fallback
            console.log('[PDF] Onbekend formaat, canvas fallback...')
            const canvasBytes = await new Promise<Uint8Array>((resolve, reject) => {
              const img = new window.Image()
              img.onload = () => {
                const MAX_DIM = 1500
                let cw = img.naturalWidth, ch = img.naturalHeight
                if (cw > MAX_DIM || ch > MAX_DIM) {
                  const s = Math.min(MAX_DIM / cw, MAX_DIM / ch)
                  cw = Math.round(cw * s); ch = Math.round(ch * s)
                }
                const canvas = document.createElement('canvas')
                canvas.width = cw; canvas.height = ch
                const ctx = canvas.getContext('2d')!
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, cw, ch)
                ctx.drawImage(img, 0, 0, cw, ch)
                canvas.toBlob(
                  blob => {
                    if (!blob) return reject(new Error('toBlob failed'))
                    blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject)
                  },
                  'image/jpeg', 0.85
                )
              }
              img.onerror = () => reject(new Error('Image load failed'))
              img.src = item.attachmentUrl!
            })
            embeddedImg = await mergedPdf.embedJpg(canvasBytes)
          }

          const imgDims = embeddedImg.scale(1)
          console.log(`[PDF] Embedded: ${imgDims.width}x${imgDims.height}`)

          // Create A4 page and fit image with margins
          const page = mergedPdf.addPage([595.28, 841.89]) // A4 in points
          const margin = 42 // ~15mm
          const titleHeight = 70 // space for title text
          const maxW = 595.28 - margin * 2
          const maxH = 841.89 - margin - titleHeight

          const scaleW = maxW / imgDims.width
          const scaleH = maxH / imgDims.height
          const scale = Math.min(scaleW, scaleH, 1)
          const drawW = imgDims.width * scale
          const drawH = imgDims.height * scale

          // Title
          page.drawText('BIJLAGE', { x: margin, y: 841.89 - 45, size: 14, color: rgb(0.12, 0.12, 0.12) })
          page.drawText(
            `${item.description} - ${formatDate(item.date)} - ${formatCurrency(item.amount)}`,
            { x: margin, y: 841.89 - 62, size: 10, color: rgb(0.3, 0.3, 0.3) }
          )

          // Image — centered horizontally
          const imgX = margin + (maxW - drawW) / 2
          const imgY = 841.89 - titleHeight - drawH
          page.drawImage(embeddedImg, { x: imgX, y: imgY, width: drawW, height: drawH })
        } catch (imgErr) {
          console.error('Error embedding image:', item.attachmentName, imgErr)
          const failPage = mergedPdf.addPage()
          const { height } = failPage.getSize()
          failPage.drawText(`BIJLAGE: ${item.attachmentName || 'onbekend'}`, { x: 50, y: height - 80, size: 16, color: rgb(0.2, 0.2, 0.2) })
          failPage.drawText('Deze afbeelding kon niet worden ingebed in de PDF.', { x: 50, y: height - 110, size: 11, color: rgb(0.5, 0.5, 0.5) })
        }
      }

      // Render PDF attachments as images via PDF.js and embed them
      for (const item of pdfAttachmentItems) {
        if (!item.attachmentUrl) continue
        try {
          const base64 = item.attachmentUrl.split(',')[1]
          if (!base64) continue
          const binaryStr = atob(base64)
          const pdfBytes = new Uint8Array(binaryStr.length)
          for (let j = 0; j < binaryStr.length; j++) {
            pdfBytes[j] = binaryStr.charCodeAt(j)
          }

          const pdfjsLib = await import('pdfjs-dist')
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
          const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise

          for (let p = 1; p <= pdfDoc.numPages; p++) {
            const pdfPage = await pdfDoc.getPage(p)
            const viewport = pdfPage.getViewport({ scale: 2 })

            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            const ctx = canvas.getContext('2d')!
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise

            const jpegBytes = await new Promise<Uint8Array>((resolve, reject) => {
              canvas.toBlob(
                blob => {
                  if (!blob) return reject(new Error('toBlob failed'))
                  blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject)
                },
                'image/jpeg', 0.90
              )
            })

            const embeddedImg = await mergedPdf.embedJpg(jpegBytes)
            const imgDims = embeddedImg.scale(1)
            const page = mergedPdf.addPage([595.28, 841.89])
            const margin = 20
            const maxW = 595.28 - margin * 2
            const maxH = 841.89 - margin * 2
            const scale = Math.min(maxW / imgDims.width, maxH / imgDims.height, 1)
            const drawW = imgDims.width * scale
            const drawH = imgDims.height * scale
            page.drawImage(embeddedImg, {
              x: (595.28 - drawW) / 2,
              y: (841.89 - drawH) / 2,
              width: drawW,
              height: drawH,
            })
          }
          pdfDoc.destroy()
          console.log(`[PDF] PDF bijlage gerenderd: ${item.attachmentName}`)
        } catch (pdfErr) {
          console.error('[PDF] Error rendering PDF attachment:', item.attachmentName, pdfErr)
          // Fallback: add info page
          const failPage = mergedPdf.addPage()
          const { height } = failPage.getSize()
          failPage.drawText(`BIJLAGE: ${item.attachmentName || 'onbekend'}`, { x: 50, y: height - 80, size: 14, color: rgb(0.2, 0.2, 0.2) })
          failPage.drawText('Kon niet worden ingebed. Download apart via Bijlage-knop.', { x: 50, y: height - 110, size: 10, color: rgb(0.5, 0.5, 0.5) })
          const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr)
          failPage.drawText(`Fout: ${errMsg.substring(0, 80)}`, { x: 50, y: height - 130, size: 8, color: rgb(0.7, 0.2, 0.2) })
        }
      }

      const mergedBytes = await mergedPdf.save()
      const blob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' })

      return {
        doc: {
          save: (name: string) => {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = name
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          },
        } as any,
        fileName,
        pdfAttachments: pdfAttachmentDownloads.length > 0 ? pdfAttachmentDownloads : undefined,
      }
    } catch (mergeErr) {
      console.error('Error in PDF merge flow:', mergeErr)
      // Fall back to jsPDF doc, but STILL include PDF attachments
      return { doc, fileName, pdfAttachments: pdfAttachmentDownloads.length > 0 ? pdfAttachmentDownloads : undefined }
    }
  }

  return { doc, fileName, pdfAttachments: pdfAttachmentDownloads.length > 0 ? pdfAttachmentDownloads : undefined }
}
