import { jsPDF } from 'jspdf'

// Workx Brand Colors
const COLORS = {
  darkGray: '#333333',
  yellow: '#FFED4A',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#666666',
  textDark: '#2D2D2D',
  textLight: '#888888',
}

interface PDFOptions {
  title: string
  subtitle?: string
  recipient?: string
  date?: string
  subject?: string
}

// Draw the Workx logo on PDF - centered text, matching dashboard style
export function drawWorkxLogo(doc: jsPDF, x: number, y: number, width: number = 50) {
  const height = width * 0.55
  const cornerRadius = 4

  // Yellow background (#f9ff85)
  doc.setFillColor(249, 255, 133)
  doc.roundedRect(x, y, width, height, cornerRadius, cornerRadius, 'F')

  const centerX = x + width / 2

  // "Workx" text - large, bold, centered
  doc.setTextColor(30, 30, 30)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(width * 0.38)
  doc.text('Workx', centerX, y + height * 0.52, { align: 'center' })

  // "ADVOCATEN" text - centered with letter spacing
  doc.setFontSize(width * 0.11)
  doc.setFont('helvetica', 'normal')
  doc.setCharSpace(2.5)
  doc.text('ADVOCATEN', centerX, y + height * 0.78, { align: 'center' })
  doc.setCharSpace(0)
}

// Create premium PDF header with Workx branding
export function createPDFHeader(doc: jsPDF, options: PDFOptions) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Draw the logo
  drawWorkxLogo(doc, 15, 15, 55)

  // Letter info on the right side
  let infoY = 20
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  if (options.recipient) {
    doc.setTextColor(100, 100, 100)
    doc.text('Per email aan:', 80, infoY)
    doc.setTextColor(51, 51, 51)
    doc.text(options.recipient, 115, infoY)
    infoY += 6
  }

  if (options.date) {
    doc.setTextColor(100, 100, 100)
    doc.text('Datum:', 80, infoY)
    doc.setTextColor(51, 51, 51)
    doc.text(options.date, 115, infoY)
    infoY += 6
  }

  if (options.subject) {
    doc.setTextColor(100, 100, 100)
    doc.text('Betreft:', 80, infoY)
    doc.setTextColor(51, 51, 51)
    doc.text(options.subject, 115, infoY)
    infoY += 6
  }

  // "Gemaakt met de Workx App" tagline
  doc.setTextColor(150, 150, 150)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text('Gemaakt met de Workx App', 15, 50)

  // Elegant divider line
  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.3)
  doc.line(15, 55, pageWidth - 15, 55)

  return 65 // Return Y position after header
}

// Create premium PDF footer
export function createPDFFooter(doc: jsPDF) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 15

  // Footer bar
  doc.setFillColor(100, 100, 100)
  doc.rect(0, footerY - 5, pageWidth, 20, 'F')

  // Footer text
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
    pageWidth / 2,
    footerY + 2,
    { align: 'center' }
  )
}

// Create section title
export function createSectionTitle(doc: jsPDF, title: string, subtitle: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setTextColor(100, 100, 100)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.text(title.toUpperCase(), 15, y)

  doc.setTextColor(45, 45, 45)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle.toUpperCase(), 15, y + 10)

  return y + 20
}

// Create data row
export function createDataRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  options: { bold?: boolean; color?: string } = {}
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const valueX = pageWidth - 15

  doc.setTextColor(100, 100, 100)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(label, 15, y)

  if (options.color) {
    const colors: Record<string, [number, number, number]> = {
      green: [0, 150, 0],
      red: [200, 50, 50],
      orange: [200, 120, 0],
    }
    const [r, g, b] = colors[options.color] || [45, 45, 45]
    doc.setTextColor(r, g, b)
  } else {
    doc.setTextColor(45, 45, 45)
  }

  doc.setFont('helvetica', options.bold ? 'bold' : 'normal')
  doc.text(value, valueX, y, { align: 'right' })

  return y + 8
}

// Create highlighted result box
export function createResultBox(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  color: 'yellow' | 'green' | 'purple' = 'yellow'
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const boxWidth = pageWidth - 30
  const boxHeight = 25

  // Background colors
  const bgColors: Record<string, [number, number, number]> = {
    yellow: [255, 237, 74],
    green: [74, 222, 128],
    purple: [167, 139, 250],
  }

  const textColors: Record<string, [number, number, number]> = {
    yellow: [45, 45, 45],
    green: [20, 60, 20],
    purple: [50, 20, 80],
  }

  const [bgR, bgG, bgB] = bgColors[color]
  const [textR, textG, textB] = textColors[color]

  doc.setFillColor(bgR, bgG, bgB)
  doc.roundedRect(15, y, boxWidth, boxHeight, 4, 4, 'F')

  doc.setTextColor(textR, textG, textB)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(label, 25, y + 10)

  doc.setFontSize(16)
  doc.text(value, 25, y + 20)

  return y + boxHeight + 10
}

// Create disclaimer text
export function createDisclaimer(doc: jsPDF, text: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setTextColor(130, 130, 130)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')

  const lines = doc.splitTextToSize(text, pageWidth - 30)
  doc.text(lines, 15, y)

  return y + lines.length * 4 + 5
}

// Format currency
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

// Format date
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Format short date
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}
