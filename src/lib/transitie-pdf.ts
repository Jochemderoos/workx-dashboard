// Gedeelde PDF-renderer voor transitievergoeding-documenten.
// Eén plek voor de Workx huisstijl zodat single + vergelijking exact matchen.

import type { jsPDF } from 'jspdf'
import { drawWorkxLogo } from './pdf'

// === Workx huisstijl ===
const COLOR = {
  text: [26, 26, 26] as [number, number, number],
  textMid: [88, 88, 88] as [number, number, number],
  textMuted: [144, 144, 144] as [number, number, number],
  divider: [220, 220, 220] as [number, number, number],
  workxYellow: [249, 255, 133] as [number, number, number],
  accentDark: [26, 26, 26] as [number, number, number],
  subtleBg: [250, 250, 250] as [number, number, number],
}

const MARGIN = 22

export interface SingleData {
  mode: 'single'
  isEN: boolean
  form: any
  result: any
  logoDataUrl: string | null
  formatDate: (s: string) => string
  formatCurrency: (n: number) => string
}

export interface CompareData {
  mode: 'compare'
  isEN: boolean
  form: any
  result: any
  liveResult: any
  whatIfMultiplier: number
  whatIfEndDate: string
  logoDataUrl: string | null
  formatDate: (s: string) => string
  formatCurrency: (n: number) => string
}

function setColor(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2])
}

function setFill(doc: jsPDF, c: [number, number, number]) {
  doc.setFillColor(c[0], c[1], c[2])
}

function setStroke(doc: jsPDF, c: [number, number, number]) {
  doc.setDrawColor(c[0], c[1], c[2])
}

// === Header: logo links, addressering rechts uitgelijnd ===
function drawHeader(doc: jsPDF, opts: {
  logoDataUrl: string | null
  employerName: string
  employeeName: string
  partyLabel: string | null
  isEN: boolean
}) {
  const pageWidth = doc.internal.pageSize.getWidth()

  // Logo (groter voor presence)
  drawWorkxLogo(doc, 0, 0, 72, opts.logoDataUrl)

  // Adresseringblok rechts — labels en values op netjes uitgelijnde kolommen
  const valueX = pageWidth - MARGIN
  const labelX = valueX - 48
  let hy = 14

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')

  const addRow = (label: string, value: string) => {
    setColor(doc, COLOR.textMuted)
    doc.text(label, labelX, hy)
    setColor(doc, COLOR.text)
    doc.text(value, valueX, hy, { align: 'right' })
    hy += 5.5
  }

  addRow(opts.isEN ? 'To' : 'Aan', opts.employerName || '—')
  addRow(opts.isEN ? 'Date' : 'Datum', new Date().toLocaleDateString(opts.isEN ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }))
  addRow(opts.isEN ? 'Re' : 'Betreft', opts.employeeName || '—')
  if (opts.partyLabel) addRow(opts.isEN ? 'For' : 'T.b.v.', opts.partyLabel)

  // Subtiele dunne lijn onder header
  setStroke(doc, COLOR.divider)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, 42, pageWidth - MARGIN, 42)

  // Tagline klein rechts onder lijn
  setColor(doc, COLOR.textMuted)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'italic')
  doc.text(opts.isEN ? 'Generated with the Workx App' : 'Gemaakt met de Workx App', pageWidth - MARGIN, 47, { align: 'right' })
}

// === Titel: kleine pretitle + grote titel + subtitle ===
function drawTitle(doc: jsPDF, opts: {
  pretitle: string
  title: string
  subtitle: string | null
  startY: number
  titleSize?: number
}): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2

  setColor(doc, COLOR.textMuted)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(opts.pretitle.toUpperCase(), MARGIN, opts.startY)

  setColor(doc, COLOR.text)
  let size = opts.titleSize ?? 22
  doc.setFont('helvetica', 'bold')
  // Autoshrink: kleinere font tot titel past
  doc.setFontSize(size)
  while (doc.getTextWidth(opts.title) > contentWidth && size > 12) {
    size -= 1
    doc.setFontSize(size)
  }
  doc.text(opts.title, MARGIN, opts.startY + size * 0.45 + 4)

  let y = opts.startY + size * 0.45 + 4
  if (opts.subtitle) {
    setColor(doc, COLOR.textMid)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(opts.subtitle, MARGIN, y + 7)
    y += 7
  }
  return y + 10
}

