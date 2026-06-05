'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
// jsPDF wordt dynamic geïmporteerd in de PDF-handler — scheelt ~200KB in initial bundle
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import {
  drawWorkxLogo,
  loadWorkxLogo,
  createPDFHeader,
  createPDFFooter,
  createSectionTitle,
  createDataRow,
  createResultBox,
  createDisclaimer,
  formatCurrency as formatPDFCurrency,
  formatDate as formatPDFDate,
} from '@/lib/pdf'

// Maximum transitievergoeding 2024/2025
const MAX_TRANSITIE_2024 = 94000
const MAX_TRANSITIE_2025 = 98000
const MAX_TRANSITIE_2026 = 102000

interface SavedCalculation {
  id: string
  createdAt: string
  employerName: string
  employeeName: string
  startDate: string
  endDate: string
  salary: number
  vacationMoney: boolean
  vacationPercent: number
  thirteenthMonth: boolean
  bonusType: 'none' | 'fixed' | 'average'
  bonusFixed: number
  bonusYear1: number
  bonusYear2: number
  bonusYear3: number
  bonusOther: number
  overtime: number
  other: number
  totalSalary: number
  yearlySalary: number
  amount: number
  amountBeforeMax: number
  years: number
  months: number
  days?: number
  totalMonths?: number
  isPensionAge: boolean
  notes?: string | null
  multiplier?: number | null
}

interface FormState {
  employerName: string
  employeeName: string
  startDate: string
  endDate: string
  salary: string
  vacationMoney: boolean
  vacationPercent: string
  thirteenthMonth: boolean
  bonusType: 'none' | 'fixed' | 'average'
  bonusFixed: string
  bonusYear1: string
  bonusYear2: string
  bonusYear3: string
  bonusOther: string
  overtime: string
  other: string
  isPensionAge: boolean
  pensionDate: string
  notes: string
  multiplier: string
}

const initialForm: FormState = {
  employerName: '',
  employeeName: '',
  startDate: '',
  endDate: '',
  salary: '',
  vacationMoney: true,
  vacationPercent: '8',
  thirteenthMonth: false,
  bonusType: 'none',
  bonusFixed: '',
  bonusYear1: '',
  bonusYear2: '',
  bonusYear3: '',
  bonusOther: '',
  overtime: '',
  other: '',
  isPensionAge: false,
  pensionDate: '',
  notes: '',
  multiplier: '1',
}

