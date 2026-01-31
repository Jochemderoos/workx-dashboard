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
      isPensionAge: form.isPensionAge,
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/transitie/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(calculationData)
        })
        if (!res.ok) throw new Error('Failed to update')
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
        if (!res.ok) throw new Error('Failed to save')
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
      if (!res.ok) throw new Error('Failed to delete')

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

  const downloadPDF = () => {
    if (!result) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - margin * 2

    // === HEADER SECTIE ===
    drawWorkxLogo(doc, margin, 15, 50)

    // Header info rechts van logo
    const infoX = 80
    const infoValueX = 115
    let hy = 20
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text('Aan:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(form.employerName || '-', infoValueX, hy)
    hy += 7
    doc.setTextColor(120, 120, 120)
    doc.text('Datum:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), infoValueX, hy)
    hy += 7
    doc.setTextColor(120, 120, 120)
    doc.text('Betreft:', infoX, hy)
    doc.setTextColor(40, 40, 40)
    doc.text(form.employeeName || 'Werknemer', infoValueX, hy)

    // Tagline
    doc.setTextColor(160, 160, 160)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', margin, 48)

    // Divider lijn
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.4)
    doc.line(margin, 53, pageWidth - margin, 53)

    // === TITEL SECTIE ===
    let y = 65
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('BEREKENING VAN DE', margin, y)
    doc.setTextColor(35, 35, 35)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('TRANSITIEVERGOEDING', margin, y + 10)

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
    doc.text('Datum in dienst', col1, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(formatDate(form.startDate), col1, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Datum uit dienst', col2, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(formatDate(form.endDate), col2, y + 11)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Dienstverband', col3, y + 3)
    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.text(`${result.years} jaar en ${result.months} maanden`, col3, y + 11)

    // === SALARIS COMPONENTEN ===
    y = 130
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(60, 60, 60)
    doc.text('Salariscomponenten', margin, y)

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

    addDataRow('Bruto maandsalaris', formatCurrency(parseFloat(form.salary)))
    addDataRow('Vakantiegeld', form.vacationMoney ? `Ja (${form.vacationPercent}%)` : 'Nee')
    addDataRow('13e maand', form.thirteenthMonth ? 'Ja (8,3%)' : 'Nee')
    addDataRow('Overwerk per maand', form.overtime ? formatCurrency(parseFloat(form.overtime)) : '—')
    addDataRow('Bonus per maand', result.bonusPerMonth > 0 ? formatCurrency(result.bonusPerMonth) : '—')
    addDataRow('Overige emolumenten', form.other ? formatCurrency(parseFloat(form.other)) : '—')
    y += 2
    addDataRow('Totaal bruto maandsalaris', formatCurrency(result.totalSalary), true)
    y += 2
    addDataRow('Pensioen-/AOW-leeftijd bereikt', form.isPensionAge ? 'Ja' : 'Nee')

    // === RESULTAAT BOX ===
    y += 12
    const boxHeight = 28
    doc.setFillColor(249, 255, 133) // Workx geel
    doc.roundedRect(margin, y, contentWidth, boxHeight, 4, 4, 'F')

    doc.setTextColor(35, 35, 35)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Transitievergoeding', margin + 12, y + 12)

    doc.setFontSize(18)
    doc.text(formatCurrency(result.amount), pageWidth - margin - 12, y + 18, { align: 'right' })

    y += boxHeight + 6
    if (result.maxApplied) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(120, 120, 120)
      doc.text(`Wettelijk maximum toegepast: ${formatCurrency(result.maxUsed)} (berekend bedrag: ${formatCurrency(result.amountBeforeMax)})`, margin, y)
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
    const disclaimer = `Disclaimer: Deze berekening is indicatief. Aan deze berekening kunnen geen rechten worden ontleend. De daadwerkelijke transitievergoeding kan afwijken door CAO-bepalingen of bijzondere omstandigheden. Wettelijke grondslag: Art. 7:673 BW. Maximum 2024: €94.000 | 2025: €98.000 | 2026: €102.000, of jaarsalaris indien hoger.`
    const disclaimerLines = doc.splitTextToSize(disclaimer, contentWidth)
    doc.text(disclaimerLines, margin, y)

    // === CONTACT ===
    y += disclaimerLines.length * 3.5 + 6
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text('Vragen? Neem contact op met één van onze arbeidsrecht specialisten.', margin, y)

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
      {savedCalculations.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h2 className="font-medium text-white flex items-center gap-2 mb-4">
            <Icons.history size={16} className="text-white/40" />
            Alle opgeslagen berekeningen
          </h2>

          {/* Mobile: Cards */}
          <div className="sm:hidden space-y-3">
            {savedCalculations.map((calc) => (
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
                  <span>{calc.years}j {calc.months}m</span>
                  <span>{formatCurrency(calc.totalSalary)}/m</span>
                </div>
                <div className="flex gap-3">
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
                      {new Date(calc.createdAt).toLocaleDateString('nl-NL')}
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