// === Section header — subtle uppercase letter-spaced ===
function drawSectionLabel(doc: jsPDF, label: string, y: number): number {
  setColor(doc, COLOR.textMuted)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text(label.toUpperCase(), MARGIN, y, { charSpace: 0.6 })
  return y + 6
}

// === Key-value rij ===
function drawKvRow(doc: jsPDF, label: string, value: string, y: number, opts: { bold?: boolean; mutedValue?: boolean } = {}): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  setColor(doc, COLOR.textMid)
  doc.text(label, MARGIN, y)
  setColor(doc, opts.mutedValue ? COLOR.textMuted : COLOR.text)
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
  doc.text(value, pageWidth - MARGIN, y, { align: 'right' })
  return y + 6
}

function drawDivider(doc: jsPDF, y: number, color = COLOR.divider): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  setStroke(doc, color)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  return y + 4
}

// === Gele resultaat-band — minimal, baseline aligned ===
function drawResultBand(doc: jsPDF, opts: {
  label: string
  amount: string
  y: number
  variant?: boolean
}): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2
  const h = 22
  setFill(doc, opts.variant ? [254, 243, 199] : COLOR.workxYellow)
  doc.roundedRect(MARGIN, opts.y, contentWidth, h, 2, 2, 'F')
  // Label + bedrag op gedeelde baseline (visueel gecentreerd in band)
  const baseline = opts.y + 14
  setColor(doc, COLOR.text)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text(opts.label, MARGIN + 8, baseline, { charSpace: 0.4 })
  doc.setFontSize(18)
  doc.text(opts.amount, pageWidth - MARGIN - 8, baseline, { align: 'right' })
  return opts.y + h
}

// === Footer + disclaimer gepind aan onderkant ===
function drawFooter(doc: jsPDF, disclaimerText: string) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  // Footer-tekst (geen donkere balk meer — strak grijs)
  const footerText = 'Workx Advocaten   ·   Herengracht 448, 1017 CA Amsterdam   ·   +31 (0)20 308 03 20   ·   info@workxadvocaten.nl'
  const footerY = pageHeight - 14

  // Disclaimer-tekst boven footer
  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'normal')
  setColor(doc, COLOR.textMuted)
  const discLines = doc.splitTextToSize(disclaimerText, contentWidth)
  const discBlockH = discLines.length * 3
  const discY = footerY - discBlockH - 6
  doc.text(discLines, MARGIN, discY)

  // Dunne lijn onder disclaimer (boven footer-tekst)
  setStroke(doc, COLOR.divider)
  doc.setLineWidth(0.2)
  doc.line(MARGIN, footerY - 5, pageWidth - MARGIN, footerY - 5)

  setColor(doc, COLOR.textMid)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.text(footerText, pageWidth / 2, footerY, { align: 'center' })
}