export default function TransitiePage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [result, setResult] = useState<{
    years: number
    months: number
    days: number
    totalMonths: number
    amount: number
    amountBeforeMax: number
    totalSalary: number
    yearlySalary: number
    bonusPerMonth: number
    maxApplied: boolean
    maxUsed: number
  } | null>(null)
  const [savedCalculations, setSavedCalculations] = useState<SavedCalculation[]>([])
  const [listSearch, setListSearch] = useState('')
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [showCompareModal, setShowCompareModal] = useState(false)
  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 3) next.add(id) // max 3
      return next
    })
  }
  const [editingId, setEditingId] = useState<string | null>(null)

  // Load saved calculations from API
  useEffect(() => {
    fetch('/api/transitie')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedCalculations(data)
        }
      })
      .catch(err => console.error('Error fetching calculations:', err))
  }, [])

  // Calculate bonus per month based on type
  const calculateBonusPerMonth = () => {
    if (form.bonusType === 'none') return 0
    if (form.bonusType === 'fixed') return parseFloat(form.bonusFixed) || 0

    // Average bonus calculation
    const year1 = parseFloat(form.bonusYear1) || 0
    const year2 = parseFloat(form.bonusYear2) || 0
    const year3 = parseFloat(form.bonusYear3) || 0
    const bonusOther = parseFloat(form.bonusOther) || 0
    const totalBonus = year1 + year2 + year3 + bonusOther

    if (totalBonus === 0) return 0

    // Calculate months employed
    if (!form.startDate || !form.endDate) return totalBonus / 36

    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    const msPerMonth = 1000 * 60 * 60 * 24 * 30.44
    const monthsEmployed = Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerMonth))

    // Use minimum of 36 months or actual months employed
    const divisor = Math.min(36, monthsEmployed)
    return totalBonus / divisor
  }

  const calculate = () => {
    if (!form.startDate || !form.endDate || !form.salary) {
      return toast.error('Vul alle verplichte velden in')
    }

    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    if (end <= start) return toast.error('Einddatum moet na startdatum')

    // Calculate total months including partial months (pro rata per dag)
    let fullMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    // Remaining days after the last full month boundary
    const tempDate = new Date(start)
    tempDate.setMonth(tempDate.getMonth() + fullMonths)
    if (tempDate > end) {
      fullMonths--
      tempDate.setMonth(tempDate.getMonth() - 1)
    }
    const remainingDays = (end.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24)
    // Days in the partial month (the month after the last full month)
    const partialMonthStart = new Date(tempDate)
    const partialMonthEnd = new Date(partialMonthStart)
    partialMonthEnd.setMonth(partialMonthEnd.getMonth() + 1)
    const daysInPartialMonth = (partialMonthEnd.getTime() - partialMonthStart.getTime()) / (1000 * 60 * 60 * 24)
    const partialFraction = daysInPartialMonth > 0 ? remainingDays / daysInPartialMonth : 0

    const totalMonths = fullMonths + partialFraction
    const years = Math.floor(fullMonths / 12)
    const months = fullMonths % 12
    const extraDays = Math.round(remainingDays)

    // Calculate salary components
    const base = parseFloat(form.salary)
    const vacation = form.vacationMoney ? base * (parseFloat(form.vacationPercent) / 100) : 0
    const thirteenth = form.thirteenthMonth ? base / 12 : 0 // 1/12 conform Besluit loonbegrip
    const bonusPerMonth = calculateBonusPerMonth()
    const overtime = parseFloat(form.overtime) || 0
    const other = parseFloat(form.other) || 0

    const totalSalary = base + vacation + thirteenth + bonusPerMonth + overtime + other
    const yearlySalary = totalSalary * 12

    // Transitievergoeding = 1/3 maandsalaris per jaar (naar rato)
    let amountBeforeMax = (totalSalary / 3) * (totalMonths / 12)

    // AOW-cap: als werknemer AOW-leeftijd heeft bereikt, is de transitievergoeding
    // maximaal het loon dat de werknemer zou ontvangen tot AOW-datum (art. 7:673 lid 4 BW)
    let pensionCap = Infinity
    if (form.isPensionAge && form.pensionDate) {
      const pension = new Date(form.pensionDate)
      if (pension > end) {
        const msToAOW = pension.getTime() - end.getTime()
        const monthsToAOW = msToAOW / (1000 * 60 * 60 * 24 * 30.44)
        pensionCap = totalSalary * monthsToAOW
      } else {
        pensionCap = 0
      }
    }

    // Determine maximum based on end date year
    const endYear = end.getFullYear()
    let statutoryMax = MAX_TRANSITIE_2026
    if (endYear <= 2024) statutoryMax = MAX_TRANSITIE_2024
    else if (endYear === 2025) statutoryMax = MAX_TRANSITIE_2025

    // Maximum is the HIGHER of: statutory max OR yearly salary
    const maxUsed = Math.max(statutoryMax, yearlySalary)
    let maxApplied = amountBeforeMax > maxUsed
    let amount = maxApplied ? maxUsed : amountBeforeMax

    // AOW-cap kan lager zijn dan het wettelijk maximum
    if (pensionCap < amount) {
      amount = Math.max(0, pensionCap)
      maxApplied = true
    }

    setResult({
      years,
      months,
      days: extraDays,
      totalMonths,
      amount: Math.round(amount * 100) / 100,
      amountBeforeMax: Math.round(amountBeforeMax * 100) / 100,
      totalSalary: Math.round(totalSalary * 100) / 100,
      yearlySalary: Math.round(yearlySalary * 100) / 100,
      bonusPerMonth: Math.round(bonusPerMonth * 100) / 100,
      maxApplied,
      maxUsed: Math.round(maxUsed * 100) / 100,
    })
    toast.success('Berekend')
  }

  const saveCalculation = async () => {
    if (!result) return

    const calculationData = {
      employerName: form.employerName,
      employeeName: form.employeeName,
      startDate: form.startDate,
      endDate: form.endDate,
      salary: parseFloat(form.salary),
      vacationMoney: form.vacationMoney,
      vacationPercent: parseFloat(form.vacationPercent),
      thirteenthMonth: form.thirteenthMonth,
      bonusType: form.bonusType,
      bonusFixed: parseFloat(form.bonusFixed) || 0,
      bonusYears: {
        year1: parseFloat(form.bonusYear1) || 0,
        year2: parseFloat(form.bonusYear2) || 0,
        year3: parseFloat(form.bonusYear3) || 0,
      },
      bonusOther: parseFloat(form.bonusOther) || 0,
      overtime: parseFloat(form.overtime) || 0,
      other: parseFloat(form.other) || 0,
      totalSalary: result.totalSalary,
      yearlySalary: result.yearlySalary,
      amount: result.amount,
      amountBeforeMax: result.amountBeforeMax,
      years: result.years,
      months: result.months,
      days: result.days,
      totalMonths: result.totalMonths,
      isPensionAge: form.isPensionAge,
      notes: form.notes?.trim() || null,
      multiplier: parseFloat(form.multiplier) || 1,
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/transitie/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calculationData)
        })
        if (!res.ok) throw new Error('Kon niet bijwerken')
        const updated = await res.json()
        setSavedCalculations(prev => prev.map(c => c.id === editingId ? updated : c))
        setEditingId(null)
        toast.success('Berekening bijgewerkt')
      } else {
        const res = await fetch('/api/transitie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calculationData)
        })
        if (!res.ok) throw new Error('Kon niet opslaan')
        const newCalc = await res.json()
        setSavedCalculations(prev => [newCalc, ...prev])
        toast.success('Berekening opgeslagen')
      }
    } catch (error) {
      console.error('Error saving calculation:', error)
      toast.error('Opslaan mislukt')
    }
  }

  const loadCalculation = (calc: SavedCalculation) => {
    setForm({
      employerName: calc.employerName || '',
      employeeName: calc.employeeName,
      startDate: calc.startDate,
      endDate: calc.endDate,
      salary: calc.salary.toString(),
      vacationMoney: calc.vacationMoney,
      vacationPercent: calc.vacationPercent.toString(),
      thirteenthMonth: calc.thirteenthMonth,
      bonusType: calc.bonusType,
      bonusFixed: calc.bonusFixed.toString(),
      bonusYear1: calc.bonusYear1.toString(),
      bonusYear2: calc.bonusYear2.toString(),
      bonusYear3: calc.bonusYear3.toString(),
      bonusOther: (calc.bonusOther || 0).toString(),
      overtime: calc.overtime.toString(),
      other: calc.other.toString(),
      isPensionAge: calc.isPensionAge,
      pensionDate: (calc as any).pensionDate || '',
      notes: calc.notes || '',
      multiplier: (calc.multiplier ?? 1).toString(),
    })
    setResult({
      years: calc.years,
      months: calc.months,
      days: calc.days || 0,
      totalMonths: calc.totalMonths || (calc.years * 12 + calc.months),
      amount: calc.amount,
      amountBeforeMax: calc.amountBeforeMax || calc.amount,
      totalSalary: calc.totalSalary,
      yearlySalary: calc.yearlySalary || calc.totalSalary * 12,
      bonusPerMonth:
        calc.bonusType === 'fixed'
          ? calc.bonusFixed
          : (calc.bonusYear1 + calc.bonusYear2 + calc.bonusYear3 + (calc.bonusOther || 0)) / 36,
      maxApplied: calc.amount !== (calc.amountBeforeMax || calc.amount),
      maxUsed: Math.max(MAX_TRANSITIE_2026, calc.yearlySalary || calc.totalSalary * 12),
    })
    setEditingId(calc.id)
    toast.success('Berekening geladen')
  }

  const deleteCalculation = async (id: string) => {
    try {
      const res = await fetch(`/api/transitie/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Kon niet verwijderen')

      setSavedCalculations(prev => prev.filter(c => c.id !== id))
      if (editingId === id) {
        setEditingId(null)
        reset()
      }
      toast.success('Berekening verwijderd')
    } catch (error) {
      console.error('Error deleting calculation:', error)
      toast.error('Verwijderen mislukt')
    }
  }

  const reset = () => {
    setForm(initialForm)
    setResult(null)
    setEditingId(null)
  }

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const downloadPDF = async (lang: 'nl' | 'en' = 'nl') => {
    if (!result) return
    const isEN = lang === 'en'

    // Pre-load the logo image
    const logoDataUrl = await loadWorkxLogo()

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2

    // === HEADER SECTIE ===
    // Draw official Workx logo (flush top-left)
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    // Header info rechts van logo
    const infoX = 60
    const infoValueX = 95
    let hy = 10
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(isEN ? 'To:' : 'Aan:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(form.employerName || '-', infoValueX, hy)
    hy += 7
    doc.setTextColor(120, 120, 120)
    doc.text(isEN ? 'Date:' : 'Datum:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(new Date().toLocaleDateString(isEN ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), infoValueX, hy)
    hy += 7
    doc.setTextColor(120, 120, 120)
    doc.text(isEN ? 'Re:' : 'Betreft:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(form.employeeName || (isEN ? 'Employee' : 'Werknemer'), infoValueX, hy)

    // Tagline
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(isEN ? 'Generated with the Workx App' : 'Gemaakt met de Workx App', margin, 48)

    // Divider lijn
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.4)
    doc.line(margin, 53, pageWidth - margin, 53)

    // === TITEL SECTIE ===
    let y = 65
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(isEN ? 'CALCULATION OF THE' : 'BEREKENING VAN DE', margin, y)
    doc.setTextColor(35, 35, 35)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text(isEN ? 'SEVERANCE PAYMENT' : 'TRANSITIEVERGOEDING', margin, y + 10)

    // === DIENSTVERBAND SECTIE ===
    y = 95
    doc.setFillColor(250, 250, 250)
    doc.roundedRect(margin, y - 5, contentWidth, 22, 3, 3, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const col1 = margin + 8
    const col2 = margin + 65
    const col3 = margin + 125

    doc.setTextColor(100, 100, 100)
    doc.text(isEN ? 'Start date' : 'Datum in dienst', col1, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(formatDate(form.startDate), col1, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(isEN ? 'End date' : 'Datum uit dienst', col2, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(formatDate(form.endDate), col2, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(isEN ? 'Length of service' : 'Dienstverband', col3, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(isEN ? `${result.years} years, ${result.months} months${result.days > 0 ? ` and ${result.days} days` : ''}` : `${result.years} jaar, ${result.months} maanden${result.days > 0 ? ` en ${result.days} dagen` : ''}`, col3, y + 11)

    // === SALARIS COMPONENTEN ===
    y = 130
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text(isEN ? 'Salary components' : 'Salariscomponenten', margin, y)

    y += 10
    const labelX = margin
    const valueX = pageWidth - margin

    const addDataRow = (label: string, value: string, highlight = false) => {
      if (highlight) {
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, y - 4, contentWidth, 8, 'F')
      }
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(label, labelX, y)
      doc.setTextColor(35, 35, 35)
      doc.setFont('helvetica', highlight ? 'bold' : 'normal')
      doc.text(value, valueX, y, { align: 'right' })
      y += 9
    }

    addDataRow(isEN ? 'Gross monthly salary' : 'Bruto maandsalaris', formatCurrency(parseFloat(form.salary)))
    addDataRow(isEN ? 'Vacation allowance' : 'Vakantiegeld', form.vacationMoney ? `${isEN ? 'Yes' : 'Ja'} (${form.vacationPercent}%)` : (isEN ? 'No' : 'Nee'))
    addDataRow(isEN ? '13th month' : '13e maand', form.thirteenthMonth ? `${isEN ? 'Yes' : 'Ja'} (8,3%)` : (isEN ? 'No' : 'Nee'))
    addDataRow(isEN ? 'Overtime per month' : 'Overwerk per maand', form.overtime ? formatCurrency(parseFloat(form.overtime)) : '—')
    addDataRow(isEN ? 'Bonus per month' : 'Bonus per maand', result.bonusPerMonth > 0 ? formatCurrency(result.bonusPerMonth) : '—')
    addDataRow(isEN ? 'Other allowances' : 'Overige emolumenten', form.other ? formatCurrency(parseFloat(form.other)) : '—')
    y += 2
    addDataRow(isEN ? 'Total gross monthly salary' : 'Totaal bruto maandsalaris', formatCurrency(result.totalSalary), true)
    y += 2
    addDataRow(isEN ? 'Reached pension/retirement age' : 'Pensioen-/AOW-leeftijd bereikt', form.isPensionAge ? (isEN ? 'Yes' : 'Ja') : (isEN ? 'No' : 'Nee'))

    // === RESULTAAT BOX ===
    y += 12
    const boxHeight = 28
    doc.setFillColor(249, 255, 133) // Workx geel
    doc.roundedRect(margin, y, contentWidth, boxHeight, 4, 4, 'F')

    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(isEN ? 'Severance payment' : 'Transitievergoeding', margin + 12, y + 12)

    doc.setFontSize(18)
    doc.text(formatCurrency(result.amount), pageWidth - margin - 12, y + 18, { align: 'right' })

    y += boxHeight + 6
    if (result.maxApplied) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text(isEN
        ? `Statutory maximum applied: ${formatCurrency(result.maxUsed)} (calculated amount: ${formatCurrency(result.amountBeforeMax)})`
        : `Wettelijk maximum toegepast: ${formatCurrency(result.maxUsed)} (berekend bedrag: ${formatCurrency(result.amountBeforeMax)})`, margin, y)
      y += 8
    }

    // === DISCLAIMER ===
    y += 8
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 130, 130)
    const disclaimer = isEN
      ? `Disclaimer: This calculation is indicative. No rights can be derived from this calculation. The actual severance payment may differ due to collective agreement provisions or special circumstances. Legal basis: Art. 7:673 Dutch Civil Code. Maximum 2024: €94,000 | 2025: €98,000 | 2026: €102,000, or annual salary if higher.`
      : `Disclaimer: Deze berekening is indicatief. Aan deze berekening kunnen geen rechten worden ontleend. De daadwerkelijke transitievergoeding kan afwijken door CAO-bepalingen of bijzondere omstandigheden. Wettelijke grondslag: Art. 7:673 BW. Maximum 2024: €94.000 | 2025: €98.000 | 2026: €102.000, of jaarsalaris indien hoger.`
    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth)
    doc.text(disclaimerLines, margin, y)

    // === CONTACT ===
    y += disclaimerLines.length * 3.5 + 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text(isEN ? 'Questions? Contact one of our employment law specialists.' : 'Vragen? Neem contact op met één van onze arbeidsrecht specialisten.', margin, y)

    // === FOOTER ===
    const footerY = pageHeight - 14
    doc.setFillColor(80, 80, 80)
    doc.rect(0, footerY, pageWidth, 12, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text('Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl', pageWidth / 2, footerY + 7, { align: 'center' })

    const pdfBlob = doc.output('blob')
    window.open(URL.createObjectURL(pdfBlob), '_blank')
  }

  // Get calculations for current employee (filter by name if provided)
  const employeeCalculations = form.employeeName
    ? savedCalculations.filter(
        (c) => c.employeeName.toLowerCase() === form.employeeName.toLowerCase()
      )
    : []

  return (
    <div className="max-w-6xl space-y-8 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-[5%] w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero — titel + stats + formule */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent p-5 sm:p-7">
        <div className="absolute top-0 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/20 flex items-center justify-center">
              <Icons.calculator className="text-purple-300" size={22} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Transitievergoeding</h1>
              <p className="text-sm text-white/60">Bereken de wettelijke transitievergoeding voor één of meerdere scenario's.</p>
            </div>
          </div>

          {/* Inhoudelijke toelichting — formule + wat telt mee voor bruto loon */}
          <div className="mt-5 space-y-3">
            {/* Formule strip */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-black/20 border border-purple-500/20">
              <span className="text-2xl flex-shrink-0">📐</span>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-purple-300 font-semibold mb-1">Wettelijke formule (art. 7:673 BW)</p>
                <p className="text-sm text-white/80 leading-relaxed">
                  <span className="text-purple-300 font-bold">⅓ bruto maandsalaris</span> per gewerkt dienstjaar, naar rato voor restmaanden/dagen.
                  Maximum 2026: <span className="text-purple-300 font-bold">€ 102.000</span> of het jaarsalaris inclusief emolumenten — het hoogste van beide.
                </p>
              </div>
            </div>

            {/* Wat telt mee / niet — twee kolommen */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold flex items-center gap-2">
                  <span>⚖️</span> Wat is "bruto maandsalaris"?
                  <span className="text-white/30 normal-case tracking-normal font-normal">
                    — Besluit loonbegrip vergoeding aanzegtermijn en transitievergoeding (Stb. 2014, 538)
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
                {/* TELT MEE */}
                <div className="p-4">
                  <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">✓</span>
                    Telt mee
                  </p>
                  <ul className="space-y-1.5 text-xs text-white/75">
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Bruto basissalaris</strong> per maand</span></li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Vakantietoeslag</strong> (8% wettelijk minimum, of CAO-percentage) — meegerekend per maand</span></li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Vaste 13e maand</strong> / structurele eindejaarsuitkering (1/12)</span></li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Vaste contractuele toeslagen</strong> (ploegen, persoonlijke toeslag, etc.)</span></li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Overwerk</strong> — gemiddeld over <em>laatste 12 maanden</em>, mits structureel</span></li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">•</span><span><strong className="text-white">Bonus / winstdeling / provisie</strong> — gemiddeld over <em>laatste 36 maanden</em></span></li>
                  </ul>
                </div>
                {/* TELT NIET MEE */}
                <div className="p-4">
                  <p className="text-xs font-bold text-red-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">✗</span>
                    Telt niet mee
                  </p>
                  <ul className="space-y-1.5 text-xs text-white/75">
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Onkostenvergoedingen</strong> (reis-, telefoon-, thuiswerkvergoeding)</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Pensioenpremie werkgever</strong></span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Werkgeversbijdrage zorgverzekering</strong> (ZVW)</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Eenmalige uitkeringen</strong> (jubileum, gratificatie, niet-vaste bonus)</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Auto/lease zonder vaste geldwaarde</strong> in arbeidsvoorwaarden</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Opties/aandelen</strong>, tenzij contractueel als vaste beloning aangemerkt</span></li>
                    <li className="flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span><span><strong className="text-white">Uitbetaling restant vakantiedagen</strong> (separaat)</span></li>
                  </ul>
                </div>
              </div>
              {/* Jurisprudentie-noot */}
              <div className="px-4 py-3 border-t border-white/10 bg-black/20 text-[11px] text-white/60 leading-relaxed">
                <span className="font-semibold text-white/80">📚 Let op — jurisprudentie:</span>{' '}
                Variabele componenten tellen alléén mee als ze <em>loon</em> zijn in de zin van het Besluit, niet als onkosten- of zaakvergoeding. Zie o.a.{' '}
                <a href="https://uitspraken.rechtspraak.nl/details?id=ECLI:NL:GHAMS:2024:2272" target="_blank" rel="noopener noreferrer" className="text-purple-300 underline hover:text-purple-200">Hof Amsterdam 24 sept 2024, ECLI:NL:GHAMS:2024:2272</a>{' '}
                voor recente verduidelijking over wat wel/niet als loon kwalificeert.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 card p-6 space-y-5">
          <h2 className="font-medium text-white flex items-center gap-2">
            <Icons.edit size={16} className="text-gray-400" />
            Gegevens invoeren
            {editingId && (
              <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                Bewerken
              </span>
            )}
          </h2>

          {/* Werkgever / Werknemer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Werkgever</label>
              <div className="relative">
                <Icons.building
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="text"
                  value={form.employerName}
                  onChange={(e) => setForm({ ...form, employerName: e.target.value })}
                  className="input-field pl-11"
                  placeholder="Naam werkgever"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Werknemer</label>
              <div className="relative">
                <Icons.user
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="text"
                  value={form.employeeName}
                  onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                  className="input-field pl-11"
                  placeholder="Naam werknemer"
                />
              </div>
            </div>
          </div>

          {/* Datums */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Datum in dienst *</label>
              <DatePicker
                selected={form.startDate ? new Date(form.startDate) : null}
                onChange={(date) => setForm({ ...form, startDate: date ? formatDateForAPI(date) : '' })}
                placeholder="Selecteer datum..."
                maxDate={form.endDate ? new Date(form.endDate) : undefined}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Datum uit dienst *</label>
              <DatePicker
                selected={form.endDate ? new Date(form.endDate) : null}
                onChange={(date) => setForm({ ...form, endDate: date ? formatDateForAPI(date) : '' })}
                placeholder="Selecteer datum..."
                minDate={form.startDate ? new Date(form.startDate) : undefined}
              />
              {/* Opzegtermijn-suggestie obv startDate (wettelijke termijn werkgever) */}
              {(() => {
                if (!form.startDate) return null
                const start = new Date(form.startDate)
                const today = new Date()
                if (start >= today) return null
                const dienstjaren = (today.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                let noticeMonths = 1
                if (dienstjaren >= 15) noticeMonths = 4
                else if (dienstjaren >= 10) noticeMonths = 3
                else if (dienstjaren >= 5) noticeMonths = 2
                // VSO ondertekend in deze maand → opzegging effectief vanaf
                // 1e van volgende maand, eindigt aan eind van (huidige maand + noticeMonths)
                const suggested = new Date(today.getFullYear(), today.getMonth() + noticeMonths + 1, 0)
                const suggestedIso = formatDateForAPI(suggested)
                const isAlreadySet = form.endDate === suggestedIso
                return (
                  <div className="mt-2 rounded-lg border border-purple-500/20 bg-purple-500/5 p-2.5">
                    <div className="flex items-start gap-2">
                      <Icons.info size={12} className="text-purple-300 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 text-xs">
                        <p className="text-white/80 leading-tight">
                          <span className="font-semibold">Suggestie obv opzegtermijn:</span>{' '}
                          {suggested.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-white/50 mt-0.5 leading-tight">
                          {noticeMonths} mnd opzegtermijn (~{Math.floor(dienstjaren)} jr dienst), bij VSO-akkoord deze maand, tegen einde maand.
                        </p>
                        {!isAlreadySet && (
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, endDate: suggestedIso })}
                            className="mt-1.5 text-xs text-purple-300 hover:text-purple-200 underline font-medium"
                          >
                            Gebruik deze datum
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Bruto salaris */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Bruto maandsalaris *</label>
            <div className="relative">
              <Icons.euro
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={16}
              />
              <input
                type="number"
                step="0.01"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="input-field pl-11"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Vakantiegeld & 13e maand */}
          <div className="space-y-3">
            <label className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={form.vacationMoney}
                onChange={(e) => setForm({ ...form, vacationMoney: e.target.checked })}
                className="w-5 h-5 rounded accent-workx-lime"
              />
              <div className="flex-1">
                <span className="text-white text-sm font-medium">Vakantiegeld</span>
                <p className="text-xs text-gray-400">Standaard 8% van het bruto maandsalaris</p>
              </div>
              {form.vacationMoney && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={form.vacationPercent}
                    onChange={(e) => setForm({ ...form, vacationPercent: e.target.value })}
                    className="w-16 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-workx-lime/50"
                  />
                  <span className="text-gray-400 text-sm">%</span>
                </div>
              )}
            </label>

            <label className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={form.thirteenthMonth}
                onChange={(e) => setForm({ ...form, thirteenthMonth: e.target.checked })}
                className="w-5 h-5 rounded accent-workx-lime"
              />
              <div className="flex-1">
                <span className="text-white text-sm font-medium">13e maand</span>
                <p className="text-xs text-gray-400">8,3% van het bruto jaarsalaris</p>
              </div>
            </label>
          </div>

          {/* Bonus sectie */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="block text-sm text-gray-400">Bonus</label>
              {form.bonusType !== 'none' && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                  Actief
                </span>
              )}
            </div>
            <div className="space-y-2">
              {/* Bonus type selection */}
              <div className="flex gap-2">
                {[
                  { value: 'none', label: 'Geen bonus' },
                  { value: 'fixed', label: 'Vast bedrag p/m' },
                  { value: 'average', label: 'Bereken gemiddelde' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setForm({ ...form, bonusType: option.value as typeof form.bonusType })
                    }
                    className={`flex-1 px-3 py-2 rounded-lg text-sm transition-all ${
                      form.bonusType === option.value
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 border'
                        : 'bg-white/5 border border-white/10 text-gray-400 hover:border-white/20'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Fixed bonus input */}
              {form.bonusType === 'fixed' && (
                <div className="relative">
                  <Icons.euro
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                    size={16}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={form.bonusFixed}
                    onChange={(e) => setForm({ ...form, bonusFixed: e.target.value })}
                    className="input-field pl-11"
                    placeholder="Bonus per maand"
                  />
                </div>
              )}

              {/* Average bonus calculator tool */}
              {form.bonusType === 'average' && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.calculator className="text-purple-400" size={16} />
                    <span className="text-sm font-medium text-white">Bonus Calculator</span>
                  </div>

                  {!form.endDate ? (
                    <div className="text-center py-4">
                      <Icons.calendar className="text-white/20 mx-auto mb-2" size={24} />
                      <p className="text-sm text-gray-400">
                        Vul eerst de <span className="text-purple-400">einddatum</span> in om de bonus te berekenen
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-white/50">
                        Vul de ontvangen bonussen in over de 3 kalenderjaren voorafgaand aan de einddatum ({formatDate(form.endDate)})
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-purple-400">
                            {new Date(form.endDate).getFullYear() - 3}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                              €
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={form.bonusYear1}
                              onChange={(e) => setForm({ ...form, bonusYear1: e.target.value })}
                              className="input-field pl-8 text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-purple-400">
                            {new Date(form.endDate).getFullYear() - 2}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                              €
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={form.bonusYear2}
                              onChange={(e) => setForm({ ...form, bonusYear2: e.target.value })}
                              className="input-field pl-8 text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-purple-400">
                            {new Date(form.endDate).getFullYear() - 1}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                              €
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              value={form.bonusYear3}
                              onChange={(e) => setForm({ ...form, bonusYear3: e.target.value })}
                              className="input-field pl-8 text-sm"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Overig veld */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          Overige variabele looncomponenten (totaal over 3 jaar)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                            €
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={form.bonusOther}
                            onChange={(e) => setForm({ ...form, bonusOther: e.target.value })}
                            className="input-field pl-8 text-sm"
                            placeholder="0"
                          />
                        </div>
                        <p className="text-xs text-white/30 mt-1">
                          Bijv. commissies, tantièmes, structurele overwerkvergoeding
                        </p>
                      </div>

                      {/* Resultaat */}
                      {(form.bonusYear1 || form.bonusYear2 || form.bonusYear3 || form.bonusOther) && (
                        <div className="pt-3 border-t border-purple-500/20">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10">
                            <div>
                              <p className="text-xs text-white/50">Berekend resultaat</p>
                              <p className="text-sm text-white/70">
                                Totaal: {formatCurrency(
                                  (parseFloat(form.bonusYear1) || 0) +
                                  (parseFloat(form.bonusYear2) || 0) +
                                  (parseFloat(form.bonusYear3) || 0) +
                                  (parseFloat(form.bonusOther) || 0)
                                )} ÷ {Math.min(
                                  36,
                                  Math.max(1, Math.floor(
                                    (new Date(form.endDate).getTime() -
                                      new Date(form.startDate || form.endDate).getTime()) /
                                      (1000 * 60 * 60 * 24 * 30.44)
                                  ))
                                )} maanden
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-purple-400">Bonus per maand</p>
                              <p className="text-xl font-semibold text-purple-400">
                                {formatCurrency(calculateBonusPerMonth())}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-white/30 mt-2 text-center">
                            Dit bedrag wordt automatisch meegenomen in de transitievergoeding
                          </p>
                        </div>
                      )}

                      {!form.bonusYear1 && !form.bonusYear2 && !form.bonusYear3 && !form.bonusOther && (
                        <div className="text-center py-2">
                          <p className="text-xs text-white/30">
                            Vul de bonussen in om de gemiddelde bonus per maand te berekenen
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Overwerk & Overige */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Overwerk p/m</label>
              <div className="relative">
                <Icons.euro
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="number"
                  step="0.01"
                  value={form.overtime}
                  onChange={(e) => setForm({ ...form, overtime: e.target.value })}
                  className="input-field pl-11"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Overige p/m</label>
              <div className="relative">
                <Icons.euro
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="number"
                  step="0.01"
                  value={form.other}
                  onChange={(e) => setForm({ ...form, other: e.target.value })}
                  className="input-field pl-11"
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>

          {/* Pensioen/AOW */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            <label className="flex items-center gap-4 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isPensionAge}
                onChange={(e) => setForm({ ...form, isPensionAge: e.target.checked })}
                className="w-5 h-5 rounded accent-workx-lime"
              />
              <div className="flex-1">
                <span className="text-white text-sm font-medium">
                  Werknemer nadert of heeft AOW-leeftijd bereikt
                </span>
                <p className="text-xs text-gray-400">Transitievergoeding wordt gekapt op restloon tot AOW-datum (art. 7:673 lid 4 BW)</p>
              </div>
            </label>
            {form.isPensionAge && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">AOW-datum</label>
                <DatePicker
                  selected={form.pensionDate ? new Date(form.pensionDate) : null}
                  onChange={(date) => setForm({ ...form, pensionDate: date ? formatDateForAPI(date) : '' })}
                  placeholder="AOW-ingangsdatum..."
                />
              </div>
            )}
          </div>

          {/* Multiplier — onderhandelings-/scenario-factor */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5 flex items-center gap-2">
              <Icons.layers size={14} />
              Vermenigvuldiger / opslag
              <span className="text-[10px] text-white/40 font-normal">— wettelijke vergoeding × factor (bv. 1,5× bij ernstig verwijtbaar)</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                step="0.05"
                min="0.5"
                max="5"
                value={form.multiplier}
                onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
                className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none tabular-nums"
              />
              <span className="text-sm text-white/40">×</span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
                {['1', '1.25', '1.5', '1.75', '2'].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, multiplier: p })}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      form.multiplier === p ? 'bg-purple-500/30 text-purple-200' : 'text-white/50 hover:text-white/80'
                    }`}
                  >
                    {p}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notitie-veld */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5 flex items-center gap-2">
              <Icons.fileText size={14} />
              Notitie (optioneel)
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Bv. scenario A bij bonus van €X, of korte case-context..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/25 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={reset} className="btn-secondary flex items-center gap-2">
              <Icons.refresh size={16} />
              Reset
            </button>
            <button
              onClick={calculate}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Icons.calculator size={16} />
              Bereken transitievergoeding
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <div className="card p-6 space-y-6 sticky top-8">
              {/* Main result */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-6 text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  {(() => {
                    const mult = parseFloat(form.multiplier) || 1
                    const withMultiplier = result.amount * mult
                    if (mult === 1) {
                      return (
                        <>
                          <p className="text-sm text-gray-400 mb-2">Transitievergoeding</p>
                          <p className="text-4xl font-semibold text-purple-400 mb-1">
                            {formatCurrency(result.amount)}
                          </p>
                          {result.maxApplied && (
                            <p className="text-xs text-orange-400 mt-2">
                              Maximum toegepast ({formatCurrency(result.maxUsed)})
                            </p>
                          )}
                        </>
                      )
                    }
                    return (
                      <>
                        <p className="text-sm text-gray-400 mb-2">Wettelijke vergoeding</p>
                        <p className="text-xl font-medium text-white/80 mb-1 line-through decoration-white/20">
                          {formatCurrency(result.amount)}
                        </p>
                        <p className="text-xs text-purple-300 mt-2 mb-0.5">× {mult}</p>
                        <p className="text-4xl font-semibold text-purple-400">
                          {formatCurrency(withMultiplier)}
                        </p>
                        {result.maxApplied && (
                          <p className="text-xs text-orange-400 mt-2">
                            Maximum toegepast op wettelijk deel ({formatCurrency(result.maxUsed)})
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Visuele opbouw maandsalaris — donut */}
              {(() => {
                const base = parseFloat(form.salary) || 0
                const vac = form.vacationMoney ? base * (parseFloat(form.vacationPercent) / 100) : 0
                const thirteenth = form.thirteenthMonth ? base / 12 : 0
                const bonus = result.bonusPerMonth || 0
                const overtime = (parseFloat(form.overtime) || 0) / 12
                const other = (parseFloat(form.other) || 0) / 12
                const items = [
                  { label: 'Basissalaris', value: base, color: '#a78bfa' },
                  { label: 'Vakantiegeld', value: vac, color: '#34d399' },
                  { label: '13e maand', value: thirteenth, color: '#fbbf24' },
                  { label: 'Bonus', value: bonus, color: '#f472b6' },
                  { label: 'Overwerk', value: overtime, color: '#60a5fa' },
                  { label: 'Overige', value: other, color: '#a3a3a3' },
                ].filter(i => i.value > 0)
                const total = items.reduce((s, i) => s + i.value, 0)
                if (total === 0 || items.length < 2) return null
                const radius = 48
                const circumference = 2 * Math.PI * radius
                let offset = 0
                return (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-3">Opbouw maandsalaris</p>
                    <div className="flex items-center gap-4">
                      <div className="relative w-32 h-32 flex-shrink-0">
                        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                          {items.map(it => {
                            const len = (it.value / total) * circumference
                            const seg = (
                              <circle
                                key={it.label}
                                cx={60}
                                cy={60}
                                r={radius}
                                fill="transparent"
                                stroke={it.color}
                                strokeWidth={14}
                                strokeDasharray={`${len} ${circumference}`}
                                strokeDashoffset={-offset}
                              />
                            )
                            offset += len
                            return seg
                          })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <p className="text-[9px] text-white/50 uppercase tracking-wider">Bruto p/m</p>
                          <p className="text-sm font-bold text-white">{formatCurrency(total)}</p>
                        </div>
                      </div>
                      <ul className="flex-1 space-y-1.5 text-xs">
                        {items.map(it => {
                          const pct = ((it.value / total) * 100).toFixed(0)
                          return (
                            <li key={it.label} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 text-white/80">
                                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: it.color }} />
                                {it.label}
                              </span>
                              <span className="text-white/50 tabular-nums">{pct}%</span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </div>
                )
              })()}

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Icons.calendar size={14} className="text-gray-400" />
                    Dienstverband
                  </span>
                  <span className="text-sm font-medium text-white">
                    {result.years} jaar, {result.months} maanden{result.days > 0 ? `, ${result.days} dagen` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Icons.euro size={14} className="text-gray-400" />
                    Salaris (bruto p/m)
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(result.totalSalary)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Icons.chart size={14} className="text-gray-400" />
                    Jaarsalaris
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(result.yearlySalary)}
                  </span>
                </div>
                {result.bonusPerMonth > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-sm text-gray-400 flex items-center gap-2">
                      <Icons.star size={14} className="text-gray-400" />
                      Bonus p/m
                    </span>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(result.bonusPerMonth)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-gray-400 flex items-center gap-2">
                    <Icons.calculator size={14} className="text-gray-400" />
                    1/3 maandsalaris
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(result.totalSalary / 3)}
                  </span>
                </div>
                {result.maxApplied && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <span className="text-sm text-orange-400 flex items-center gap-2">
                      <Icons.alertTriangle size={14} />
                      Voor maximum
                    </span>
                    <span className="text-sm font-medium text-orange-400">
                      {formatCurrency(result.amountBeforeMax)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={saveCalculation}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Icons.save size={16} />
                  {editingId ? 'Berekening bijwerken' : 'Berekening opslaan'}
                </button>
                {editingId && (
                  <button
                    onClick={async () => {
                      // Vergeet editingId — volgende save maakt nieuw record
                      setEditingId(null)
                      setTimeout(() => saveCalculation(), 0)
                    }}
                    className="btn-secondary w-full flex items-center justify-center gap-2 text-purple-300 border border-purple-500/30"
                    title="Slaat huidige inputs op als nieuwe variant (handig om scenario's te vergelijken)"
                  >
                    <Icons.layers size={16} />
                    Sla op als variant
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadPDF('nl')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Icons.download size={16} />
                    PDF (NL)
                  </button>
                  <button
                    onClick={() => downloadPDF('en')}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <Icons.download size={16} />
                    PDF (EN)
                  </button>
                </div>
                {editingId && (
                  <a
                    href={`/api/transitie/${editingId}/export-word`}
                    download
                    className="btn-secondary w-full flex items-center justify-center gap-2"
                    title="Word — bewerkbaar bestand voor interne notities of basis voor groter advies"
                  >
                    <Icons.fileText size={16} />
                    Word (bewerkbaar)
                  </a>
                )}
              </div>

              {form.employeeName && (
                <p className="text-center text-xs text-white/30">
                  Berekening voor {form.employeeName}
                </p>
              )}
            </div>
          ) : null}

          {/* Saved calculations for this employee */}
          {form.employeeName && employeeCalculations.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Icons.history size={14} className="text-gray-400" />
                Eerdere berekeningen voor {form.employeeName}
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {employeeCalculations.map((calc) => (
                  <div
                    key={calc.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      editingId === calc.id
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">
                        {formatCurrency(calc.amount)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(calc.createdAt).toLocaleDateString('nl-NL')}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mb-2">
                      {formatDate(calc.startDate)} - {formatDate(calc.endDate)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadCalculation(calc)}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        Laden
                      </button>
                      <button
                        onClick={() => deleteCalculation(calc.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* All saved calculations */}
      {savedCalculations.length > 0 && (() => {
        const q = listSearch.trim().toLowerCase()
        const filteredCalcs = q
          ? savedCalculations.filter(c =>
              (c.employeeName || '').toLowerCase().includes(q) ||
              (c.employerName || '').toLowerCase().includes(q),
            )
          : savedCalculations
        return (
        <div className="card p-4 sm:p-6">
          {/* Visuele instructie voor vergelijken — zichtbaar zolang minder
              dan 2 berekeningen zijn aangevinkt */}
          {savedCalculations.length >= 2 && compareIds.size < 2 && (
            <div className="mb-5 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-500/8 via-indigo-500/5 to-transparent p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="relative flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Icons.layers className="text-purple-300" size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
                    Wist je dat je berekeningen kunt vergelijken?
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wider">Nieuw</span>
                  </p>
                  <p className="text-xs text-white/70 leading-relaxed mb-2">
                    Vink 2 of 3 berekeningen aan (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-purple-500/50 bg-white/5 align-middle mx-0.5"></span>
                    ) en klik op <span className="text-purple-300 font-medium">"Vergelijken"</span>. Handig om scenario's met afwijkende startdatum, bonus of vakantiegeld naast elkaar te zien.
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-white/40">
                    <span>1. Vink aan</span>
                    <span>→</span>
                    <span>2. Klik vergelijken</span>
                    <span>→</span>
                    <span>3. Download als Word</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-medium text-white flex items-center gap-2">
              <Icons.history size={16} className="text-gray-400" />
              Mijn opgeslagen berekeningen
              <span className="text-xs text-white/40 font-normal">({filteredCalcs.length}{q && ` van ${savedCalculations.length}`})</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              {compareIds.size >= 2 && (
                <button
                  onClick={() => setShowCompareModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 text-purple-300 text-sm font-semibold border border-purple-500/40 hover:bg-purple-500/30 transition-colors"
                >
                  <Icons.layers size={14} />
                  Vergelijken ({compareIds.size})
                </button>
              )}
              {compareIds.size > 0 && (
                <button
                  onClick={() => setCompareIds(new Set())}
                  className="text-xs text-white/40 hover:text-white/70 underline"
                >
                  Selectie wissen
                </button>
              )}
              <div className="relative w-full sm:w-72">
              <Icons.search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Zoek op werknemer of werkgever…"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 focus:outline-none placeholder:text-white/30"
              />
              {listSearch && (
                <button
                  onClick={() => setListSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80"
                  title="Wissen"
                >
                  <Icons.x size={12} />
                </button>
              )}
            </div>
            </div>
          </div>

          {filteredCalcs.length === 0 && q && (
            <p className="text-center text-sm text-white/40 italic py-8">Geen berekeningen voor "{listSearch}"</p>
          )}

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {filteredCalcs.map((calc) => (
              <div
                key={calc.id}
                className={`p-4 rounded-xl border transition-colors ${
                  editingId === calc.id
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-white font-medium">{calc.employeeName || '-'}</p>
                    <p className="text-xs text-white/50">{calc.employerName || '-'}</p>
                  </div>
                  <span className="text-lg font-semibold text-purple-400">
                    {formatCurrency(calc.amount)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                  <span>{new Date(calc.createdAt).toLocaleDateString('nl-NL')}</span>
                  <span>{calc.years}j {calc.months}m{calc.days ? ` ${calc.days}d` : ''}</span>
                  <span>{formatCurrency(calc.totalSalary)}/m</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => toggleCompare(calc.id)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                      compareIds.has(calc.id) ? 'bg-purple-500/30 text-purple-200 border-purple-500/50' : 'bg-white/5 text-white/60 border-white/10'
                    }`}
                    title="Toevoegen aan vergelijking"
                  >
                    {compareIds.has(calc.id) ? '✓' : '+'}
                  </button>
                  <button
                    onClick={() => loadCalculation(calc)}
                    className="flex-1 py-2 px-3 rounded-lg bg-purple-500/20 text-purple-400 text-sm font-medium"
                  >
                    Laden
                  </button>
                  <button
                    onClick={() => deleteCalculation(calc.id)}
                    className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 text-sm"
                  >
                    <Icons.trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-center py-3 px-2 text-gray-400 font-medium w-10" title="Vergelijken"><Icons.layers size={12} /></th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Datum</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Werkgever</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Werknemer</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Dienstverband</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Salaris</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Transitie</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalcs.map((calc) => (
                  <tr
                    key={calc.id}
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      editingId === calc.id ? 'bg-purple-500/10' : ''
                    } ${compareIds.has(calc.id) ? 'bg-purple-500/5' : ''}`}
                  >
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => toggleCompare(calc.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                          compareIds.has(calc.id) ? 'bg-purple-500 border-purple-500' : 'bg-white/5 border-white/20 hover:border-purple-500/50'
                        }`}
                        title="Selecteer voor vergelijken"
                      >
                        {compareIds.has(calc.id) && <Icons.check size={12} className="text-white" />}
                      </button>
                    </td>
                    <td className="py-3 px-2 text-gray-400">
                      <span>{new Date(calc.createdAt).toLocaleDateString('nl-NL')}</span>
                    </td>
                    <td className="py-3 px-2 text-white">{calc.employerName || '-'}</td>
                    <td className="py-3 px-2 text-white">{calc.employeeName || '-'}</td>
                    <td className="py-3 px-2 text-gray-400">
                      {calc.years}j {calc.months}m
                    </td>
                    <td className="py-3 px-2 text-white text-right">
                      {formatCurrency(calc.totalSalary)}
                    </td>
                    <td className="py-3 px-2 text-purple-400 font-medium text-right">
                      {formatCurrency(calc.amount)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => loadCalculation(calc)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-purple-400 transition-colors"
                          title="Laden"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteCalculation(calc.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                          title="Verwijderen"
                        >
                          <Icons.trash size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )
      })()}

      {/* Vergelijk-modal */}
      {showCompareModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCompareModal(false)}
        >
          <div
            className="w-full max-w-6xl bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Icons.layers size={20} className="text-purple-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Berekeningen vergelijken</h3>
                  <p className="text-xs text-white/50">{compareIds.size} naast elkaar</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/transitie/compare-export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: Array.from(compareIds) }),
                      })
                      if (!res.ok) throw new Error()
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `Vergelijking-transitie-${new Date().toISOString().slice(0, 10)}.docx`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      URL.revokeObjectURL(url)
                    } catch {
                      toast.error('Download mislukt')
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime/15 hover:bg-workx-lime/25 text-workx-lime text-sm font-medium border border-workx-lime/30 transition-colors"
                  title="Download vergelijking als Word"
                >
                  <Icons.fileText size={14} />
                  Word
                </button>
                <button onClick={() => setShowCompareModal(false)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                  <Icons.x size={20} />
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {(() => {
                const selected = savedCalculations.filter(c => compareIds.has(c.id))
                if (selected.length < 2) return <p className="text-white/50">Selecteer minimaal 2.</p>
                const cols = selected.length
                const effective = (s: SavedCalculation) => s.amount * (s.multiplier ?? 1)
                const minAmount = Math.min(...selected.map(effective))
                const maxAmount = Math.max(...selected.map(effective))
                const rows: { label: string; values: (string | number)[] }[] = [
                  { label: 'Werkgever', values: selected.map(s => s.employerName || '—') },
                  { label: 'Dienstverband', values: selected.map(s => `${s.years}j ${s.months}m${s.days ? ` ${s.days}d` : ''}`) },
                  { label: 'Basissalaris (p/m)', values: selected.map(s => formatCurrency(s.salary)) },
                  { label: 'Vakantiegeld', values: selected.map(s => s.vacationMoney ? `${s.vacationPercent}%` : '—') },
                  { label: '13e maand', values: selected.map(s => s.thirteenthMonth ? 'Ja' : '—') },
                  { label: 'Bonus', values: selected.map(s => s.bonusType === 'fixed' ? formatCurrency(s.bonusFixed) : s.bonusType === 'average' ? `Avg ${formatCurrency((s.bonusYear1 + s.bonusYear2 + s.bonusYear3) / 3)}/j` : '—') },
                  { label: 'Totaal bruto p/m', values: selected.map(s => formatCurrency(s.totalSalary)) },
                  { label: 'Jaarsalaris', values: selected.map(s => formatCurrency(s.yearlySalary)) },
                  { label: 'Factor', values: selected.map(s => `${s.multiplier ?? 1}×`) },
                  { label: 'Met factor', values: selected.map(s => formatCurrency(s.amount * (s.multiplier ?? 1))) },
                ]
                return (
                  <div className="space-y-4">
                    {/* Naam-kop + bedrag */}
                    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                      {selected.map(s => {
                        const eff = effective(s)
                        const mult = s.multiplier ?? 1
                        const isMax = eff === maxAmount && minAmount !== maxAmount
                        const isMin = eff === minAmount && minAmount !== maxAmount
                        return (
                          <div key={s.id} className={`rounded-xl p-4 border ${isMax ? 'border-purple-500/40 bg-purple-500/10' : 'border-white/10 bg-white/5'}`}>
                            <p className="text-xs text-white/50 mb-1">{new Date(s.createdAt).toLocaleDateString('nl-NL')}</p>
                            <p className="text-base font-semibold text-white truncate">{s.employeeName || '—'}</p>
                            {s.employerName && <p className="text-xs text-white/50 truncate">{s.employerName}</p>}
                            <div className="mt-3 pt-3 border-t border-white/10">
                              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                                {mult !== 1 ? `Eindbedrag (${mult}×)` : 'Transitievergoeding'}
                              </p>
                              <p className={`text-2xl font-bold ${isMax ? 'text-purple-300' : isMin ? 'text-white/60' : 'text-white'}`}>{formatCurrency(eff)}</p>
                              {mult !== 1 && <p className="text-[10px] text-white/50 mt-0.5">wettelijk: {formatCurrency(s.amount)}</p>}
                              {isMax && <p className="text-[10px] text-purple-300 mt-0.5">Hoogste</p>}
                              {isMin && <p className="text-[10px] text-white/40 mt-0.5">Laagste</p>}
                            </div>
                            {s.notes && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Notitie</p>
                                <p className="text-xs text-white/70 italic">{s.notes}</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Detail-rijen */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      {rows.map((r, idx) => (
                        <div
                          key={r.label}
                          className={`grid gap-3 px-4 py-2.5 items-center ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                          style={{ gridTemplateColumns: `200px repeat(${cols}, minmax(0, 1fr))` }}
                        >
                          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{r.label}</span>
                          {r.values.map((v, i) => (
                            <span key={i} className="text-sm text-white">{v}</span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Legal disclaimer */}
      <div className="card p-4 border-white/5">
        <div className="flex items-start gap-3">
          <Icons.shield size={16} className="text-white/30 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            <strong className="text-white/50">Disclaimer:</strong> Deze berekening is indicatief en
            gebaseerd op de wettelijke regeling per 1 januari 2020. Maximum 2026: € 102.000 of
            jaarsalaris indien hoger. De daadwerkelijke transitievergoeding kan afwijken door
            CAO-afspraken of andere bijzondere omstandigheden.
          </p>
        </div>
      </div>
    </div>
  )
}
