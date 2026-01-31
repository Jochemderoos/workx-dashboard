'use client'

import { useState, useEffect } from 'react'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import {
  drawWorkxLogo,
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
  date: string
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
  bonusYears: { year1: number; year2: number; year3: number }
  bonusOther: number
  overtime: number
  other: number
  totalSalary: number
  yearlySalary: number
  amount: number
  amountBeforeMax: number
  years: number
  months: number
  isPensionAge: boolean
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
}

export default function TransitiePage() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [result, setResult] = useState<{
    years: number
    months: number
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
  const [editingId, setEditingId] = useState<string | null>(null)

  // Load saved calculations from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('workx-transitie-calculations')
    if (saved) {
      setSavedCalculations(JSON.parse(saved))
    }
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

    // Calculate years and months
    let years = end.getFullYear() - start.getFullYear()
    let months = end.getMonth() - start.getMonth()
    const days = end.getDate() - start.getDate()

    if (days < 0) months--
    if (months < 0) {
      years--
      months += 12
    }

    const totalMonths = years * 12 + months

    // Calculate salary components
    const base = parseFloat(form.salary)
    const vacation = form.vacationMoney ? base * (parseFloat(form.vacationPercent) / 100) : 0
    const thirteenth = form.thirteenthMonth ? base * 0.083 : 0 // 8.3%
    const bonusPerMonth = calculateBonusPerMonth()
    const overtime = parseFloat(form.overtime) || 0
    const other = parseFloat(form.other) || 0

    const totalSalary = base + vacation + thirteenth + bonusPerMonth + overtime + other
    const yearlySalary = totalSalary * 12

    // Transitievergoeding = 1/3 maandsalaris per jaar (naar rato)
    const amountBeforeMax = (totalSalary / 3) * (totalMonths / 12)

    // Determine maximum based on end date year
    const endYear = end.getFullYear()
    let statutoryMax = MAX_TRANSITIE_2026
    if (endYear <= 2024) statutoryMax = MAX_TRANSITIE_2024
    else if (endYear === 2025) statutoryMax = MAX_TRANSITIE_2025

    // Maximum is the HIGHER of: statutory max OR yearly salary
    const maxUsed = Math.max(statutoryMax, yearlySalary)
    const maxApplied = amountBeforeMax > maxUsed
    const amount = maxApplied ? maxUsed : amountBeforeMax

    setResult({
      years,
      months,
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

  const saveCalculation = () => {
    if (!result) return

    const calculation: SavedCalculation = {
      id: editingId || Date.now().toString(),
      date: new Date().toISOString(),
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
      isPensionAge: form.isPensionAge,
    }

    let updated: SavedCalculation[]
    if (editingId) {
      updated = savedCalculations.map((c) => (c.id === editingId ? calculation : c))
      setEditingId(null)
      toast.success('Berekening bijgewerkt')
    } else {
      updated = [calculation, ...savedCalculations]
      toast.success('Berekening opgeslagen')
    }

    setSavedCalculations(updated)
    localStorage.setItem('workx-transitie-calculations', JSON.stringify(updated))
  }

  const loadCalculation = (calc: SavedCalculation) => {
    setForm({
      employerName: calc.employerName,
      employeeName: calc.employeeName,
      startDate: calc.startDate,
      endDate: calc.endDate,
      salary: calc.salary.toString(),
      vacationMoney: calc.vacationMoney,
      vacationPercent: calc.vacationPercent.toString(),
      thirteenthMonth: calc.thirteenthMonth,
      bonusType: calc.bonusType,
      bonusFixed: calc.bonusFixed.toString(),
      bonusYear1: calc.bonusYears.year1.toString(),
      bonusYear2: calc.bonusYears.year2.toString(),
      bonusYear3: calc.bonusYears.year3.toString(),
      bonusOther: (calc.bonusOther || 0).toString(),
      overtime: calc.overtime.toString(),
      other: calc.other.toString(),
      isPensionAge: calc.isPensionAge,
    })
    setResult({
      years: calc.years,
      months: calc.months,
      totalMonths: calc.years * 12 + calc.months,
      amount: calc.amount,
      amountBeforeMax: calc.amountBeforeMax || calc.amount,
      totalSalary: calc.totalSalary,
      yearlySalary: calc.yearlySalary || calc.totalSalary * 12,
      bonusPerMonth:
        calc.bonusType === 'fixed'
          ? calc.bonusFixed
          : (calc.bonusYears.year1 + calc.bonusYears.year2 + calc.bonusYears.year3 + (calc.bonusOther || 0)) / 36,
      maxApplied: calc.amount !== (calc.amountBeforeMax || calc.amount),
      maxUsed: Math.max(MAX_TRANSITIE_2026, calc.yearlySalary || calc.totalSalary * 12),
    })
    setEditingId(calc.id)
    toast.success('Berekening geladen')
  }

  const deleteCalculation = (id: string) => {
    const updated = savedCalculations.filter((c) => c.id !== id)
    setSavedCalculations(updated)
    localStorage.setItem('workx-transitie-calculations', JSON.stringify(updated))
    if (editingId === id) {
      setEditingId(null)
      reset()
    }
    toast.success('Berekening verwijderd')
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

  const downloadPDF = () => {
    if (!result) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Draw authentic Workx logo
    drawWorkxLogo(doc, 15, 15, 55)

    // Letter info on the right
    let y = 20
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    doc.setTextColor(100, 100, 100)
    doc.text('Per email aan:', 80, y)
    doc.setTextColor(51, 51, 51)
    doc.text(form.employerName || 'info@werkgever.nl', 115, y)
    y += 6

    doc.setTextColor(100, 100, 100)
    doc.text('Datum:', 80, y)
    doc.setTextColor(51, 51, 51)
    doc.text(
      new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }),
      115,
      y
    )
    y += 6

    doc.setTextColor(100, 100, 100)
    doc.text('Betreft:', 80, y)
    doc.setTextColor(51, 51, 51)
    doc.text(`Berekening ${form.employeeName || 'Werknemer'}`, 115, y)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 15, 50)

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(15, 55, pageWidth - 15, 55)

    // Title section
    y = 70
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'normal')
    doc.text('BEREKENING VAN DE', 15, y)

    doc.setTextColor(45, 45, 45)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('TRANSITIEVERGOEDING', 15, y + 10)

    // Data section
    y = 100
    const addRow = (label: string, value: string, bold = false) => {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(label, 15, y)
      doc.setTextColor(45, 45, 45)
      if (bold) doc.setFont('helvetica', 'bold')
      doc.text(value, pageWidth - 15, y, { align: 'right' })
      if (bold) doc.setFont('helvetica', 'normal')
      y += 8
    }

    addRow('Datum in dienst', formatDate(form.startDate))
    addRow('Datum uit dienst', formatDate(form.endDate))
    y += 4

    addRow('Bruto salaris p/m', formatCurrency(parseFloat(form.salary)))
    addRow('Vakantie € (8%)', form.vacationMoney ? 'Ja' : 'Nee')
    addRow('13e maand (8.3%)', form.thirteenthMonth ? 'Ja' : 'Nee')
    addRow('Overwerk p/m', form.overtime ? formatCurrency(parseFloat(form.overtime)) : '€ -')
    addRow('Bonus p/m', result.bonusPerMonth > 0 ? formatCurrency(result.bonusPerMonth) : '€ -')
    addRow('Overige p/m', form.other ? formatCurrency(parseFloat(form.other)) : '€ -')
    y += 4

    addRow('Salaris (bruto)', formatCurrency(result.totalSalary), true)
    y += 4

    addRow('Pensioen of AOW-leeftijd bereikt?', form.isPensionAge ? 'Ja' : 'Nee')
    y += 10

    // Result box
    doc.setFillColor(255, 237, 74)
    doc.roundedRect(15, y, pageWidth - 30, 25, 4, 4, 'F')
    doc.setTextColor(45, 45, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Transitievergoeding', 25, y + 10)
    doc.setFontSize(16)
    doc.text(formatCurrency(result.amount), 25, y + 20)

    // Max notice if applicable
    if (result.maxApplied) {
      y += 30
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(100, 100, 100)
      doc.text(
        `(Maximum toegepast: ${formatCurrency(result.maxUsed)} - berekening voor max: ${formatCurrency(result.amountBeforeMax)})`,
        15,
        y
      )
      y += 5
    } else {
      y += 35
    }

    // Contact text
    y += 10
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text(
      'Heeft u vragen over deze berekening? Neem contact op met één van onze specialisten.',
      15,
      y
    )

    // Disclaimer section
    y += 20
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(15, y, pageWidth - 15, y)
    y += 8

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 130, 130)

    const disclaimer = `DISCLAIMER: Deze berekening is indicatief en uitsluitend bedoeld als hulpmiddel. Aan deze berekening kunnen geen rechten worden ontleend. Workx Advocaten is niet aansprakelijk voor enige schade die voortvloeit uit het gebruik van deze berekening of beslissingen die op basis hiervan worden genomen. De daadwerkelijke transitievergoeding kan afwijken door CAO-bepalingen, individuele arbeidsvoorwaarden of andere bijzondere omstandigheden. Voor een definitieve berekening en juridisch advies raden wij u aan contact op te nemen met één van onze arbeidsrecht specialisten.

Wettelijke grondslag: Artikel 7:673 BW. Maximum transitievergoeding 2024: €94.000, 2025: €98.000, 2026: €102.000, of het jaarsalaris indien dit hoger is.`

    const disclaimerLines = doc.splitTextToSize(disclaimer, pageWidth - 30)
    const disclaimerHeight = disclaimerLines.length * 3.5 // Approximate line height
    const pageHeight = doc.internal.pageSize.getHeight()
    const footerY = pageHeight - 15

    // Check if disclaimer would overlap with footer, if so add new page
    if (y + disclaimerHeight > footerY - 10) {
      doc.addPage()
      y = 20
    }

    doc.text(disclaimerLines, 15, y)

    // Footer on last page
    doc.setFillColor(100, 100, 100)
    doc.rect(0, footerY - 5, pageWidth, 20, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
      pageWidth / 2,
      footerY + 2,
      { align: 'center' }
    )

    // Open PDF in new tab instead of downloading
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  // Get calculations for current employee (filter by name if provided)
  const employeeCalculations = form.employeeName
    ? savedCalculations.filter(
        (c) => c.employeeName.toLowerCase() === form.employeeName.toLowerCase()
      )
    : []

  return (
    <div className="max-w-6xl space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
            <Icons.calculator className="text-purple-400" size={20} />
          </div>
          <h1 className="text-2xl font-semibold text-white">Transitievergoeding</h1>
        </div>
        <p className="text-white/40">Bereken de wettelijke transitievergoeding voor werknemers</p>
      </div>

      {/* Info Card */}
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Icons.info className="text-purple-400" size={18} />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">Wettelijke formule</h3>
            <p className="text-sm text-white/60">
              De transitievergoeding bedraagt{' '}
              <span className="text-purple-400 font-medium">1/3 bruto maandsalaris</span> per
              gewerkt jaar. Maximum is het hogere van{' '}
              <span className="text-purple-400 font-medium">€ 102.000 (2026)</span> of het
              jaarsalaris inclusief emolumenten.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 card p-6 space-y-5">
          <h2 className="font-medium text-white flex items-center gap-2">
            <Icons.edit size={16} className="text-white/40" />
            Gegevens invoeren
            {editingId && (
              <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                Bewerken
              </span>
            )}
          </h2>

          {/* Werkgever / Werknemer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Werkgever</label>
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
              <label className="block text-sm text-white/60 mb-2">Werknemer</label>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Datum in dienst *</label>
              <div className="relative">
                <Icons.calendar
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="input-field pl-11"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Datum uit dienst *</label>
              <div className="relative">
                <Icons.calendar
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={16}
                />
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="input-field pl-11"
                />
              </div>
            </div>
          </div>

          {/* Bruto salaris */}
          <div>
            <label className="block text-sm text-white/60 mb-2">Bruto maandsalaris *</label>
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
                <p className="text-xs text-white/40">Standaard 8% van het bruto maandsalaris</p>
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
                  <span className="text-white/40 text-sm">%</span>
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
                <p className="text-xs text-white/40">8,3% van het bruto jaarsalaris</p>
              </div>
            </label>
          </div>

          {/* Bonus sectie */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="block text-sm text-white/60">Bonus</label>
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
                        : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
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
                      <p className="text-sm text-white/40">
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
                        <label className="block text-xs text-white/40 mb-1">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Overwerk p/m</label>
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
              <label className="block text-sm text-white/60 mb-2">Overige p/m</label>
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
          <label className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={form.isPensionAge}
              onChange={(e) => setForm({ ...form, isPensionAge: e.target.checked })}
              className="w-5 h-5 rounded accent-workx-lime"
            />
            <div className="flex-1">
              <span className="text-white text-sm font-medium">
                Pensioen of AOW-leeftijd bereikt?
              </span>
              <p className="text-xs text-white/40">Relevant voor de berekening</p>
            </div>
          </label>

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
                  <p className="text-sm text-white/60 mb-2">Transitievergoeding</p>
                  <p className="text-4xl font-semibold text-purple-400 mb-1">
                    {formatCurrency(result.amount)}
                  </p>
                  {result.maxApplied && (
                    <p className="text-xs text-orange-400 mt-2">
                      Maximum toegepast ({formatCurrency(result.maxUsed)})
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.calendar size={14} className="text-white/40" />
                    Dienstverband
                  </span>
                  <span className="text-sm font-medium text-white">
                    {result.years} jaar, {result.months} maanden
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.euro size={14} className="text-white/40" />
                    Salaris (bruto p/m)
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(result.totalSalary)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.chart size={14} className="text-white/40" />
                    Jaarsalaris
                  </span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(result.yearlySalary)}
                  </span>
                </div>
                {result.bonusPerMonth > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-sm text-white/60 flex items-center gap-2">
                      <Icons.star size={14} className="text-white/40" />
                      Bonus p/m
                    </span>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(result.bonusPerMonth)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.calculator size={14} className="text-white/40" />
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
                <button
                  onClick={downloadPDF}
                  className="btn-secondary w-full flex items-center justify-center gap-2"
                >
                  <Icons.download size={16} />
                  Download PDF rapport
                </button>
              </div>

              {form.employeeName && (
                <p className="text-center text-xs text-white/30">
                  Berekening voor {form.employeeName}
                </p>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center sticky top-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icons.calculator className="text-white/20" size={28} />
              </div>
              <h3 className="text-white font-medium mb-2">Klaar om te berekenen</h3>
              <p className="text-white/40 text-sm">
                Vul de gegevens in om de transitievergoeding te berekenen
              </p>
            </div>
          )}

          {/* Saved calculations for this employee */}
          {form.employeeName && employeeCalculations.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">
                <Icons.history size={14} className="text-white/40" />
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
                      <span className="text-xs text-white/40">
                        {new Date(calc.date).toLocaleDateString('nl-NL')}
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
      {savedCalculations.length > 0 && (
        <div className="card p-6">
          <h2 className="font-medium text-white flex items-center gap-2 mb-4">
            <Icons.history size={16} className="text-white/40" />
            Alle opgeslagen berekeningen
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-white/40 font-medium">Datum</th>
                  <th className="text-left py-3 px-2 text-white/40 font-medium">Werkgever</th>
                  <th className="text-left py-3 px-2 text-white/40 font-medium">Werknemer</th>
                  <th className="text-left py-3 px-2 text-white/40 font-medium">Dienstverband</th>
                  <th className="text-right py-3 px-2 text-white/40 font-medium">Salaris</th>
                  <th className="text-right py-3 px-2 text-white/40 font-medium">Transitie</th>
                  <th className="text-right py-3 px-2 text-white/40 font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {savedCalculations.map((calc) => (
                  <tr
                    key={calc.id}
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      editingId === calc.id ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-2 text-white/60">
                      {new Date(calc.date).toLocaleDateString('nl-NL')}
                    </td>
                    <td className="py-3 px-2 text-white">{calc.employerName || '-'}</td>
                    <td className="py-3 px-2 text-white">{calc.employeeName || '-'}</td>
                    <td className="py-3 px-2 text-white/60">
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
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-purple-400 transition-colors"
                          title="Laden"
                        >
                          <Icons.edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteCalculation(calc.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
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
      )}

      {/* Legal disclaimer */}
      <div className="card p-4 border-white/5">
        <div className="flex items-start gap-3">
          <Icons.shield size={16} className="text-white/30 mt-0.5" />
          <p className="text-xs text-white/40 leading-relaxed">
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