// === Belangrijkste functie: render hele document ===
export function renderTransitiePdf(doc: jsPDF, data: SingleData | CompareData) {
  const { isEN, form, result, logoDataUrl, formatDate, formatCurrency } = data
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - MARGIN * 2
  const isVariant = data.mode === 'compare'

  const partyLabel = form.clientParty === 'werknemer' ? (isEN ? 'employee' : 'werknemer')
    : form.clientParty === 'werkgever' ? (isEN ? 'employer' : 'werkgever')
    : form.clientParty === 'beide' ? (isEN ? 'both parties' : 'beide partijen')
    : null

  drawHeader(doc, {
    logoDataUrl,
    employerName: form.employerName || '',
    employeeName: form.employeeName || '',
    partyLabel,
    isEN,
  })

  // Titel
  const docTitle = isVariant
    ? (isEN ? 'Comparison: transition vs settlement payment' : 'Vergelijking transitie- en beëindigingsvergoeding')
    : (isEN ? 'Severance payment' : 'Transitievergoeding')
  const subtitleParts: string[] = []
  if (form.employeeName) subtitleParts.push(form.employeeName)
  if (form.employerName) subtitleParts.push(form.employerName)

  let y = drawTitle(doc, {
    pretitle: isEN ? 'Calculation' : 'Berekening',
    title: docTitle,
    subtitle: subtitleParts.join('  ·  ') || null,
    startY: 64,
  })
  y += 6

  // Dienstverband
  y = drawSectionLabel(doc, isEN ? 'Employment' : 'Dienstverband', y)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  setColor(doc, COLOR.text)
  doc.text(`${formatDate(form.startDate)}   —   ${formatDate(form.endDate)}`, MARGIN, y)
  setColor(doc, COLOR.textMid)
  doc.setFontSize(9)
  const duurStr = isEN
    ? `${result.years} years, ${result.months} months${result.days > 0 ? `, ${result.days} days` : ''}`
    : `${result.years} jaar, ${result.months} maanden${result.days > 0 ? `, ${result.days} dagen` : ''}`
  doc.text(duurStr, MARGIN, y + 5)
  y += 14

  // Loongegevens — alleen rijen die waarde hebben
  y = drawSectionLabel(doc, isEN ? 'Salary (gross per month)' : 'Loon (bruto per maand)', y)
  const base = parseFloat(form.salary) || 0
  const vac = form.vacationMoney ? base * (parseFloat(form.vacationPercent) / 100) : 0
  const thirteenth = form.thirteenthMonth ? base / 12 : 0
  const bonus = result.bonusPerMonth || 0
  const overtimeM = (parseFloat(form.overtime) || 0)
  const otherM = (parseFloat(form.other) || 0)

  y = drawKvRow(doc, isEN ? 'Base salary' : 'Basissalaris', formatCurrency(base), y)
  if (vac > 0) y = drawKvRow(doc, `${isEN ? 'Vacation allowance' : 'Vakantiegeld'} (${form.vacationPercent}%)`, formatCurrency(vac), y)
  if (thirteenth > 0) y = drawKvRow(doc, isEN ? '13th month (1/12)' : '13e maand (1/12)', formatCurrency(thirteenth), y)
  if (bonus > 0) y = drawKvRow(doc, isEN ? 'Bonus (avg per month)' : 'Bonus (gemiddeld p/m)', formatCurrency(bonus), y)
  if (overtimeM > 0) y = drawKvRow(doc, isEN ? 'Overtime per month' : 'Overwerk p/m', formatCurrency(overtimeM), y)
  if (otherM > 0) y = drawKvRow(doc, isEN ? 'Other allowances' : 'Overige emolumenten p/m', formatCurrency(otherM), y)

  y += 1
  y = drawDivider(doc, y)
  y = drawKvRow(doc, isEN ? 'Total gross per month' : 'Totaal bruto per maand', formatCurrency(result.totalSalary), y, { bold: true })

  if (form.isPensionAge) {
    y += 2
    y = drawKvRow(doc, isEN ? 'AOW age reached' : 'AOW-leeftijd bereikt', isEN ? 'Yes' : 'Ja', y, { mutedValue: true })
  }

  // Single mode: één gele band
  if (data.mode === 'single') {
    y += 10
    const bandTop = y
    drawResultBand(doc, {
      label: (isEN ? 'Severance payment' : 'Transitievergoeding').toUpperCase(),
      amount: formatCurrency(result.amount),
      y: bandTop,
    })
    y = bandTop + 22 + 4

    setColor(doc, COLOR.textMid)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(isEN ? 'Calculated per Art. 7:673 Dutch Civil Code (1/3 monthly salary per year of service)' : 'Berekend conform art. 7:673 BW (1/3 maandsalaris per dienstjaar)', MARGIN, y)
    y += 5

    if (result.maxApplied) {
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'italic')
      setColor(doc, COLOR.textMuted)
      doc.text(isEN
        ? `Statutory maximum applied: ${formatCurrency(result.maxUsed)} (calculated: ${formatCurrency(result.amountBeforeMax)})`
        : `Wettelijk maximum toegepast: ${formatCurrency(result.maxUsed)} (berekend: ${formatCurrency(result.amountBeforeMax)})`, MARGIN, y)
    }
  }

  // Compare mode: zacht kader rondom variant-sectie + 2 banden + verschilregel
  if (data.mode === 'compare') {
    const { liveResult, whatIfMultiplier } = data
    const tvAmount = (data.liveResult || data.result).amount
    const variantAmount = liveResult.amount * whatIfMultiplier
    const diff = variantAmount - tvAmount
    const effEnd = data.whatIfEndDate || form.endDate
    const endChanged = effEnd !== form.endDate
    const variantSubtitle = [
      `factor ${whatIfMultiplier.toFixed(2)} ×`,
      endChanged ? `einddatum ${formatDate(effEnd)}` : null,
    ].filter(Boolean).join('  ·  ')

    y += 10
    // Zacht kader om variant-sectie — strak passend rond de twee banden + verschil
    const frameTop = y
    const labelH = 6
    const gapAfterLabel = 4
    const bandH = 22
    const gapBeforeDiff = 5
    const diffH = diff !== 0 ? 5 : 0
    const padTop = 6
    const padBottom = 6
    const frameHeight = padTop + labelH + gapAfterLabel + bandH + (diff !== 0 ? gapBeforeDiff + diffH : 0) + padBottom

    setFill(doc, [252, 251, 244])
    setStroke(doc, [228, 222, 190])
    doc.setLineWidth(0.3)
    doc.roundedRect(MARGIN, frameTop, contentWidth, frameHeight, 3, 3, 'FD')

    y = frameTop + padTop + 3
    // Sectie-label binnen kader
    setColor(doc, COLOR.textMuted)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text((isEN ? 'COMPARISON  ·  VARIANT' : 'VERGELIJKING  ·  VARIANT'), MARGIN + 6, y, { charSpace: 0.6 })
    y += gapAfterLabel + 2

    const colW = (contentWidth - 16 - 6) / 2
    const leftX = MARGIN + 8
    const rightX = leftX + colW + 6

    // Linker band: wettelijke TV
    setFill(doc, COLOR.workxYellow)
    doc.roundedRect(leftX, y, colW, bandH, 2, 2, 'F')
    // Rechter band: variant (warm amber)
    setFill(doc, [254, 243, 199])
    doc.roundedRect(rightX, y, colW, bandH, 2, 2, 'F')

    setColor(doc, COLOR.text)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text('TRANSITIEVERGOEDING', leftX + 6, y + 6, { charSpace: 0.4 })
    doc.text('BEËINDIGINGSVERGOEDING', rightX + 6, y + 6, { charSpace: 0.4 })

    // Klein "obv variant"-regel onder beëindiging-label
    setColor(doc, [120, 90, 0])
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(6.5)
    doc.text(`obv ${variantSubtitle}`, rightX + 6, y + 10)

    // Wettelijke TV: kleine ondertitel
    setColor(doc, [110, 110, 60])
    doc.setFontSize(6.5)
    doc.text(isEN ? 'statutory · factor 1 ×' : 'wettelijk · factor 1 ×', leftX + 6, y + 10)

    // Bedragen rechts
    setColor(doc, COLOR.text)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(formatCurrency(tvAmount), leftX + colW - 6, y + 18, { align: 'right' })
    doc.text(formatCurrency(variantAmount), rightX + colW - 6, y + 18, { align: 'right' })

    y += bandH + gapBeforeDiff

    if (diff !== 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(diff > 0 ? 21 : 185, diff > 0 ? 128 : 28, diff > 0 ? 61 : 28)
      doc.text(`${isEN ? 'Difference' : 'Verschil'}: ${diff > 0 ? '+' : ''}${formatCurrency(diff)}`, rightX + colW - 6, y + 2, { align: 'right' })
    }

    // Voetnoot buiten het kader, klein
    y = frameTop + frameHeight + 5
    setColor(doc, COLOR.textMid)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.text(isEN ? 'TV per Art. 7:673 BW (1/3 monthly salary per year of service). A factor > 1 results in a settlement payment.' : 'TV conform art. 7:673 BW (1/3 maandsalaris per dienstjaar). Een factor > 1 maakt het een beëindigingsvergoeding.', MARGIN, y)
  }

  // Disclaimer + footer pin
  const disclaimer = isEN
    ? `Disclaimer: This calculation is indicative. No rights can be derived from it. The actual amount may differ due to collective agreement provisions or special circumstances. Statutory maximum 2026: € 102,000 or annual salary if higher.`
    : `Disclaimer: deze berekening is indicatief. Aan deze berekening kunnen geen rechten worden ontleend. Het daadwerkelijke bedrag kan afwijken door CAO-bepalingen of bijzondere omstandigheden. Wettelijk maximum 2026: € 102.000 of jaarsalaris indien hoger.`
  drawFooter(doc, disclaimer)
}
