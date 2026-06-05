'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { createPortal } from 'react-dom'
// jsPDF wordt dynamic geïmporteerd in de PDF-handler — scheelt ~200KB in initial bundle
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import { renderTransitiePdf } from '@/lib/transitie-pdf'
import { getPhotoUrl } from '@/lib/team-photos'
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
  clientParty?: string | null
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
  clientParty: 'werknemer' | 'werkgever' | 'beide' | ''
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
  clientParty: '',
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showWhatIfModal, setShowWhatIfModal] = useState(false)

  // Tool-gebruik overzicht — alleen voor Jochem
  const { data: session } = useSession()
  const isOwnerView = session?.user?.email === 'jochem.deroos@workxadvocaten.nl'
  interface UsageRow {
    id: string
    employerName: string | null
    employeeName: string
    createdAt: string
    multiplier: number | null
    user: { id: string; name: string | null; email: string | null; avatarUrl: string | null } | null
  }
  const [teamUsage, setTeamUsage] = useState<UsageRow[]>([])
  const [showTeamUsage, setShowTeamUsage] = useState(false)

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

  // Load team-gebruik overzicht — alleen als Jochem ingelogd is
  useEffect(() => {
    if (!isOwnerView) return
    fetch('/api/transitie/usage')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) setTeamUsage(data)
      })
      .catch(err => console.error('Error fetching usage:', err))
  }, [isOwnerView])

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

  // Pure compute: gebruikt form-velden + override einddatum.
  // Retourneert null bij onvolledige invoer of ongeldige datum.
  const computeFor = (endDateStr: string): {
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
  } | null => {
    if (!form.startDate || !endDateStr || !form.salary) return null

    const start = new Date(form.startDate)
    const end = new Date(endDateStr)
    if (end <= start) return null

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

    return {
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
    }
  }

  // What-if state: factor + einddatum-override voor het speel-paneel rechts.
  // Worden gereset wanneer er een nieuwe berekening wordt gestart of geladen.
  const [whatIfMultiplier, setWhatIfMultiplier] = useState<number>(1)
  const [whatIfEndDate, setWhatIfEndDate] = useState<string>('')

  // Berekent live bedrag o.b.v. whatIf-overrides — zonder DB-write.
  const liveResult = (() => {
    if (!result) return null
    const effEnd = whatIfEndDate || form.endDate
    if (effEnd === form.endDate && whatIfMultiplier === 1) return result
    const base = computeFor(effEnd)
    return base
  })()

  const calculate = async () => {
    if (!form.startDate || !form.endDate || !form.salary) {
      return toast.error('Vul alle verplichte velden in')
    }

    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    if (end <= start) return toast.error('Einddatum moet na startdatum')

    const computed = computeFor(form.endDate)
    if (!computed) return toast.error('Berekening mislukt')

    setResult(computed)
    setWhatIfMultiplier(1)
    setWhatIfEndDate(form.endDate)

    // Auto-opslaan zodat de basis-TV direct in de lijst staat
    await saveBaseCalculation(computed)
  }

  // Persisteert basis-TV (factor 1, originele einddatum). Wordt aangeroepen
  // direct na berekenen — pure TV, geen beëindigingsvergoeding.
  const saveBaseCalculation = async (computed: NonNullable<typeof result>) => {
    const data = {
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
      totalSalary: computed.totalSalary,
      yearlySalary: computed.yearlySalary,
      amount: computed.amount,
      amountBeforeMax: computed.amountBeforeMax,
      years: computed.years,
      months: computed.months,
      days: computed.days,
      totalMonths: computed.totalMonths,
      isPensionAge: form.isPensionAge,
      notes: form.notes?.trim() || null,
      multiplier: 1,
      clientParty: form.clientParty || null,
    }
    try {
      if (editingId) {
        const res = await fetch(`/api/transitie/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Kon niet bijwerken')
        const updated = await res.json()
        setSavedCalculations(prev => prev.map(c => c.id === editingId ? updated : c))
        toast.success('Berekening bijgewerkt')
      } else {
        const res = await fetch('/api/transitie', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) throw new Error('Kon niet opslaan')
        const newCalc = await res.json()
        setSavedCalculations(prev => [newCalc, ...prev])
        setEditingId(newCalc.id)
        toast.success('Berekening opgeslagen')
      }
    } catch (e) {
      console.error('saveBase failed', e)
      toast.error('Opslaan mislukt')
    }
  }

  // Slaat what-if variant op en retourneert de aangemaakte calc (of null).
  // Belangrijk: `amount` is altijd het WETTELIJKE TV-bedrag (base, niet ×factor).
  // `multiplier` staat los — effectief bedrag = amount × multiplier (rekening
  // gehouden bij weergave).
  const persistVariant = async () => {
    if (!result || !liveResult) return null
    const effEnd = whatIfEndDate || form.endDate
    const data = {
      employerName: form.employerName,
      employeeName: form.employeeName,
      startDate: form.startDate,
      endDate: effEnd,
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
      totalSalary: liveResult.totalSalary,
      yearlySalary: liveResult.yearlySalary,
      amount: liveResult.amount,
      amountBeforeMax: liveResult.amountBeforeMax,
      years: liveResult.years,
      months: liveResult.months,
      days: liveResult.days,
      totalMonths: liveResult.totalMonths,
      isPensionAge: form.isPensionAge,
      notes: form.notes?.trim() || null,
      multiplier: whatIfMultiplier,
      clientParty: form.clientParty || null,
    }
    const res = await fetch('/api/transitie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Kon variant niet opslaan')
    const newCalc = await res.json()
    setSavedCalculations(prev => [newCalc, ...prev])
    return newCalc
  }

  const saveVariant = async () => {
    const isVariant = whatIfMultiplier !== 1 || (whatIfEndDate && whatIfEndDate !== form.endDate)
    if (!isVariant) {
      toast.error('Pas eerst factor of einddatum aan om een variant te maken')
      return
    }
    try {
      await persistVariant()
      toast.success('Variant opgeslagen')
    } catch (e) {
      console.error('saveVariant failed', e)
      toast.error('Opslaan mislukt')
    }
  }

  // Download PDF-vergelijking TV ↔ variant — gebruikt gedeelde renderer.
  const downloadWhatIfPDF = async () => {
    if (!result || !liveResult) return
    const isVariant = whatIfMultiplier !== 1 || (whatIfEndDate && whatIfEndDate !== form.endDate)
    if (!isVariant) { toast.error('Pas eerst factor of einddatum aan'); return }
    const logoDataUrl = await loadWorkxLogo()
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    renderTransitiePdf(doc, {
      mode: 'compare',
      isEN: false,
      form,
      result,
      liveResult,
      whatIfMultiplier,
      whatIfEndDate,
      logoDataUrl,
      formatDate,
      formatCurrency,
    })
    const blob = doc.output('blob')
    window.open(URL.createObjectURL(blob), '_blank')
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
      clientParty: (calc.clientParty as any) || '',
    })
    setWhatIfMultiplier(calc.multiplier ?? 1)
    setWhatIfEndDate(calc.endDate)
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
    setWhatIfMultiplier(1)
    setWhatIfEndDate('')
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
    const logoDataUrl = await loadWorkxLogo()
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    renderTransitiePdf(doc, {
      isEN,
      form,
      result,
      logoDataUrl,
      formatDate,
      formatCurrency,
      mode: 'single',
    })
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

      {/* Tool-gebruik overzicht — alleen voor Jochem zichtbaar.
          Toont WIE de tool heeft gebruikt voor WELKE zaak. Geen bedragen. */}
      {isOwnerView && teamUsage.length > 0 && (() => {
        // Groepeer per user en tel
        const byUser = new Map<string, { user: UsageRow['user']; count: number; latest: string }>()
        for (const row of teamUsage) {
          if (!row.user) continue
          const ex = byUser.get(row.user.id)
          if (ex) {
            ex.count++
            if (row.createdAt > ex.latest) ex.latest = row.createdAt
          } else {
            byUser.set(row.user.id, { user: row.user, count: 1, latest: row.createdAt })
          }
        }
        const summary = Array.from(byUser.values()).sort((a, b) => b.count - a.count)
        return (
          <div className="relative rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 via-emerald-500/4 to-transparent p-4 sm:p-5">
            <button
              onClick={() => setShowTeamUsage(s => !s)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Icons.eye className="text-emerald-300" size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Tool-gebruik door team</p>
                  <p className="text-xs text-white/50">
                    {teamUsage.length} berekeningen door {byUser.size} collega&apos;s · geen bedragen
                  </p>
                </div>
              </div>
              <Icons.chevronDown
                size={16}
                className={`text-white/40 transition-transform ${showTeamUsage ? 'rotate-180' : ''}`}
              />
            </button>

            {showTeamUsage && (
              <div className="mt-4 space-y-4">
                {/* Top: avatars + counts */}
                <div className="flex flex-wrap gap-3">
                  {summary.map(s => {
                    const photo = getPhotoUrl(s.user?.name || '', s.user?.avatarUrl)
                    const initials = (s.user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    return (
                      <div key={s.user!.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt={s.user!.name || ''} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-semibold text-emerald-200">
                            {initials}
                          </div>
                        )}
                        <div className="leading-tight">
                          <p className="text-sm font-medium text-white">{s.user?.name || '—'}</p>
                          <p className="text-[11px] text-white/50">{s.count}× · laatst {new Date(s.latest).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Lijst van alle zaken */}
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-white/40 font-semibold bg-white/[0.03]">
                    <div className="col-span-3">Gebruiker</div>
                    <div className="col-span-3">Werkgever</div>
                    <div className="col-span-3">Werknemer</div>
                    <div className="col-span-2">Datum</div>
                    <div className="col-span-1 text-right">Type</div>
                  </div>
                  <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                    {teamUsage.map(row => {
                      const photo = getPhotoUrl(row.user?.name || '', row.user?.avatarUrl)
                      const initials = (row.user?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                      const isVariant = (row.multiplier ?? 1) !== 1
                      return (
                        <div key={row.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center text-xs">
                          <div className="col-span-3 flex items-center gap-2 min-w-0">
                            {photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={photo} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-semibold text-white/70 flex-shrink-0">
                                {initials}
                              </div>
                            )}
                            <span className="text-white/80 truncate">{row.user?.name || '—'}</span>
                          </div>
                          <div className="col-span-3 text-white/70 truncate">{row.employerName || '—'}</div>
                          <div className="col-span-3 text-white/70 truncate">{row.employeeName || '—'}</div>
                          <div className="col-span-2 text-white/50">{new Date(row.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                          <div className="col-span-1 text-right">
                            {isVariant ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9px] font-medium border border-amber-500/30">VAR</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[9px] font-medium border border-purple-500/30">TV</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })()}

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

          {/* Wie is de klant? — bepaalt toon en framing van de berekening */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Voor welke partij is deze berekening?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'werknemer', label: 'Werknemer' },
                { key: 'werkgever', label: 'Werkgever' },
                { key: 'beide', label: 'Beide partijen' },
              ] as const).map((opt) => {
                const active = form.clientParty === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setForm({ ...form, clientParty: active ? '' : opt.key })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      active
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                        : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {form.clientParty && (
              <p className="text-xs text-white/40 mt-1.5">
                {form.clientParty === 'werknemer' && 'Berekening wordt opgesteld t.b.v. de werknemer.'}
                {form.clientParty === 'werkgever' && 'Berekening wordt opgesteld t.b.v. de werkgever.'}
                {form.clientParty === 'beide' && 'Berekening voor beide partijen — neutrale toon.'}
              </p>
            )}
          </div>

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
                          {noticeMonths} mnd opzegtermijn (~{Math.floor(dienstjaren)} jr dienst), bij VSO-akkoord deze maand.
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
              {editingId ? 'Herbereken & bijwerken' : 'Bereken & opslaan'}
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <div className="card p-6 space-y-6 sticky top-8">
              {/* Main result — wettelijke TV blijft hier altijd puur staan */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-6 text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <p className="text-[11px] uppercase tracking-wider text-purple-300/80 font-semibold mb-1">Transitievergoeding</p>
                  <p className="text-xs text-white/40 mb-2">art. 7:673 BW — 1/3 maandsalaris per dienstjaar</p>
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

              {/* Speel-paneel: factor + einddatum overrides → beëindigingsvergoeding */}
              {(() => {
                const isVariant = whatIfMultiplier !== 1 || (whatIfEndDate && whatIfEndDate !== form.endDate)
                const live = liveResult || result
                const variantAmount = live.amount * whatIfMultiplier
                const baseEnd = form.endDate ? new Date(form.endDate) : new Date()
                const minDate = form.startDate ? new Date(new Date(form.startDate).getTime() + 30 * 86400000) : undefined
                return (
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/40 p-5 space-y-4">
                    <div className="flex items-start gap-2">
                      <Icons.layers size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-amber-200">Vergelijken &amp; varianten</p>
                        <p className="text-xs text-white/50 leading-snug">
                          Pas factor of einddatum aan om de impact te zien. TV hierboven blijft altijd het wettelijke bedrag.
                          Met een factor &gt; 1 wordt het een <strong className="text-amber-300">beëindigingsvergoeding</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Factor — pills + fine-tune slider */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <label className="text-xs text-white/70">Factor</label>
                        <span className="text-sm font-semibold text-amber-300 tabular-nums">× {whatIfMultiplier.toFixed(2)}</span>
                      </div>
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {[1, 1.25, 1.5, 1.75, 2, 2.5, 3].map((preset) => {
                          const active = Math.abs(whatIfMultiplier - preset) < 0.01
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setWhatIfMultiplier(preset)}
                              className={`py-1.5 rounded-md text-xs font-medium border transition-colors ${
                                active
                                  ? 'bg-amber-500/25 border-amber-500/60 text-amber-200'
                                  : 'bg-white/5 border-white/10 text-white/60 hover:border-amber-500/30'
                              }`}
                            >
                              {preset % 1 === 0 ? `${preset}×` : `${preset}×`}
                            </button>
                          )
                        })}
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="3"
                        step="0.05"
                        value={whatIfMultiplier}
                        onChange={(e) => setWhatIfMultiplier(parseFloat(e.target.value))}
                        className="w-full speel-slider"
                      />
                      <p className="text-[10px] text-white/30 mt-1">Fijn-afstemmen met de slider (0.5×–3×)</p>
                    </div>

                    {/* Einddatum-slider — ± 24 maanden t.o.v. originele einddatum */}
                    {form.endDate && (() => {
                      const offsetMonths = whatIfEndDate
                        ? Math.round((new Date(whatIfEndDate).getTime() - baseEnd.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
                        : 0
                      return (
                        <div>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <label className="text-xs text-white/70">Einddatum verschuiven</label>
                            <span className="text-sm font-semibold text-amber-300 tabular-nums">
                              {offsetMonths === 0 ? 'origineel' : `${offsetMonths > 0 ? '+' : ''}${offsetMonths} mnd`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-24"
                            max="24"
                            step="1"
                            value={offsetMonths}
                            onChange={(e) => {
                              const m = parseInt(e.target.value, 10)
                              if (m === 0) {
                                setWhatIfEndDate(form.endDate)
                              } else {
                                const d = new Date(baseEnd)
                                d.setMonth(d.getMonth() + m)
                                setWhatIfEndDate(formatDateForAPI(d))
                              }
                            }}
                            className="w-full speel-slider"
                            disabled={!minDate}
                          />
                          <div className="flex justify-between text-[10px] text-white/30 mt-0.5">
                            <span>-24m</span><span>origineel ({formatDate(form.endDate)})</span><span>+24m</span>
                          </div>
                          {whatIfEndDate && whatIfEndDate !== form.endDate && (
                            <p className="text-[11px] text-white/50 mt-1">
                              Nieuwe einddatum: <span className="text-amber-300 font-medium">{formatDate(whatIfEndDate)}</span> ·
                              {' '}{live.years} jr {live.months} mnd dienst
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Beëindigingsvergoeding-card — alleen als er een variant actief is */}
                    {isVariant ? (
                      <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 text-center">
                        <p className="text-[11px] uppercase tracking-wider text-amber-300/80 font-semibold mb-1">Beëindigingsvergoeding</p>
                        <p className="text-3xl font-semibold text-amber-300 tabular-nums">{formatCurrency(variantAmount)}</p>
                        <p className="text-[11px] text-white/50 mt-1">
                          TV {formatCurrency(live.amount)} × factor {whatIfMultiplier.toFixed(2)}
                          {whatIfEndDate && whatIfEndDate !== form.endDate && ' · aangepaste einddatum'}
                        </p>
                        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => setShowWhatIfModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-sm font-medium transition-colors"
                          >
                            <Icons.layers size={14} />
                            Vergelijk &amp; download TV ↔ variant
                          </button>
                          <button
                            onClick={saveVariant}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm font-medium transition-colors"
                          >
                            <Icons.save size={14} />
                            Variant opslaan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-white/40 text-center italic">
                        Verschuif een slider om een variant te zien.
                      </p>
                    )}
                  </div>
                )
              })()}

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

              {/* Actions — Bereken slaat al automatisch op. Hier alleen exports. */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold pt-1">Download transitievergoeding</p>
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
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-medium text-white flex items-center gap-2">
              <Icons.history size={16} className="text-gray-400" />
              Mijn opgeslagen berekeningen
              <span className="text-xs text-white/40 font-normal">({filteredCalcs.length}{q && ` van ${savedCalculations.length}`})</span>
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
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
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-medium">{calc.employeeName || '-'}</p>
                      {(calc.multiplier ?? 1) !== 1 ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[10px] font-medium border border-amber-500/30">Variant {(calc.multiplier ?? 1)}×</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 text-[10px] font-medium border border-purple-500/30">TV</span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{calc.employerName || '-'}</p>
                  </div>
                  <span className={`text-lg font-semibold ${(calc.multiplier ?? 1) !== 1 ? 'text-amber-300' : 'text-purple-400'}`}>
                    {formatCurrency(calc.amount * (calc.multiplier ?? 1))}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50 mb-3">
                  <span>{new Date(calc.createdAt).toLocaleDateString('nl-NL')}</span>
                  <span>{calc.years}j {calc.months}m{calc.days ? ` ${calc.days}d` : ''}</span>
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
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Datum</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Werkgever</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Werknemer</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Type</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Dienstverband</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Salaris</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Bedrag</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Acties</th>
                </tr>
              </thead>
              <tbody>
                {filteredCalcs.map((calc) => (
                  <tr
                    key={calc.id}
                    className={`border-b border-white/5 hover:bg-white/5 ${
                      editingId === calc.id ? 'bg-purple-500/10' : ''
                    }`}
                  >
                    <td className="py-3 px-2 text-gray-400">
                      <span>{new Date(calc.createdAt).toLocaleDateString('nl-NL')}</span>
                    </td>
                    <td className="py-3 px-2 text-white">{calc.employerName || '-'}</td>
                    <td className="py-3 px-2 text-white">{calc.employeeName || '-'}</td>
                    <td className="py-3 px-2">
                      {(calc.multiplier ?? 1) !== 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[11px] font-medium border border-amber-500/30">
                          Variant {(calc.multiplier ?? 1)}×
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 text-[11px] font-medium border border-purple-500/30">
                          TV
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-gray-400">
                      {calc.years}j {calc.months}m
                    </td>
                    <td className="py-3 px-2 text-white text-right">
                      {formatCurrency(calc.totalSalary)}
                    </td>
                    <td className={`py-3 px-2 font-medium text-right ${(calc.multiplier ?? 1) !== 1 ? 'text-amber-300' : 'text-purple-400'}`}>
                      {formatCurrency(calc.amount * (calc.multiplier ?? 1))}
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

      {/* What-if modal: TV (basis) vs huidige variant */}
      {showWhatIfModal && result && liveResult && typeof document !== 'undefined' && createPortal(
        <div
          data-theme="dark"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowWhatIfModal(false)}
        >
          <div
            className="w-full max-w-4xl bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Icons.layers size={20} className="text-purple-300" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">TV tegenover variant</h3>
                  <p className="text-xs text-white/50">{form.employeeName || 'Berekening'}</p>
                </div>
              </div>
              <button onClick={() => setShowWhatIfModal(false)} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                <Icons.x size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {(() => {
                const tvAmount = result.amount
                const variantAmount = liveResult.amount * whatIfMultiplier
                const diff = variantAmount - tvAmount
                const effEnd = whatIfEndDate || form.endDate
                const rows: { label: string; tv: string; variant: string }[] = [
                  { label: 'Type', tv: 'Transitievergoeding', variant: whatIfMultiplier !== 1 ? 'Beëindigingsvergoeding' : 'Transitievergoeding' },
                  { label: 'Einddatum', tv: formatDate(form.endDate), variant: formatDate(effEnd) },
                  { label: 'Dienstverband', tv: `${result.years}j ${result.months}m${result.days ? ` ${result.days}d` : ''}`, variant: `${liveResult.years}j ${liveResult.months}m${liveResult.days ? ` ${liveResult.days}d` : ''}` },
                  { label: 'Basissalaris (p/m)', tv: formatCurrency(parseFloat(form.salary) || 0), variant: formatCurrency(parseFloat(form.salary) || 0) },
                  { label: 'Jaarsalaris', tv: formatCurrency(result.yearlySalary), variant: formatCurrency(liveResult.yearlySalary) },
                  { label: 'Factor', tv: '1×', variant: `${whatIfMultiplier.toFixed(2)}×` },
                ]
                return (
                  <div className="space-y-4">
                    {/* Twee kop-cards naast elkaar */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* TV-card */}
                      <div className="rounded-xl p-4 border border-purple-500/30 bg-purple-500/10">
                        <p className="text-[10px] uppercase tracking-wider text-purple-300/80 font-semibold mb-1">Wettelijke TV</p>
                        <p className="text-xs text-white/50 mb-3">1/3 maandsalaris per dienstjaar</p>
                        <p className="text-3xl font-bold text-purple-300 tabular-nums">{formatCurrency(tvAmount)}</p>
                        <p className="text-[11px] text-white/40 mt-1">art. 7:673 BW</p>
                      </div>
                      {/* Variant-card */}
                      <div className={`rounded-xl p-4 border ${whatIfMultiplier !== 1 ? 'border-amber-500/40 bg-amber-500/10' : 'border-white/10 bg-white/5'}`}>
                        <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${whatIfMultiplier !== 1 ? 'text-amber-300/80' : 'text-white/50'}`}>
                          {whatIfMultiplier !== 1 ? 'Beëindigingsvergoeding' : 'Aangepaste TV'}
                        </p>
                        <p className="text-xs text-white/50 mb-3">
                          {whatIfMultiplier !== 1 ? `TV × factor ${whatIfMultiplier.toFixed(2)}` : 'Andere einddatum, factor 1×'}
                        </p>
                        <p className={`text-3xl font-bold tabular-nums ${whatIfMultiplier !== 1 ? 'text-amber-300' : 'text-white'}`}>{formatCurrency(variantAmount)}</p>
                        {diff !== 0 && (
                          <p className={`text-[11px] mt-1 font-medium ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {diff > 0 ? '+' : ''}{formatCurrency(diff)} vs TV
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Detail-rijen */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      {rows.map((r, idx) => (
                        <div
                          key={r.label}
                          className={`grid gap-3 px-4 py-2.5 items-center ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}
                          style={{ gridTemplateColumns: '160px 1fr 1fr' }}
                        >
                          <span className="text-xs text-white/50 font-medium uppercase tracking-wider">{r.label}</span>
                          <span className="text-sm text-white">{r.tv}</span>
                          <span className={`text-sm ${r.tv !== r.variant ? (whatIfMultiplier !== 1 ? 'text-amber-300 font-medium' : 'text-white font-medium') : 'text-white'}`}>{r.variant}</span>
                        </div>
                      ))}
                    </div>

                    {/* Acties */}
                    <div className="flex items-center justify-end gap-2 pt-2 flex-wrap">
                      <button
                        onClick={async () => { await downloadWhatIfPDF(); setShowWhatIfModal(false) }}
                        disabled={whatIfMultiplier === 1 && (!whatIfEndDate || whatIfEndDate === form.endDate)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Icons.download size={14} />
                        Download PDF
                      </button>
                      <button
                        onClick={async () => { await saveVariant(); setShowWhatIfModal(false) }}
                        disabled={whatIfMultiplier === 1 && (!whatIfEndDate || whatIfEndDate === form.endDate)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Icons.save size={14} />
                        Sla variant op
                      </button>
                      <button
                        onClick={() => setShowWhatIfModal(false)}
                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                      >
                        Sluiten
                      </button>
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
