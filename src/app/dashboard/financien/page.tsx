'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import InzichtenTab from '@/components/financien/InzichtenTab'
import jsPDF from 'jspdf'
import { drawWorkxLogo, loadWorkxLogo } from '@/lib/pdf'
import { getPhotoUrl } from '@/lib/team-photos'
import { amountExVat } from '@/lib/cost-vat'

// Get dynamic years (current year and 2 previous years)
const currentYear = new Date().getFullYear()
const years = [currentYear - 2, currentYear - 1, currentYear] as const
type YearType = typeof years[number]

// Historical financial data - will be extended as years pass
const historicalData: Record<number, { werkgeverslasten: number[], kostenExtern: number[], omzet: number[], uren: number[] }> = {
  2024: {
    werkgeverslasten: [83498, 93037, 90637, 97496, 141919, 93079, 110122.21, 81458.26, 87341.8, 95277, 93797, 82992.28],
    kostenExtern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    omzet: [20771.73, 208021.62, 233890, 268590, 282943.32, 258967.33, 267419.35, 218107.23, 226676.53, 294707.11, 287153.81, 535280.4],
    uren: [904, 843, 1017, 1021, 964, 1003.4, 1061, 747, 804, 972, 916, 883]
  },
  2025: {
    werkgeverslasten: [88521, 72934, 68268, 107452, 90244, 154652, 81963.87, 79466.89, 82125, 80670, 103485, 95562],
    kostenExtern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    omzet: [-14020, 267211, 258439, 270619, 267833.5, 287433.03, 300822.95, 258031.08, 242402.91, 309577.51, 342265.3, 602865],
    uren: [1000.75, 955, 962, 975, 914, 998, 1020, 716, 1076, 1173, 1013, 1068]
  }
}

// Get data for a year - returns zeros if not available
const getYearData = (year: number) => {
  return historicalData[year] || {
    werkgeverslasten: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    kostenExtern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    omzet: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    uren: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  }
}

const periods = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12']

interface BudgetItem {
  id: string
  name: string
  budget: number
  spent: number
}

interface SalaryScale {
  id: string
  experienceYear: number
  label: string
  salary: number
  hourlyRateBase: number
  hourlyRateMin: number | null
  hourlyRateMax: number | null
}

interface VacationBalance {
  opbouwLopendJaar: number
  overgedragenVorigJaar: number
  bijgekocht: number
  opgenomenLopendJaar: number
  note: string | null
}

interface ParentalLeave {
  id: string
  childNumber: number
  kindNaam: string | null
  kindGeboorteDatum: string | null
  uitgerekendeDatum: string | null
  zwangerschapsverlofStart: string | null
  zwangerschapsverlofStatus: string | null
  geboorteverlofPartner: string | null
  aanvullendVerlofPartner: string | null
  betaaldTotaalUren: number
  betaaldOpgenomenUren: number
  betaaldVerlofDetails: string | null
  onbetaaldTotaalDagen: number
  onbetaaldOpgenomenDagen: number
  onbetaaldVerlofDetails: string | null
  uwvAangevraagd: boolean
  uwvDetails: string | null
  note: string | null
}

interface SickDaysTotals {
  userId: string
  totalDays: number
}

interface EmployeeData {
  id: string
  name: string
  email: string
  role: string
  startDate: string | null
  department: string | null
  compensation: {
    experienceYear: number | null
    hourlyRate: number
    salary: number | null
    isHourlyWage: boolean
    notes: string | null
  } | null
  bonusPaid: number
  bonusPending: number
  bonusTotal: number
  vacationBalance: VacationBalance | null
  parentalLeaves: ParentalLeave[]
}

type TabType = 'overzicht' | 'budgetten' | 'salarishuis' | 'inzichten'

export default function FinancienPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>('overzicht')
  const [currentYearData, setCurrentYearData] = useState({
    werkgeverslasten: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    kostenExtern: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    omzet: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    uren: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  })
  const [budgets, setBudgets] = useState<BudgetItem[]>([])
  const [newBudgetName, setNewBudgetName] = useState('')
  const [newBudgetAmount, setNewBudgetAmount] = useState('')
  const [editingBudget, setEditingBudget] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [salaryScales, setSalaryScales] = useState<SalaryScale[]>([])
  const [employees, setEmployees] = useState<EmployeeData[]>([])
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null)
  const [editingSalaryScale, setEditingSalaryScale] = useState<string | null>(null)
  const [isEditingSalarishuis, setIsEditingSalarishuis] = useState(false)
  const [editingVacation, setEditingVacation] = useState<string | null>(null)
  const [sickDaysTotals, setSickDaysTotals] = useState<SickDaysTotals[]>([])
  // Overige kosten 2026 uit Kosten-pagina (alleen reguliere, exclusief UWV/ASR)
  // Overige kosten 2026 (ex BTW, exclusief MGMT/UWV/ASR/WGL)
  const [monthlyCosts2026, setMonthlyCosts2026] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  // Overige kosten per jaar (ex BTW, exclusief MGMT/UWV/ASR/WGL) — voor appels-appels
  const [overigKostenPerYear, setOverigKostenPerYear] = useState<Record<number, number[]>>({})
  // Management fee per jaar/maand (ex BTW)
  const [mgmtPerMonth, setMgmtPerMonth] = useState<Record<number, number[]>>({})
  // UWV (zwangerschapsverlof) en ASR (verzuim) per jaar/maand — bijschrijvingen
  // tellen mee als negatieve correctie op werkgeverslasten.
  const [uwvPerMonth, setUwvPerMonth] = useState<Record<number, number[]>>({})
  const [asrPerMonth, setAsrPerMonth] = useState<Record<number, number[]>>({})
  // ZZP per jaar/maand — externe advocaten (Lodewijk). Onderdeel van
  // Overige Kosten, maar apart bijgehouden voor inzicht in totale
  // advocatenkosten (loon + ZZP).
  const [zzpPerMonth, setZzpPerMonth] = useState<Record<number, number[]>>({})
  // WGL per jaar/maand — werkgeverslasten-aanvulling (Bright Pensioen).
  // Telt mee bij Werkgeverslasten, NIET bij Overige Kosten.
  const [wglPerMonth, setWglPerMonth] = useState<Record<number, number[]>>({})

  // Check if user is PARTNER or ADMIN
  const isManager = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

  // Get sick days for an employee
  const getSickDays = (userId: string) => {
    return sickDaysTotals.find(s => s.userId === userId)?.totalDays || 0
  }

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load current year data
        const dataRes = await fetch('/api/financien')
        if (dataRes.ok) {
          const data = await dataRes.json()
          setCurrentYearData(data)
        }

        // Load budgets
        const budgetRes = await fetch('/api/financien/budgets')
        if (budgetRes.ok) {
          const budgetData = await budgetRes.json()
          setBudgets(budgetData)
        }

        // Load salary scales
        const scaleRes = await fetch('/api/financien/salary-scales')
        if (scaleRes.ok) {
          const scaleData = await scaleRes.json()
          setSalaryScales(scaleData)
        }

        // Load employee compensation (voor iedereen - API filtert op basis van rol)
        const empRes = await fetch('/api/financien/employee-compensation')
        if (empRes.ok) {
          const empData = await empRes.json()
          setEmployees(empData)
        }

        // Load monthly costs 2025 + 2026 (Kosten-pagina) en split op UWV/ASR
        if (session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN') {
          const [d2026, d2025] = await Promise.all([
            fetch('/api/monthly-costs?year=2026').then(r => r.ok ? r.json() : []),
            fetch('/api/monthly-costs?year=2025').then(r => r.ok ? r.json() : []),
          ])
          const reg2026 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
          const uwv: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          const asr: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          const zzp: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          const wgl: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          const mgmt: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          const overigPerYear: Record<number, number[]> = { 2025: Array(12).fill(0), 2026: Array(12).fill(0) }
          for (const it of [...d2026, ...d2025] as { year: number; month: number; amount: number; description?: string; category?: string | null }[]) {
            if (it.month < 1 || it.month > 12) continue
            const exBtw = amountExVat({ amount: it.amount, description: it.description, category: it.category })
            if (it.category === 'UWV') {
              if (!uwv[it.year]) uwv[it.year] = Array(12).fill(0)
              uwv[it.year][it.month - 1] += Math.abs(it.amount)
            } else if (it.category === 'ASR') {
              if (!asr[it.year]) asr[it.year] = Array(12).fill(0)
              asr[it.year][it.month - 1] += Math.abs(it.amount)
            } else if (it.category === 'WGL') {
              // Pensioen e.d. — telt bij werkgeverslasten, NIET bij overige kosten
              if (!wgl[it.year]) wgl[it.year] = Array(12).fill(0)
              wgl[it.year][it.month - 1] += it.amount
            } else if (it.category === 'MGMT') {
              // Management fee — apart bijgehouden, telt mee in totale kosten
              if (!mgmt[it.year]) mgmt[it.year] = Array(12).fill(0)
              mgmt[it.year][it.month - 1] += exBtw
            } else {
              // Reguliere kost (incl. ZZP) — ex BTW
              if (!overigPerYear[it.year]) overigPerYear[it.year] = Array(12).fill(0)
              overigPerYear[it.year][it.month - 1] += exBtw
              if (it.year === 2026) reg2026[it.month - 1] += exBtw
              if (it.category === 'ZZP') {
                if (!zzp[it.year]) zzp[it.year] = Array(12).fill(0)
                zzp[it.year][it.month - 1] += exBtw
              }
            }
          }
          setMonthlyCosts2026(reg2026)
          setUwvPerMonth(uwv)
          setAsrPerMonth(asr)
          setZzpPerMonth(zzp)
          setWglPerMonth(wgl)
          setMgmtPerMonth(mgmt)
          setOverigKostenPerYear(overigPerYear)
        }

        // Load sick days for managers
        if (session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN') {
          const sickRes = await fetch(`/api/sick-days?year=${currentYear}`)
          if (sickRes.ok) {
            const sickData = await sickRes.json()
            // New API returns { entries, totals } - we only need totals here
            setSickDaysTotals(sickData.totals || [])
          }
        }
      } catch (error) {
        console.error('Error loading financial data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [isManager])

  // Save current year data to API
  const saveCurrentYearData = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetch('/api/financien', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentYearData)
      })
      if (res.ok) {
        setSaveSuccess(true)
        // Hide success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Error saving data:', error)
    } finally {
      setSaving(false)
    }
  }

  // Get data for each year (using historical data or current year data from API)
  const getDataForYear = (year: number) => {
    if (year === currentYear) {
      return currentYearData
    }
    return getYearData(year)
  }

  // Calculate totals and saldo dynamically based on years
  const calculations = useMemo(() => {
    const totals: Record<string, Record<number, number>> = {
      werkgeverslasten: {},
      kostenExtern: {},
      totaleKosten: {}, // werkgeverslasten + kostenExtern
      omzet: {},
      uren: {}
    }

    const saldo: Record<number, number[]> = {}
    const saldoTotals: Record<number, number> = {}

    years.forEach(year => {
      const yearData = getDataForYear(year)
      totals.werkgeverslasten[year] = yearData.werkgeverslasten.reduce((a, b) => a + b, 0)
      totals.kostenExtern[year] = yearData.kostenExtern.reduce((a, b) => a + b, 0)
      // Werkgeverslasten = alleen bruto loon eigen mensen. Externe advocaten
      // (Lodewijk/Tentoo) zitten in MonthlyCost als category=ZZP.
      totals.totaleKosten[year] = totals.werkgeverslasten[year]
      totals.omzet[year] = yearData.omzet.reduce((a, b) => a + b, 0)
      totals.uren[year] = yearData.uren.reduce((a, b) => a + b, 0)
      saldo[year] = periods.map((_, i) => yearData.omzet[i] - yearData.werkgeverslasten[i])
      saldoTotals[year] = totals.omzet[year] - totals.totaleKosten[year]
    })

    return { totals, saldo, saldoTotals }
  }, [currentYearData])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)
  }

  // Bar chart component
  const BarChart = ({ data, labels, title, colors, height = 200 }: {
    data: number[][]
    labels: string[]
    title: string
    colors: string[]
    height?: number
  }) => {
    const maxValue = Math.max(...data.flat().map(Math.abs))
    const barWidth = 100 / (labels.length * data.length + labels.length)
    const groupWidth = barWidth * data.length

    return (
      <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-medium mb-4">{title}</h3>
        <div className="relative" style={{ height }}>
          <svg width="100%" height="100%" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="0" y1={y * height / 100} x2="100" y2={y * height / 100} stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" />
            ))}
            {/* Bars */}
            {labels.map((_, labelIdx) => (
              data.map((series, seriesIdx) => {
                const value = series[labelIdx] || 0
                const barHeight = Math.abs(value) / maxValue * (height * 0.8)
                const x = labelIdx * (groupWidth + barWidth) + seriesIdx * barWidth + barWidth / 2
                const isNegative = value < 0
                const y = isNegative ? height * 0.5 : height * 0.5 - barHeight

                return (
                  <rect
                    key={`${labelIdx}-${seriesIdx}`}
                    x={x}
                    y={y}
                    width={barWidth * 0.8}
                    height={barHeight}
                    fill={colors[seriesIdx]}
                    rx="0.5"
                    opacity="0.9"
                  />
                )
              })
            ))}
          </svg>
        </div>
        <div className="flex justify-center gap-6 mt-4">
          {colors.map((color, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-white/60">{years[i]}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Line chart component with zero line for saldo charts
  // Only shows data points that have actual values (not zero) for current year
  const LineChart = ({ data, labels, title, colors, height = 200 }: {
    data: number[][]
    labels: string[]
    title: string
    colors: string[]
    height?: number
  }) => {
    const allValues = data.flat()
    const maxValue = Math.max(...allValues)
    const minValue = Math.min(...allValues)

    // Include zero in the range if we have both positive and negative values
    const hasNegative = minValue < 0
    const hasPositive = maxValue > 0
    const adjustedMin = hasNegative && hasPositive ? Math.min(minValue, 0) : minValue
    const adjustedMax = hasNegative && hasPositive ? Math.max(maxValue, 0) : maxValue
    const range = adjustedMax - adjustedMin || 1

    const getY = (value: number) => {
      return height * 0.9 - ((value - adjustedMin) / range) * (height * 0.8)
    }

    const getX = (index: number) => {
      return (index / (labels.length - 1)) * 95 + 2.5
    }

    // Calculate zero line position
    const zeroY = getY(0)
    const showZeroLine = hasNegative && hasPositive

    return (
      <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-medium mb-4">{title}</h3>
        <div className="relative" style={{ height }}>
          <svg width="100%" height="100%" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="0" y1={y * height / 100} x2="100" y2={y * height / 100} stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" />
            ))}
            {/* Zero line - prominent when data has both positive and negative */}
            {showZeroLine && (
              <line
                x1="0"
                y1={zeroY}
                x2="100"
                y2={zeroY}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="0.3"
                strokeDasharray="2,2"
              />
            )}
            {/* Negative zone shading */}
            {showZeroLine && (
              <rect
                x="0"
                y={zeroY}
                width="100"
                height={height * 0.9 - zeroY + height * 0.05}
                fill="rgba(239,68,68,0.1)"
              />
            )}
            {/* Lines - for current year (last series), only draw line segments between non-zero points */}
            {data.map((series, seriesIdx) => {
              const isCurrentYear = seriesIdx === data.length - 1

              // For current year, show points for all data (including connecting lines for consecutive non-zero)
              if (isCurrentYear) {
                // Find indices with actual data (non-zero values)
                const nonZeroIndices = series.map((v, i) => v !== 0 ? i : -1).filter(i => i >= 0)

                // If no data or all zeros, don't draw
                if (nonZeroIndices.length === 0) return null

                // Build line segments between consecutive non-zero points
                const lineSegments: string[] = []
                for (let j = 0; j < nonZeroIndices.length - 1; j++) {
                  if (nonZeroIndices[j + 1] - nonZeroIndices[j] === 1) {
                    // Consecutive points - draw line
                    lineSegments.push(`${getX(nonZeroIndices[j])},${getY(series[nonZeroIndices[j]])}`)
                  }
                }
                if (lineSegments.length > 0 && nonZeroIndices.length > 1) {
                  const lastIdx = nonZeroIndices[nonZeroIndices.length - 1]
                  lineSegments.push(`${getX(lastIdx)},${getY(series[lastIdx])}`)
                }

                return (
                  <g key={seriesIdx}>
                    {/* Draw line connecting consecutive non-zero points */}
                    {lineSegments.length > 1 && (
                      <polyline
                        points={lineSegments.join(' ')}
                        fill="none"
                        stroke={colors[seriesIdx]}
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Draw larger, more visible points for current year */}
                    {series.map((value, i) => {
                      if (value === 0) return null
                      return (
                        <g key={i}>
                          {/* Outer glow */}
                          <circle
                            cx={getX(i)}
                            cy={getY(value)}
                            r="4"
                            fill={colors[seriesIdx]}
                            opacity="0.3"
                          />
                          {/* Inner point */}
                          <circle
                            cx={getX(i)}
                            cy={getY(value)}
                            r="2.5"
                            fill={colors[seriesIdx]}
                          />
                        </g>
                      )
                    })}
                  </g>
                )
              }

              // For historical years, draw full line as before
              const points = series.map((value, i) => `${getX(i)},${getY(value)}`).join(' ')
              return (
                <g key={seriesIdx}>
                  <polyline
                    points={points}
                    fill="none"
                    stroke={colors[seriesIdx]}
                    strokeWidth="0.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {series.map((value, i) => (
                    <circle
                      key={i}
                      cx={getX(i)}
                      cy={getY(value)}
                      r="1"
                      fill={colors[seriesIdx]}
                    />
                  ))}
                </g>
              )
            })}
          </svg>
          {/* Zero label */}
          {showZeroLine && (
            <span
              className="absolute right-0 text-xs text-gray-400 -translate-y-1/2"
              style={{ top: `${(zeroY / height) * 100}%` }}
            >
              €0
            </span>
          )}
        </div>
        <div className="flex justify-between mt-2 px-2">
          {labels.map((label, i) => (
            <span key={i} className="text-xs text-gray-400">{label}</span>
          ))}
        </div>
        <div className="flex justify-center gap-6 mt-4">
          {colors.map((color, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-white/60">{years[i]}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Budget donut chart
  const BudgetDonut = ({ spent, budget, size = 120 }: { spent: number; budget: number; size?: number }) => {
    const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
    const remaining = budget - spent
    const circumference = 2 * Math.PI * 45
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
    const isOverBudget = spent > budget

    return (
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isOverBudget ? '#ef4444' : '#f9ff85'}
            strokeWidth="8"
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-semibold ${isOverBudget ? 'text-red-400' : 'text-workx-lime'}`}>
            {percentage.toFixed(0)}%
          </span>
          <span className="text-xs text-gray-400">gebruikt</span>
        </div>
      </div>
    )
  }

  // Add budget via API
  const addBudget = async () => {
    if (!newBudgetName || !newBudgetAmount) return
    try {
      const res = await fetch('/api/financien/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBudgetName,
          budget: parseFloat(newBudgetAmount),
          spent: 0
        })
      })
      if (res.ok) {
        const newBudget = await res.json()
        setBudgets([...budgets, newBudget])
        setNewBudgetName('')
        setNewBudgetAmount('')
      }
    } catch (error) {
      console.error('Error adding budget:', error)
    }
  }

  // Update budget spent via API
  const updateBudgetSpent = async (id: string, spent: number) => {
    setBudgets(budgets.map(b => b.id === id ? { ...b, spent } : b))
    try {
      await fetch(`/api/financien/budgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spent })
      })
    } catch (error) {
      console.error('Error updating budget:', error)
    }
  }

  // Update budget amount via API
  const updateBudgetAmount = async (id: string, budget: number) => {
    setBudgets(budgets.map(b => b.id === id ? { ...b, budget } : b))
    try {
      await fetch(`/api/financien/budgets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ budget })
      })
    } catch (error) {
      console.error('Error updating budget:', error)
    }
  }

  // Delete budget via API
  const deleteBudget = async (id: string) => {
    setBudgets(budgets.filter(b => b.id !== id))
    try {
      await fetch(`/api/financien/budgets/${id}`, {
        method: 'DELETE'
      })
    } catch (error) {
      console.error('Error deleting budget:', error)
    }
  }

  // PDF Export
  const downloadPDF = async () => {
    // Pre-load the logo image
    const logoDataUrl = await loadWorkxLogo()

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Column positions - adjusted for better spacing
    const col1 = 20    // Label
    const col2 = 95    // 2024
    const col3 = 135   // 2025
    const col4 = 175   // Verschil

    // Draw official Workx logo (flush top-left)
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    // Title
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Financieel Overzicht', 60, 15)

    // Date
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const dateStr = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(dateStr, 80, 36)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 15, 50)

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(15, 52, pageWidth - 15, 52)

    let y = 62

    // Totals section
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Jaaroverzicht', 15, y)
    y += 10

    // Table header
    doc.setFillColor(245, 245, 245)
    doc.rect(15, y, pageWidth - 30, 10, 'F')
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Categorie', col1, y + 7)
    doc.text(String(years[0]), col2, y + 7, { align: 'right' })
    doc.text(String(years[1]), col3, y + 7, { align: 'right' })
    doc.text('Verschil', col4, y + 7, { align: 'right' })
    y += 15

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    // Werkgeverslasten
    doc.text('Werkgeverslasten', col1, y)
    doc.text(formatCurrency(calculations.totals.werkgeverslasten[years[0]]), col2, y, { align: 'right' })
    doc.text(formatCurrency(calculations.totals.werkgeverslasten[years[1]]), col3, y, { align: 'right' })
    const wlDiff = calculations.totals.werkgeverslasten[years[1]] - calculations.totals.werkgeverslasten[years[0]]
    doc.setTextColor(wlDiff < 0 ? 0 : 200, wlDiff < 0 ? 150 : 50, 50)
    doc.text(formatCurrency(wlDiff), col4, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 8

    // Omzet
    doc.text('Omzet', col1, y)
    doc.text(formatCurrency(calculations.totals.omzet[years[0]]), col2, y, { align: 'right' })
    doc.text(formatCurrency(calculations.totals.omzet[years[1]]), col3, y, { align: 'right' })
    const omzetDiff = calculations.totals.omzet[years[1]] - calculations.totals.omzet[years[0]]
    doc.setTextColor(omzetDiff > 0 ? 0 : 200, omzetDiff > 0 ? 150 : 50, 50)
    doc.text(formatCurrency(omzetDiff), col4, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 8

    // Uren
    doc.text('Uren', col1, y)
    doc.text(formatNumber(calculations.totals.uren[years[0]]), col2, y, { align: 'right' })
    doc.text(formatNumber(calculations.totals.uren[years[1]]), col3, y, { align: 'right' })
    const urenDiff = calculations.totals.uren[years[1]] - calculations.totals.uren[years[0]]
    doc.setTextColor(urenDiff > 0 ? 0 : 200, urenDiff > 0 ? 150 : 50, 50)
    doc.text(formatNumber(urenDiff), col4, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 12

    // Saldo row with yellow background
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(249, 255, 133)
    doc.rect(15, y - 5, pageWidth - 30, 12, 'F')
    doc.setTextColor(30, 30, 30)
    doc.text('Saldo', col1, y + 3)
    doc.text(formatCurrency(calculations.saldoTotals[years[0]]), col2, y + 3, { align: 'right' })
    doc.text(formatCurrency(calculations.saldoTotals[years[1]]), col3, y + 3, { align: 'right' })
    const saldoDiff = calculations.saldoTotals[years[1]] - calculations.saldoTotals[years[0]]
    doc.text(formatCurrency(saldoDiff), col4, y + 3, { align: 'right' })
    y += 25

    // ===================== GRAPHS SECTION =====================
    doc.setTextColor(50, 50, 50)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Grafieken', 15, y)
    y += 12

    // Helper function to draw a mini bar chart
    const drawBarChart = (title: string, data: number[][], startY: number, chartWidth: number, chartHeight: number, startX: number) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(50, 50, 50)
      doc.text(title, startX, startY)

      const barY = startY + 5
      const maxValue = Math.max(...data.flat().map(Math.abs)) || 1
      const barWidth = chartWidth / (12 * 2 + 11) // 12 groups of 2 bars with gaps
      const groupWidth = barWidth * 2 + 2

      // Draw bars for each month
      for (let month = 0; month < 12; month++) {
        const x = startX + month * groupWidth

        // Year 0 bar (orange)
        const h0 = (Math.abs(data[0][month]) / maxValue) * chartHeight
        doc.setFillColor(249, 115, 22)
        doc.rect(x, barY + chartHeight - h0, barWidth, h0, 'F')

        // Year 1 bar (cyan)
        const h1 = (Math.abs(data[1][month]) / maxValue) * chartHeight
        doc.setFillColor(6, 182, 212)
        doc.rect(x + barWidth + 1, barY + chartHeight - h1, barWidth, h1, 'F')
      }

      // Legend
      const legendY = barY + chartHeight + 5
      doc.setFontSize(7)
      doc.setFillColor(249, 115, 22)
      doc.rect(startX, legendY, 4, 4, 'F')
      doc.setTextColor(100, 100, 100)
      doc.text(String(years[0]), startX + 6, legendY + 3)

      doc.setFillColor(6, 182, 212)
      doc.rect(startX + 25, legendY, 4, 4, 'F')
      doc.text(String(years[1]), startX + 31, legendY + 3)

      return legendY + 10
    }

    // Draw 4 mini charts (2x2 grid)
    const chartWidth = 80
    const chartHeight = 25
    const leftX = 20
    const rightX = 110

    // Row 1: Omzet and Werkgeverslasten
    drawBarChart('Omzet', [getDataForYear(years[0]).omzet, getDataForYear(years[1]).omzet], y, chartWidth, chartHeight, leftX)
    const afterRow1 = drawBarChart('Werkgeverslasten', [
      getDataForYear(years[0]).werkgeverslasten,
      getDataForYear(years[1]).werkgeverslasten,
    ], y, chartWidth, chartHeight, rightX)
    y = afterRow1 + 5

    // Row 2: Saldo and Uren
    drawBarChart('Saldo', [calculations.saldo[years[0]], calculations.saldo[years[1]]], y, chartWidth, chartHeight, leftX)
    const afterRow2 = drawBarChart('Uren', [getDataForYear(years[0]).uren, getDataForYear(years[1]).uren], y, chartWidth, chartHeight, rightX)
    y = afterRow2 + 10

    // Budgets section
    if (budgets.length > 0) {
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Budgetten', 15, y)
      y += 10

      doc.setFillColor(245, 245, 245)
      doc.rect(15, y, pageWidth - 30, 10, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('Categorie', col1, y + 7)
      doc.text('Budget', col2, y + 7, { align: 'right' })
      doc.text('Besteed', col3, y + 7, { align: 'right' })
      doc.text('Resterend', col4, y + 7, { align: 'right' })
      y += 15

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      budgets.forEach(budget => {
        const remaining = budget.budget - budget.spent
        doc.text(budget.name, col1, y)
        doc.text(formatCurrency(budget.budget), col2, y, { align: 'right' })
        doc.text(formatCurrency(budget.spent), col3, y, { align: 'right' })
        doc.setTextColor(remaining >= 0 ? 0 : 200, remaining >= 0 ? 150 : 50, 50)
        doc.text(formatCurrency(remaining), col4, y, { align: 'right' })
        doc.setTextColor(50, 50, 50)
        y += 8
      })

      // Budget totals
      const totalBudget = budgets.reduce((a, b) => a + b.budget, 0)
      const totalSpent = budgets.reduce((a, b) => a + b.spent, 0)
      const totalRemaining = totalBudget - totalSpent

      y += 4
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Totaal', col1, y)
      doc.text(formatCurrency(totalBudget), col2, y, { align: 'right' })
      doc.text(formatCurrency(totalSpent), col3, y, { align: 'right' })
      doc.setTextColor(totalRemaining >= 0 ? 0 : 200, totalRemaining >= 0 ? 150 : 50, 50)
      doc.text(formatCurrency(totalRemaining), col4, y, { align: 'right' })
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15
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

  const totalBudget = budgets.reduce((a, b) => a + (Number(b.budget) || 0), 0)
  const totalSpent = budgets.reduce((a, b) => a + (Number(b.spent) || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-workx-lime"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-[5%] w-48 h-48 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">Financiën</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">Overzicht werkgeverslasten, omzet en budgetten</p>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-workx-lime text-workx-dark rounded-xl font-medium hover:bg-workx-lime/90 transition-colors text-sm sm:text-base self-start sm:self-auto"
        >
          <Icons.download size={18} />
          <span className="hidden sm:inline">PDF Export</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Tabs - horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
        <div className="flex gap-2">
          {[
            { id: 'overzicht' as TabType, label: 'Overzicht', icon: Icons.chart },
            { id: 'budgetten' as TabType, label: 'Budgetten', icon: Icons.pieChart },
            { id: 'salarishuis' as TabType, label: 'Salarishuis', icon: Icons.euro },
            ...(isManager ? [{ id: 'inzichten' as TabType, label: 'Inzichten', icon: Icons.activity }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap text-xs sm:text-base ${
                activeTab === tab.id
                  ? 'bg-workx-lime text-workx-dark'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <tab.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overzicht Tab */}
      {activeTab === 'overzicht' && (
        <div className="space-y-6">
          {/* KPI Cards — alle cijfers over dezelfde periode (t/m laatst
              ingevulde maand in {currentYear}). 2025 wordt voor exact
              dezelfde periode erbij gehaald (appels-appels). UWV/ASR
              terugbetalingen worden van werkgeverslasten afgetrokken
              voor beide jaren — daar hebben we van beide jaren data.
              Overige kosten staan los (alleen 2026), dus daar tonen we
              twee diff-regels: incl. (volledig beeld) en excl. (puur
              werkgeverslasten-vergelijking met UWV/ASR meegenomen). */}
          {(() => {
            const cur = getDataForYear(years[2])
            let lastMonth = 0
            for (let m = 0; m < 12; m++) {
              if (cur.omzet[m] !== 0 || cur.werkgeverslasten[m] !== 0) lastMonth = m + 1
            }
            if (lastMonth === 0) lastMonth = 12
            const sumTo = (arr: number[], n: number) => arr.slice(0, n).reduce((s, v) => s + (v || 0), 0)
            const periodLabel = lastMonth === 12 ? 'heel jaar' : `P1–P${lastMonth}`

            const prev = getDataForYear(years[1])
            const uwvCurArr = uwvPerMonth[years[2]] || Array(12).fill(0)
            const asrCurArr = asrPerMonth[years[2]] || Array(12).fill(0)
            const uwvPrevArr = uwvPerMonth[years[1]] || Array(12).fill(0)
            const asrPrevArr = asrPerMonth[years[1]] || Array(12).fill(0)
            const zzpCurArr = zzpPerMonth[years[2]] || Array(12).fill(0)
            const zzpPrevArr = zzpPerMonth[years[1]] || Array(12).fill(0)
            const wglCurArr = wglPerMonth[years[2]] || Array(12).fill(0)
            const wglPrevArr = wglPerMonth[years[1]] || Array(12).fill(0)
            const mgmtCurArr = mgmtPerMonth[years[2]] || Array(12).fill(0)
            const mgmtPrevArr = mgmtPerMonth[years[1]] || Array(12).fill(0)
            const overigCurArr = overigKostenPerYear[years[2]] || Array(12).fill(0)
            const overigPrevArr = overigKostenPerYear[years[1]] || Array(12).fill(0)

            // 2026 t/m lastMonth — Werkgeverslasten = bruto loon + pensioen − UWV − ASR
            const omzetCur = sumTo(cur.omzet, lastMonth)
            const wkzBruto = sumTo(cur.werkgeverslasten, lastMonth) + sumTo(wglCurArr, lastMonth)
            const uwvCur = sumTo(uwvCurArr, lastMonth)
            const asrCur = sumTo(asrCurArr, lastMonth)
            const wkzNet = wkzBruto - uwvCur - asrCur
            const zzpCur = sumTo(zzpCurArr, lastMonth)
            const advocatenKosten = wkzNet + zzpCur  // info-cijfer: totale advocatenkosten
            const mgmtCur = sumTo(mgmtCurArr, lastMonth)
            const overigeKosten = sumTo(overigCurArr, lastMonth)
            const totaleKosten = wkzNet + overigeKosten + mgmtCur
            const saldoTotaal = omzetCur - totaleKosten
            const saldoExcl = omzetCur - wkzNet
            const urenCur = sumTo(cur.uren, lastMonth)

            // 2025 t/m dezelfde lastMonth — incl. pensioen + UWV/ASR (appels-appels)
            const omzetPrev = sumTo(prev.omzet, lastMonth)
            const wkzBrutoPrev = sumTo(prev.werkgeverslasten, lastMonth) + sumTo(wglPrevArr, lastMonth)
            const uwvPrev = sumTo(uwvPrevArr, lastMonth)
            const asrPrev = sumTo(asrPrevArr, lastMonth)
            const wkzNetPrev = wkzBrutoPrev - uwvPrev - asrPrev
            const zzpPrev = sumTo(zzpPrevArr, lastMonth)
            const advocatenKostenPrev = wkzNetPrev + zzpPrev
            const mgmtPrev = sumTo(mgmtPrevArr, lastMonth)
            const overigPrev = sumTo(overigPrevArr, lastMonth)
            const totaleKostenPrev = wkzNetPrev + overigPrev + mgmtPrev
            const saldoPrev = omzetPrev - totaleKostenPrev
            const urenPrev = sumTo(prev.uren, lastMonth)
            const hasUwvAsr = (uwvCur + asrCur + uwvPrev + asrPrev) > 0
            const hasZzp = (zzpCur + zzpPrev) > 0
            const hasMgmt = (mgmtCur + mgmtPrev) > 0

            type Diff = { amount: number; label: string; positive: boolean; isNumber?: boolean }
            const kpis: Array<{ label: string; value: string; diffs: Diff[] }> = [
              {
                label: `Omzet ${years[2]} (${periodLabel})`,
                value: formatCurrency(omzetCur),
                diffs: [
                  { amount: omzetCur - omzetPrev, label: `vs ${years[1]} ${periodLabel}`, positive: true },
                ],
              },
              {
                label: `Totale Kosten ${years[2]} (${periodLabel})`,
                value: formatCurrency(totaleKosten),
                diffs: [
                  { amount: totaleKosten - totaleKostenPrev, label: `Totale Kosten vs ${years[1]} (appels-appels)`, positive: false },
                  { amount: wkzNet - wkzNetPrev, label: `Werkgeverslasten vs ${years[1]}`, positive: false },
                  ...(hasMgmt ? [{ amount: mgmtCur - mgmtPrev, label: `waarvan Management fee vs ${years[1]}`, positive: false }] : []),
                  ...(hasZzp ? [{ amount: advocatenKosten - advocatenKostenPrev, label: `Advocaten (loon + ZZP) vs ${years[1]}`, positive: false }] : []),
                ],
              },
              {
                label: `Saldo ${years[2]} (${periodLabel})`,
                value: formatCurrency(saldoTotaal),
                diffs: [
                  { amount: saldoTotaal - saldoPrev, label: `na Totale Kosten vs ${years[1]} (appels-appels)`, positive: true },
                  { amount: saldoExcl - (omzetPrev - wkzNetPrev), label: `na Werkgeverslasten vs ${years[1]}`, positive: true },
                ],
              },
              {
                label: `Uren ${years[2]} (${periodLabel})`,
                value: formatNumber(urenCur),
                diffs: [
                  { amount: urenCur - urenPrev, label: `vs ${years[1]} ${periodLabel}`, positive: true, isNumber: true },
                ],
              },
            ]
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {kpis.map((kpi, i) => (
                  <div key={i} className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
                    <p className="text-gray-400 text-xs sm:text-sm truncate">{kpi.label}</p>
                    <p className="text-lg sm:text-2xl font-semibold text-white mt-1 truncate">{kpi.value}</p>
                    <div className="mt-1 sm:mt-2 space-y-0.5">
                      {kpi.diffs.map((d, j) => {
                        const good = (d.positive && d.amount > 0) || (!d.positive && d.amount < 0)
                        return (
                          <div key={j} className={`flex items-center gap-1 text-[11px] sm:text-xs ${good ? 'text-green-400' : 'text-red-400'}`}>
                            {d.amount > 0
                              ? <Icons.trendingUp size={11} className="flex-shrink-0" />
                              : <Icons.trendingDown size={11} className="flex-shrink-0" />}
                            <span className="tabular-nums">{d.amount > 0 ? '+' : ''}{d.isNumber ? formatNumber(d.amount) : formatCurrency(d.amount)}</span>
                            <span className="text-white/40 truncate">{d.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Totale kosten 2025 vs 2026 — appels-appels tot laatste invoer 2026 */}
          {(() => {
            const cur = getDataForYear(years[2])
            const prev = getDataForYear(years[1])
            let lastMonth = 0
            for (let m = 0; m < 12; m++) {
              if (cur.omzet[m] !== 0 || cur.werkgeverslasten[m] !== 0) lastMonth = m + 1
            }
            if (lastMonth === 0) return null
            const sumTo = (arr: number[], n: number) => arr.slice(0, n).reduce((s, v) => s + (v || 0), 0)
            const periodLabel = lastMonth === 12 ? 'heel jaar' : `P1–P${lastMonth}`

            const wglCurArr = wglPerMonth[years[2]] || Array(12).fill(0)
            const wglPrevArr = wglPerMonth[years[1]] || Array(12).fill(0)
            const uwvCurArr = uwvPerMonth[years[2]] || Array(12).fill(0)
            const uwvPrevArr = uwvPerMonth[years[1]] || Array(12).fill(0)
            const asrCurArr = asrPerMonth[years[2]] || Array(12).fill(0)
            const asrPrevArr = asrPerMonth[years[1]] || Array(12).fill(0)
            const mgmtCurArr = mgmtPerMonth[years[2]] || Array(12).fill(0)
            const mgmtPrevArr = mgmtPerMonth[years[1]] || Array(12).fill(0)
            const overigCurArr = overigKostenPerYear[years[2]] || Array(12).fill(0)
            const overigPrevArr = overigKostenPerYear[years[1]] || Array(12).fill(0)

            const wkzCur = sumTo(cur.werkgeverslasten, lastMonth) + sumTo(wglCurArr, lastMonth) - sumTo(uwvCurArr, lastMonth) - sumTo(asrCurArr, lastMonth)
            const wkzPrev = sumTo(prev.werkgeverslasten, lastMonth) + sumTo(wglPrevArr, lastMonth) - sumTo(uwvPrevArr, lastMonth) - sumTo(asrPrevArr, lastMonth)
            const mgmtCur = sumTo(mgmtCurArr, lastMonth)
            const mgmtPrev = sumTo(mgmtPrevArr, lastMonth)
            const overigCur = sumTo(overigCurArr, lastMonth)
            const overigPrev = sumTo(overigPrevArr, lastMonth)
            const totCur = wkzCur + mgmtCur + overigCur
            const totPrev = wkzPrev + mgmtPrev + overigPrev

            if (totCur === 0 && totPrev === 0) return null

            const Row = ({ label, v2025, v2026, accent, tooltip }: { label: string; v2025: number; v2026: number; accent: string; tooltip?: string }) => {
              const diff = v2026 - v2025
              const pct = v2025 > 0 ? (diff / v2025) * 100 : null
              return (
                <tr className="border-b border-white/5">
                  <td className="py-2.5 px-3 text-sm text-white" title={tooltip}>{label}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-gray-300">{formatCurrency(v2025)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${accent}`}>{formatCurrency(v2026)}</td>
                  <td className={`py-2.5 px-3 text-right tabular-nums text-sm ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {diff !== 0 ? (diff > 0 ? '+' : '') + formatCurrency(diff) : '—'}
                  </td>
                  <td className={`py-2.5 px-3 text-right tabular-nums text-xs ${pct === null ? 'text-gray-500' : pct > 0 ? 'text-red-400' : pct < 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`}
                  </td>
                </tr>
              )
            }

            return (
              <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-medium">Totale Kosten — {years[1]} vs {years[2]} ({periodLabel})</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Werkgeverslasten + Management fee + Overige kosten, ex BTW. Appels-appels tot laatste invoer {years[2]}.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Δ Totale Kosten</p>
                    <p className={`text-lg font-bold tabular-nums ${(totCur - totPrev) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {(totCur - totPrev) > 0 ? '+' : ''}{formatCurrency(totCur - totPrev)}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {totPrev > 0 ? `${(((totCur - totPrev) / totPrev) * 100).toFixed(1)}% vs ${years[1]}` : ''}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                        <th className="py-2 px-3 font-medium">Kostenpost</th>
                        <th className="py-2 px-3 font-medium text-right">{years[1]} {periodLabel}</th>
                        <th className="py-2 px-3 font-medium text-right">{years[2]} {periodLabel}</th>
                        <th className="py-2 px-3 font-medium text-right">Δ</th>
                        <th className="py-2 px-3 font-medium text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <Row
                        label="Werkgeverslasten (bruto loon + pensioen − UWV/ASR)"
                        v2025={wkzPrev}
                        v2026={wkzCur}
                        accent="text-workx-lime"
                        tooltip="Bruto loon van eigen medewerkers plus Bright pensioen minus UWV/ASR-vergoedingen"
                      />
                      <Row
                        label="Management fee partners"
                        v2025={mgmtPrev}
                        v2026={mgmtCur}
                        accent="text-cyan-400"
                        tooltip="Uitkeringen naar partner-holdings (Les Dents Du Midi, Meneer Nilsson, Cavalieri, Jader)"
                      />
                      <Row
                        label="Overige kosten"
                        v2025={overigPrev}
                        v2026={overigCur}
                        accent="text-orange-300"
                        tooltip="Alle overige bedrijfskosten (huur, software, advocaten, kantoor) ex BTW"
                      />
                      <tr className="border-t-2 border-white/10 bg-white/[0.02]">
                        <td className="py-3 px-3 text-white font-bold">Totale Kosten</td>
                        <td className="py-3 px-3 text-right tabular-nums text-gray-200 font-bold">{formatCurrency(totPrev)}</td>
                        <td className="py-3 px-3 text-right tabular-nums text-white font-bold">{formatCurrency(totCur)}</td>
                        <td className={`py-3 px-3 text-right tabular-nums font-bold ${(totCur - totPrev) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {(totCur - totPrev) > 0 ? '+' : ''}{formatCurrency(totCur - totPrev)}
                        </td>
                        <td className={`py-3 px-3 text-right tabular-nums font-bold ${totPrev > 0 && (totCur - totPrev) > 0 ? 'text-red-400' : totPrev > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                          {totPrev > 0 ? `${(totCur - totPrev) > 0 ? '+' : ''}${(((totCur - totPrev) / totPrev) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Cumulatieve totale kosten 2025 vs 2026 */}
          {(() => {
            const cur = getDataForYear(years[2])
            const prev = getDataForYear(years[1])
            let lastMonth = 0
            for (let m = 0; m < 12; m++) {
              if (cur.omzet[m] !== 0 || cur.werkgeverslasten[m] !== 0) lastMonth = m + 1
            }
            if (lastMonth === 0) return null

            const wglCurArr = wglPerMonth[years[2]] || Array(12).fill(0)
            const wglPrevArr = wglPerMonth[years[1]] || Array(12).fill(0)
            const uwvCurArr = uwvPerMonth[years[2]] || Array(12).fill(0)
            const uwvPrevArr = uwvPerMonth[years[1]] || Array(12).fill(0)
            const asrCurArr = asrPerMonth[years[2]] || Array(12).fill(0)
            const asrPrevArr = asrPerMonth[years[1]] || Array(12).fill(0)
            const mgmtCurArr = mgmtPerMonth[years[2]] || Array(12).fill(0)
            const mgmtPrevArr = mgmtPerMonth[years[1]] || Array(12).fill(0)
            const overigCurArr = overigKostenPerYear[years[2]] || Array(12).fill(0)
            const overigPrevArr = overigKostenPerYear[years[1]] || Array(12).fill(0)

            // Maandkosten = werkgeverslasten + WGL − UWV − ASR + mgmt + overig
            const monthCostsCur = Array.from({ length: 12 }, (_, i) =>
              (cur.werkgeverslasten[i] || 0) + (wglCurArr[i] || 0)
              - (uwvCurArr[i] || 0) - (asrCurArr[i] || 0)
              + (mgmtCurArr[i] || 0) + (overigCurArr[i] || 0)
            )
            const monthCostsPrev = Array.from({ length: 12 }, (_, i) =>
              (prev.werkgeverslasten[i] || 0) + (wglPrevArr[i] || 0)
              - (uwvPrevArr[i] || 0) - (asrPrevArr[i] || 0)
              + (mgmtPrevArr[i] || 0) + (overigPrevArr[i] || 0)
            )

            // Cumulatief
            const cumCur: number[] = []
            const cumPrev: number[] = []
            let aCur = 0, aPrev = 0
            for (let i = 0; i < 12; i++) {
              aCur += monthCostsCur[i]; cumCur.push(aCur)
              aPrev += monthCostsPrev[i]; cumPrev.push(aPrev)
            }

            const sumCur = cumCur[lastMonth - 1]
            const sumPrev = cumPrev[lastMonth - 1]
            const sumPrevYear = cumPrev[11]
            const periodLabel = lastMonth === 12 ? 'heel jaar' : `t/m P${lastMonth}`

            // SVG layout
            const svgW = 800
            const svgH = 320
            const padL = 70, padR = 40, padT = 20, padB = 50
            const plotW = svgW - padL - padR
            const plotH = svgH - padT - padB
            const yMax = Math.max(...cumCur.slice(0, lastMonth), ...cumPrev) * 1.1
            const yMin = 0
            const x = (i: number) => padL + (i / 11) * plotW
            const y = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH

            const smoothPath = (pts: { x: number; y: number }[]) => {
              if (pts.length < 2) return ''
              let d = `M ${pts[0].x},${pts[0].y}`
              for (let i = 1; i < pts.length; i++) {
                const p = pts[i - 1], c = pts[i]
                const cpx = (p.x + c.x) / 2
                d += ` C ${cpx},${p.y} ${cpx},${c.y} ${c.x},${c.y}`
              }
              return d
            }

            const ptsCur = cumCur.slice(0, lastMonth).map((v, i) => ({ x: x(i), y: y(v) }))
            const ptsPrevSolid = cumPrev.slice(0, lastMonth).map((v, i) => ({ x: x(i), y: y(v) }))
            const ptsPrevDashed = cumPrev.slice(lastMonth - 1).map((v, i) => ({ x: x(lastMonth - 1 + i), y: y(v) }))

            // Y-ticks
            const tickStep = Math.ceil((yMax - yMin) / 5 / 100000) * 100000 || 100000
            const yTicks: number[] = []
            for (let v = 0; v <= yMax; v += tickStep) yTicks.push(v)

            return (
              <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-medium">Cumulatieve kosten {years[1]} vs {years[2]}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Werkgeverslasten + Management fee + Overige kosten, ex BTW, cumulatief. Verticale lijn = laatste invoer {years[2]} ({periodLabel}).
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Op {periodLabel}</p>
                    <p className="text-sm tabular-nums text-gray-300">{years[1]}: <span className="font-bold text-white">{formatCurrency(sumPrev)}</span></p>
                    <p className="text-sm tabular-nums text-workx-lime font-bold">{years[2]}: {formatCurrency(sumCur)}</p>
                    <p className={`text-xs tabular-nums mt-0.5 ${(sumCur - sumPrev) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      Δ {(sumCur - sumPrev) > 0 ? '+' : ''}{formatCurrency(sumCur - sumPrev)}
                      {sumPrev > 0 ? ` (${(((sumCur - sumPrev) / sumPrev) * 100).toFixed(1)}%)` : ''}
                    </p>
                  </div>
                </div>

                <div className="relative mt-4" style={{ height: svgH }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
                    {/* Grid + Y labels */}
                    {yTicks.map(v => (
                      <g key={v}>
                        <line x1={padL} y1={y(v)} x2={padL + plotW} y2={y(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={padL - 8} y={y(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">
                          €{(v / 1000).toFixed(0)}k
                        </text>
                      </g>
                    ))}

                    {/* X-axis labels (maanden) */}
                    {periods.map((p, i) => (
                      <text key={p} x={x(i)} y={padT + plotH + 18} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="system-ui">
                        {p}
                      </text>
                    ))}

                    {/* Verticale marker op lastMonth */}
                    <line
                      x1={x(lastMonth - 1)} y1={padT}
                      x2={x(lastMonth - 1)} y2={padT + plotH}
                      stroke="rgba(249, 255, 133, 0.3)" strokeWidth="1" strokeDasharray="4,4"
                    />
                    <text x={x(lastMonth - 1)} y={padT - 6} textAnchor="middle" fill="rgba(249,255,133,0.7)" fontSize="10" fontFamily="system-ui">
                      laatste invoer {years[2]}
                    </text>

                    {/* 2025 doorgetrokken hele jaar — solide tot lastMonth, gestippeld erna */}
                    <path d={smoothPath(ptsPrevSolid)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={smoothPath(ptsPrevDashed)} fill="none" stroke="#9ca3af" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,4" />

                    {/* 2026 — alleen tot lastMonth */}
                    <path d={smoothPath(ptsCur)} fill="none" stroke="#f9ff85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Eindpunten */}
                    {ptsCur.length > 0 && (
                      <g>
                        <circle cx={ptsCur[ptsCur.length - 1].x} cy={ptsCur[ptsCur.length - 1].y} r="5" fill="#f9ff85" opacity="0.3" />
                        <circle cx={ptsCur[ptsCur.length - 1].x} cy={ptsCur[ptsCur.length - 1].y} r="3" fill="#f9ff85" />
                      </g>
                    )}
                    {ptsPrevSolid.length > 0 && (
                      <circle cx={ptsPrevSolid[ptsPrevSolid.length - 1].x} cy={ptsPrevSolid[ptsPrevSolid.length - 1].y} r="3" fill="#9ca3af" />
                    )}

                    {/* 2025 eindpunt (heel jaar) */}
                    <circle cx={x(11)} cy={y(sumPrevYear)} r="3" fill="#9ca3af" opacity="0.6" />
                  </svg>
                </div>

                <div className="flex items-center justify-between mt-2 text-xs flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2 text-gray-400">
                      <span className="w-4 h-0.5 bg-gray-400" /> {years[1]} cumulatief
                    </span>
                    <span className="flex items-center gap-2 text-gray-500">
                      <span className="w-4 h-0.5 border-t-2 border-dashed border-gray-500" /> {years[1]} na vergelijkingspunt
                    </span>
                    <span className="flex items-center gap-2 text-workx-lime">
                      <span className="w-4 h-0.5 bg-workx-lime" /> {years[2]} cumulatief
                    </span>
                  </div>
                  <span className="text-gray-500 text-[11px]">
                    {years[1]} hele jaar: <span className="text-gray-300 tabular-nums">{formatCurrency(sumPrevYear)}</span>
                  </span>
                </div>
              </div>
            )
          })()}

          {/* Area Chart - Omzet vs Kosten */}
          {(() => {
            const chartHeight = 280
            const chartPadding = { top: 20, right: 20, bottom: 40, left: 70 }
            const plotWidth = 100 - chartPadding.left * 100 / 800 - chartPadding.right * 100 / 800
            const svgWidth = 800
            const svgHeight = chartHeight

            // Current year data
            const currentYrData = getDataForYear(years[2])
            const currentOmzet = currentYrData.omzet
            const currentKosten = currentYrData.werkgeverslasten.slice()
            // Kosten incl. overige kosten uit Kosten-pagina (alleen 2026)
            const currentKostenIncl = currentKosten.map((v, i) => v + (monthlyCosts2026[i] || 0))

            // Find last month with actual data for current year (non-zero omzet of kosten of overige kosten)
            let lastDataMonth = -1
            for (let i = 11; i >= 0; i--) {
              if (currentOmzet[i] !== 0 || currentKosten[i] !== 0 || (monthlyCosts2026[i] || 0) !== 0) {
                lastDataMonth = i
                break
              }
            }
            // If no data, show nothing
            const monthsToShow = lastDataMonth + 1

            // Previous years data (full 12 months)
            const prevYear1Data = getDataForYear(years[0])
            const prevYear2Data = getDataForYear(years[1])
            const prev1Omzet = prevYear1Data.omzet
            const prev1Kosten = prevYear1Data.werkgeverslasten.slice()
            const prev2Omzet = prevYear2Data.omzet
            const prev2Kosten = prevYear2Data.werkgeverslasten.slice()

            // Find global min/max for Y scale
            const allVals = [
              ...prev1Omzet, ...prev1Kosten,
              ...prev2Omzet, ...prev2Kosten,
              ...currentOmzet.slice(0, monthsToShow),
              ...currentKosten.slice(0, monthsToShow),
              ...currentKostenIncl.slice(0, monthsToShow)
            ].filter(v => v !== 0)
            const yMin = Math.min(0, ...allVals) * 1.1
            const yMax = Math.max(...allVals) * 1.15

            const plotLeft = 70
            const plotRight = svgWidth - 20
            const plotTop = 20
            const plotBottom = svgHeight - 40
            const plotH = plotBottom - plotTop
            const plotW = plotRight - plotLeft

            const getX = (i: number) => plotLeft + (i / 11) * plotW
            const getY = (v: number) => plotBottom - ((v - yMin) / (yMax - yMin)) * plotH

            // Build smooth path using cubic bezier
            const smoothPath = (points: { x: number; y: number }[]) => {
              if (points.length < 2) return ''
              let d = `M ${points[0].x},${points[0].y}`
              for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1]
                const curr = points[i]
                const cpx = (prev.x + curr.x) / 2
                d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
              }
              return d
            }

            // Build area path (path + close to bottom)
            const areaPath = (points: { x: number; y: number }[]) => {
              if (points.length < 2) return ''
              const line = smoothPath(points)
              const lastPt = points[points.length - 1]
              const firstPt = points[0]
              return `${line} L ${lastPt.x},${plotBottom} L ${firstPt.x},${plotBottom} Z`
            }

            const currentOmzetPts = currentOmzet.slice(0, monthsToShow).map((v, i) => ({ x: getX(i), y: getY(v) }))
            const currentKostenPts = currentKosten.slice(0, monthsToShow).map((v, i) => ({ x: getX(i), y: getY(v) }))
            const currentKostenInclPts = currentKostenIncl.slice(0, monthsToShow).map((v, i) => ({ x: getX(i), y: getY(v) }))
            const hasKostenIncl = monthlyCosts2026.slice(0, monthsToShow).some(v => v !== 0)

            const prev1OmzetPts = prev1Omzet.map((v, i) => ({ x: getX(i), y: getY(v) }))
            const prev1KostenPts = prev1Kosten.map((v, i) => ({ x: getX(i), y: getY(v) }))
            const prev2OmzetPts = prev2Omzet.map((v, i) => ({ x: getX(i), y: getY(v) }))
            const prev2KostenPts = prev2Kosten.map((v, i) => ({ x: getX(i), y: getY(v) }))

            // Y-axis ticks
            const yTicks: number[] = []
            const tickStep = Math.ceil((yMax - yMin) / 5 / 50000) * 50000
            for (let v = Math.ceil(yMin / tickStep) * tickStep; v <= yMax; v += tickStep) {
              yTicks.push(v)
            }

            return (
              <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <h3 className="text-white font-medium mb-4">Omzet vs Kosten per periode</h3>
                <div className="relative" style={{ height: chartHeight }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="omzetGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
                      </linearGradient>
                      <linearGradient id="kostenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>

                    {/* Grid lines and Y labels */}
                    {yTicks.map(v => (
                      <g key={v}>
                        <line x1={plotLeft} y1={getY(v)} x2={plotRight} y2={getY(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={plotLeft - 8} y={getY(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">
                          {v >= 1000 || v <= -1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}
                        </text>
                      </g>
                    ))}

                    {/* Zero line */}
                    {yMin < 0 && (
                      <line x1={plotLeft} y1={getY(0)} x2={plotRight} y2={getY(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />
                    )}

                    {/* Previous year lines (thin, subtle) */}
                    {/* Year 0 - omzet */}
                    <path d={smoothPath(prev1OmzetPts)} fill="none" stroke="#22c55e" strokeWidth="1.2" strokeOpacity="0.25" strokeDasharray="4,3" />
                    {/* Year 0 - kosten */}
                    <path d={smoothPath(prev1KostenPts)} fill="none" stroke="#f97316" strokeWidth="1.2" strokeOpacity="0.25" strokeDasharray="4,3" />
                    {/* Year 1 - omzet */}
                    <path d={smoothPath(prev2OmzetPts)} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="6,3" />
                    {/* Year 1 - kosten */}
                    <path d={smoothPath(prev2KostenPts)} fill="none" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="6,3" />

                    {/* Current year filled areas */}
                    {monthsToShow >= 2 && (
                      <>
                        <path d={areaPath(currentOmzetPts)} fill="url(#omzetGradient)" />
                        <path d={smoothPath(currentOmzetPts)} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={areaPath(currentKostenPts)} fill="url(#kostenGradient)" />
                        <path d={smoothPath(currentKostenPts)} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Kosten incl. overige kosten — alleen lijn, geen area-fill */}
                        {hasKostenIncl && (
                          <>
                            <path d={smoothPath(currentKostenInclPts)} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            {currentKostenInclPts.map((pt, i) => (
                              <g key={`ki-${i}`}>
                                <circle cx={pt.x} cy={pt.y} r="5" fill="#ef4444" opacity="0.2" />
                                <circle cx={pt.x} cy={pt.y} r="3" fill="#ef4444" />
                              </g>
                            ))}
                          </>
                        )}

                        {/* Data points for current year */}
                        {currentOmzetPts.map((pt, i) => (
                          <g key={`o-${i}`}>
                            <circle cx={pt.x} cy={pt.y} r="5" fill="#22c55e" opacity="0.2" />
                            <circle cx={pt.x} cy={pt.y} r="3" fill="#22c55e" />
                          </g>
                        ))}
                        {currentKostenPts.map((pt, i) => (
                          <g key={`k-${i}`}>
                            <circle cx={pt.x} cy={pt.y} r="5" fill="#f97316" opacity="0.2" />
                            <circle cx={pt.x} cy={pt.y} r="3" fill="#f97316" />
                          </g>
                        ))}
                      </>
                    )}

                    {/* X-axis labels */}
                    {periods.map((p, i) => (
                      <text key={p} x={getX(i)} y={plotBottom + 20} textAnchor="middle" fill={i < monthsToShow ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} fontSize="12" fontFamily="system-ui">
                        {p}
                      </text>
                    ))}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm bg-green-500/60" />
                    <span className="text-xs text-white/70">Omzet {years[2]}</span>
                  </div>
                  <div className="flex items-center gap-2" title="Alleen werkgeverslasten + kosten extern, zónder dagelijkse kosten uit Kosten-pagina">
                    <div className="w-4 h-3 rounded-sm bg-orange-500/60" />
                    <span className="text-xs text-white/70">Werkgeverslasten {years[2]}</span>
                  </div>
                  {hasKostenIncl && (
                    <div className="flex items-center gap-2" title="Werkgeverslasten + Kosten Extern + dagelijkse kosten uit Kosten-pagina">
                      <div className="w-4 h-0.5 bg-red-500" />
                      <span className="text-xs text-red-300/80">Kosten {years[2]} (totaal)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500/40" style={{ borderTop: '2px dashed rgba(34,197,94,0.4)' }} />
                    <span className="text-xs text-white/40">Omzet {years[1]}</span>
                  </div>
                  <div className="flex items-center gap-2" title="Alleen werkgeverslasten + kosten extern">
                    <div className="w-4 h-0.5 bg-orange-500/40" style={{ borderTop: '2px dashed rgba(249,115,22,0.4)' }} />
                    <span className="text-xs text-white/40">Werkgeverslasten {years[1]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500/25" style={{ borderTop: '2px dashed rgba(34,197,94,0.25)' }} />
                    <span className="text-xs text-white/30">Omzet {years[0]}</span>
                  </div>
                  <div className="flex items-center gap-2" title="Alleen werkgeverslasten + kosten extern">
                    <div className="w-4 h-0.5 bg-orange-500/25" style={{ borderTop: '2px dashed rgba(249,115,22,0.25)' }} />
                    <span className="text-xs text-white/30">Werkgeverslasten {years[0]}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Cumulative Saldo Chart */}
          {(() => {
            const svgW = 800, svgH = 260
            const pL = 70, pR = svgW - 20, pT = 20, pB = svgH - 40
            const pH = pB - pT, pW = pR - pL

            const currentData = getDataForYear(years[2])
            let lastMonth = 0
            for (let i = 11; i >= 0; i--) {
              if (currentData.omzet[i] !== 0 || currentData.werkgeverslasten[i] !== 0) { lastMonth = i + 1; break }
            }
            if (lastMonth === 0) return null

            // Cumulatief saldo per jaar
            const cumSaldo = (year: number, months: number) => {
              const d = getDataForYear(year)
              const result: number[] = []
              let sum = 0
              for (let m = 0; m < months; m++) {
                sum += d.omzet[m] - d.werkgeverslasten[m]
                result.push(sum)
              }
              return result
            }

            const cum0 = cumSaldo(years[0], 12)
            const cum1 = cumSaldo(years[1], 12)
            const cum2 = cumSaldo(years[2], lastMonth)

            const allVals = [...cum0, ...cum1, ...cum2]
            const yMin = Math.min(0, ...allVals) * 1.1
            const yMax = Math.max(...allVals) * 1.15
            const range = yMax - yMin || 1

            const getX = (i: number) => pL + (i / 11) * pW
            const getY = (v: number) => pB - ((v - yMin) / range) * pH

            const smoothPath = (points: { x: number; y: number }[]) => {
              if (points.length < 2) return ''
              let d = `M ${points[0].x},${points[0].y}`
              for (let i = 1; i < points.length; i++) {
                const prev = points[i - 1], curr = points[i]
                const cpx = (prev.x + curr.x) / 2
                d += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`
              }
              return d
            }

            const areaPath = (points: { x: number; y: number }[]) => {
              if (points.length < 2) return ''
              const line = smoothPath(points)
              return `${line} L ${points[points.length - 1].x},${pB} L ${points[0].x},${pB} Z`
            }

            const pts0 = cum0.map((v, i) => ({ x: getX(i), y: getY(v) }))
            const pts1 = cum1.map((v, i) => ({ x: getX(i), y: getY(v) }))
            const pts2 = cum2.map((v, i) => ({ x: getX(i), y: getY(v) }))

            // Y-as ticks
            const yTicks: number[] = []
            const step = Math.ceil((yMax - yMin) / 5 / 100000) * 100000
            for (let v = Math.floor(yMin / step) * step; v <= yMax; v += step) yTicks.push(v)

            return (
              <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <h3 className="text-white font-medium mb-4">Cumulatief saldo</h3>
                <div className="relative" style={{ height: svgH }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
                    <defs>
                      <linearGradient id="cumGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f9ff85" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#f9ff85" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Grid + Y labels */}
                    {yTicks.map(v => (
                      <g key={v}>
                        <line x1={pL} y1={getY(v)} x2={pR} y2={getY(v)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
                        <text x={pL - 8} y={getY(v) + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="system-ui">
                          {v >= 1000000 || v <= -1000000 ? `€${(v / 1000000).toFixed(1)}M` : v >= 1000 || v <= -1000 ? `€${(v / 1000).toFixed(0)}k` : `€${v}`}
                        </text>
                      </g>
                    ))}

                    {/* Zero line */}
                    {yMin < 0 && <line x1={pL} y1={getY(0)} x2={pR} y2={getY(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />}

                    {/* Previous years (thin dashed) */}
                    <path d={smoothPath(pts0)} fill="none" stroke="rgba(249,115,22,0.35)" strokeWidth="1.5" strokeDasharray="4,3" />
                    <path d={smoothPath(pts1)} fill="none" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" strokeDasharray="6,3" />

                    {/* Current year (filled) */}
                    <path d={areaPath(pts2)} fill="url(#cumGradient)" />
                    <path d={smoothPath(pts2)} fill="none" stroke="#f9ff85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {pts2.map((pt, i) => (
                      <g key={i}>
                        <circle cx={pt.x} cy={pt.y} r="5" fill="#f9ff85" opacity="0.2" />
                        <circle cx={pt.x} cy={pt.y} r="3" fill="#f9ff85" />
                      </g>
                    ))}

                    {/* End labels */}
                    {pts2.length > 0 && (
                      <text x={pts2[pts2.length - 1].x + 8} y={pts2[pts2.length - 1].y + 4} fill="#f9ff85" fontSize="11" fontWeight="600" fontFamily="system-ui">
                        {cum2[cum2.length - 1] >= 1000000 ? `€${(cum2[cum2.length - 1] / 1000000).toFixed(1)}M` : `€${(cum2[cum2.length - 1] / 1000).toFixed(0)}k`}
                      </text>
                    )}

                    {/* X-axis labels */}
                    {periods.map((p, i) => (
                      <text key={p} x={getX(i)} y={pB + 20} textAnchor="middle" fill={i < lastMonth ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'} fontSize="12" fontFamily="system-ui">
                        {p}
                      </text>
                    ))}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm bg-workx-lime/40" />
                    <span className="text-xs text-white/70">{years[2]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ borderTop: '2px dashed rgba(6,182,212,0.5)' }} />
                    <span className="text-xs text-white/40">{years[1]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5" style={{ borderTop: '2px dashed rgba(249,115,22,0.35)' }} />
                    <span className="text-xs text-white/30">{years[0]}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Data Table */}
          <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-white font-medium">Gedetailleerd overzicht per periode</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Categorie</th>
                    <th className="text-left py-3 px-4 text-gray-400 text-sm font-medium">Jaar</th>
                    {periods.map(p => (
                      <th key={p} className="text-right py-3 px-4 text-gray-400 text-sm font-medium">{p}</th>
                    ))}
                    <th className="text-right py-3 px-4 text-workx-lime text-sm font-medium">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Werkgeverslasten — alleen bruto loon eigen mensen (externen zitten in Kosten) */}
                  {years.map((year, yearIdx) => {
                    const yearData = getDataForYear(year)
                    return (
                      <tr key={`wl-${year}`} className={`border-b border-white/5 hover:bg-white/5 ${yearIdx === 2 ? 'bg-workx-lime/5' : ''}`}>
                        {yearIdx === 0 && (
                          <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top" title="Bruto loonkosten van eigen medewerkers. Externe advocaten (Lodewijk) en overige kosten zie je onderaan in de detail-sectie.">
                            Werkgeverslasten
                          </td>
                        )}
                        <td className={`py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime' : 'text-white/60'}`}>{year}</td>
                        {yearData.werkgeverslasten.map((v, i) => (
                          <td key={i} className={`text-right py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime/80' : 'text-gray-200'}`}>
                            {formatCurrency(v)}
                          </td>
                        ))}
                        <td className={`text-right py-3 px-4 font-medium ${yearIdx === 2 ? 'text-workx-lime' : 'text-white'}`}>
                          {formatCurrency(calculations.totals.werkgeverslasten[year])}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Omzet - all 3 years */}
                  {years.map((year, yearIdx) => (
                    <tr key={`omzet-${year}`} className={`border-b border-white/5 hover:bg-white/5 ${yearIdx === 2 ? 'bg-workx-lime/5' : ''}`}>
                      {yearIdx === 0 && <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top">Omzet</td>}
                      <td className={`py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime' : 'text-white/60'}`}>{year}</td>
                      {getDataForYear(year).omzet.map((v, i) => (
                        <td key={i} className={`text-right py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime/80' : 'text-gray-200'}`}>
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`text-right py-3 px-4 font-medium ${yearIdx === 2 ? 'text-workx-lime' : 'text-white'}`}>
                        {formatCurrency(calculations.totals.omzet[year])}
                      </td>
                    </tr>
                  ))}

                  {/* Uren - all 3 years */}
                  {years.map((year, yearIdx) => (
                    <tr key={`uren-${year}`} className={`border-b border-white/5 hover:bg-white/5 ${yearIdx === 2 ? 'bg-workx-lime/5' : ''}`}>
                      {yearIdx === 0 && <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top">Uren</td>}
                      <td className={`py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime' : 'text-white/60'}`}>{year}</td>
                      {getDataForYear(year).uren.map((v, i) => (
                        <td key={i} className={`text-right py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime/80' : 'text-gray-200'}`}>
                          {formatNumber(v)}
                        </td>
                      ))}
                      <td className={`text-right py-3 px-4 font-medium ${yearIdx === 2 ? 'text-workx-lime' : 'text-white'}`}>
                        {formatNumber(calculations.totals.uren[year])}
                      </td>
                    </tr>
                  ))}

                  {/* Saldo - all 3 years */}
                  {years.map((year, yearIdx) => (
                    <tr key={`saldo-${year}`} className={`${yearIdx === 0 ? 'bg-orange-500/10' : yearIdx === 1 ? 'bg-cyan-500/10' : 'bg-workx-lime/20'}`}>
                      <td className={`py-3 px-4 font-medium ${yearIdx === 0 ? 'text-orange-400' : yearIdx === 1 ? 'text-cyan-400' : 'text-workx-lime'}`}>
                        Saldo {year}
                      </td>
                      <td></td>
                      {calculations.saldo[year].map((v, i) => (
                        <td key={i} className={`text-right py-3 px-4 font-medium ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`text-right py-3 px-4 font-bold ${calculations.saldoTotals[year] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(calculations.saldoTotals[year])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Year Comparison - on same month basis */}
          {(() => {
            // Bepaal laatste maand met data in huidig jaar
            const currentData = getDataForYear(years[2])
            let lastMonth = 0
            for (let m = 0; m < 12; m++) {
              if (currentData.omzet[m] !== 0 || currentData.werkgeverslasten[m] !== 0) lastMonth = m + 1
            }
            if (lastMonth === 0) lastMonth = 12
            const periodLabel = lastMonth === 12 ? 'Heel jaar' : `P1–P${lastMonth}`

            // Bereken totalen tot en met lastMonth voor elk jaar
            const sumTo = (arr: number[], months: number) => arr.slice(0, months).reduce((s, v) => s + v, 0)
            const metrics = [
              { label: 'Omzet', values: years.map(y => sumTo(getDataForYear(y).omzet, lastMonth)), isCurrency: true, positiveIsGood: true },
              { label: 'Totale Kosten', values: years.map(y => {
                const d = getDataForYear(y)
                return sumTo(d.werkgeverslasten, lastMonth) + sumTo(d.kostenExtern, lastMonth)
              }), isCurrency: true, positiveIsGood: false },
              { label: 'Saldo', values: years.map(y => {
                const d = getDataForYear(y)
                return sumTo(d.omzet, lastMonth) - sumTo(d.werkgeverslasten, lastMonth) - sumTo(d.kostenExtern, lastMonth)
              }), isCurrency: true, positiveIsGood: true },
              { label: 'Uren', values: years.map(y => sumTo(getDataForYear(y).uren, lastMonth)), isCurrency: false, positiveIsGood: true },
            ]

            return (
            <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-medium">Vergelijking op dezelfde periode</h3>
                <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">{periodLabel} van elk jaar</span>
              </div>
              <div className="space-y-8">
                {metrics.map((metric) => {
                  const maxVal = Math.max(...metric.values.map(Math.abs)) || 1
                  const barColors = ['rgba(249,115,22,0.3)', 'rgba(6,182,212,0.4)', 'rgba(249,255,133,0.5)']
                  const borderColors = ['rgba(249,115,22,0.5)', 'rgba(6,182,212,0.6)', 'rgba(249,255,133,0.8)']
                  const textColors = ['text-orange-400/60', 'text-cyan-400/80', 'text-workx-lime']

                  return (
                    <div key={metric.label}>
                      <p className="text-white/80 text-sm font-medium mb-3">{metric.label}</p>
                      <div className="space-y-2">
                        {years.map((year, i) => {
                          const pctChange = i > 0 && metric.values[i - 1] !== 0
                            ? ((metric.values[i] - metric.values[i - 1]) / Math.abs(metric.values[i - 1])) * 100
                            : null
                          const barPct = Math.max((Math.abs(metric.values[i]) / maxVal) * 100, 2)
                          const isGoodChange = pctChange !== null
                            ? (metric.positiveIsGood ? pctChange > 0 : pctChange < 0)
                            : null

                          return (
                            <div key={year} className="flex items-center gap-3">
                              <span className={`w-10 text-xs font-medium ${textColors[i]}`}>{year}</span>
                              <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                                <div
                                  className="h-full rounded-lg transition-all duration-500"
                                  style={{
                                    width: `${barPct}%`,
                                    background: barColors[i],
                                    borderRight: `2px solid ${borderColors[i]}`,
                                    boxShadow: i === 2 ? `0 0 12px ${borderColors[i]}` : 'none'
                                  }}
                                />
                                <span className={`absolute inset-y-0 left-3 flex items-center text-xs font-medium ${textColors[i]}`}>
                                  {metric.isCurrency ? formatCurrency(metric.values[i]) : formatNumber(metric.values[i])}
                                </span>
                              </div>
                              <div className="w-16 text-right">
                                {pctChange !== null ? (
                                  <span className={`text-xs font-medium ${isGoodChange ? 'text-green-400' : 'text-red-400'}`}>
                                    {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-xs text-white/20">-</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })()}

          {/* Saldo incl. overige kosten + UWV/ASR (alleen 2026) */}
          {(() => {
            const cur = getDataForYear(currentYear)
            const totalCosts2026 = monthlyCosts2026.reduce((s, v) => s + v, 0)
            const uwv = uwvPerMonth[currentYear] || Array(12).fill(0)
            const asr = asrPerMonth[currentYear] || Array(12).fill(0)
            const totalUwv = uwv.reduce((s, v) => s + v, 0)
            const totalAsr = asr.reduce((s, v) => s + v, 0)
            const wglYear = wglPerMonth[currentYear] || Array(12).fill(0)
            const totalWgl = wglYear.reduce((s, v) => s + v, 0)
            const baseCosts = cur.werkgeverslasten.reduce((s, v) => s + v, 0) + totalWgl
            const omzetTotal = cur.omzet.reduce((s, v) => s + v, 0)
            const totalNetKosten = baseCosts + totalCosts2026 - totalUwv - totalAsr
            // ZZP voor info-rij "Totaal advocatenkosten (loon + ZZP)"
            const zzpYear = zzpPerMonth[currentYear] || Array(12).fill(0)
            const totalZzp = zzpYear.reduce((s, v) => s + v, 0)
            const totalAdvocaten = (baseCosts - totalUwv - totalAsr) + totalZzp
            return (
              <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
                  <div>
                    <h3 className="text-white font-medium">Saldo incl. overige kosten en UWV/ASR (alleen {currentYear})</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Werkgeverslasten + Kosten Extern + overige kosten uit <a href="/dashboard/kosten" className="text-workx-lime hover:underline">Kosten-pagina</a>, minus UWV (zwangerschapsverlof) en ASR (verzuim) terugbetalingen. Vorige jaren ontbreekt de overige-kosten-data, dus de jaarvergelijking hierboven blijft zonder die post.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Netto effect</p>
                    <p className={`text-lg font-bold tabular-nums ${(totalCosts2026 - totalUwv - totalAsr) >= 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {(totalCosts2026 - totalUwv - totalAsr) >= 0 ? '+' : ''}{formatCurrency(totalCosts2026 - totalUwv - totalAsr)}
                    </p>
                  </div>
                </div>
                {totalCosts2026 === 0 && totalUwv === 0 && totalAsr === 0 && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-gray-400">
                    Nog geen overige kosten of UWV/ASR ingeladen voor {currentYear}. Voeg ze toe via <a href="/dashboard/kosten" className="text-workx-lime hover:underline">/dashboard/kosten</a>.
                  </div>
                )}

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                        <th className="py-2 px-3 font-medium">Maand</th>
                        <th className="py-2 px-3 font-medium text-right" title="Bruto loonkosten van eigen medewerkers">Bruto loon</th>
                        <th className="py-2 px-3 font-medium text-right" title="UWV (zwangerschapsverlof) + ASR (verzuim) terugbetalingen">UWV/ASR retour</th>
                        <th className="py-2 px-3 font-medium text-right" title="Werkgeverslasten = bruto loon − UWV − ASR">Werkgeverslasten</th>
                        <th className="py-2 px-3 font-medium text-right" title="Kostenposten uit de Kosten-pagina (incl. externe advocaten ZZP)">Overige Kosten</th>
                        <th className="py-2 px-3 font-medium text-right" title="Werkgeverslasten + Overige Kosten">Totale Kosten</th>
                        <th className="py-2 px-3 font-medium text-right">Omzet</th>
                        <th className="py-2 px-3 font-medium text-right">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p, i) => {
                        const bruto = (cur.werkgeverslasten[i] || 0) + (wglYear[i] || 0)
                        const dag = monthlyCosts2026[i] || 0
                        const retour = (uwv[i] || 0) + (asr[i] || 0)
                        const wkzNet = bruto - retour
                        const totaal = wkzNet + dag
                        const om = cur.omzet[i] || 0
                        const sld = om - totaal
                        if (bruto === 0 && dag === 0 && retour === 0 && om === 0) return null
                        return (
                          <tr key={p} className="border-b border-white/5 hover:bg-white/[0.02]">
                            <td className="py-2 px-3 text-white">{p}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-400">{formatCurrency(bruto)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-green-400">{retour > 0 ? `−${formatCurrency(retour)}` : '—'}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-200 font-medium">{formatCurrency(wkzNet)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-orange-300">{formatCurrency(dag)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-white font-medium">{formatCurrency(totaal)}</td>
                            <td className="py-2 px-3 text-right tabular-nums text-gray-300">{formatCurrency(om)}</td>
                            <td className={`py-2 px-3 text-right tabular-nums font-medium ${sld >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>{formatCurrency(sld)}</td>
                          </tr>
                        )
                      })}
                      <tr className="border-t-2 border-white/10 bg-white/[0.02]">
                        <td className="py-2 px-3 text-white font-bold">Totaal</td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-400 font-bold">{formatCurrency(baseCosts)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-green-400 font-bold">{(totalUwv + totalAsr) > 0 ? `−${formatCurrency(totalUwv + totalAsr)}` : '—'}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-200 font-bold">{formatCurrency(baseCosts - totalUwv - totalAsr)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-orange-300 font-bold">
                          {formatCurrency(totalCosts2026)}
                          {totalZzp > 0 && (
                            <span className="block text-[10px] font-normal text-cyan-400/70 mt-0.5">waarvan ZZP {formatCurrency(totalZzp)}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-white font-bold">
                          {formatCurrency(totalNetKosten)}
                          {totalZzp > 0 && (
                            <span className="block text-[10px] font-normal text-cyan-400/70 mt-0.5" title="Werkgeverslasten + ZZP — totale advocatenkosten">
                              advocaten: {formatCurrency(totalAdvocaten)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-gray-300 font-bold">{formatCurrency(omzetTotal)}</td>
                        <td className={`py-2 px-3 text-right tabular-nums font-bold ${(omzetTotal - totalNetKosten) >= 0 ? 'text-workx-lime' : 'text-red-400'}`}>
                          {formatCurrency(omzetTotal - totalNetKosten)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2025 vs 2026 vergelijking — appels/appels voor UWV/ASR (beide jaren data) */}
                {(() => {
                  const prev = getDataForYear(years[1])
                  const uwvPrev = uwvPerMonth[years[1]] || Array(12).fill(0)
                  const asrPrev = asrPerMonth[years[1]] || Array(12).fill(0)
                  // Bepaal lastMonth in 2026 voor periodieke vergelijking
                  let lastMonth = 0
                  for (let m = 0; m < 12; m++) {
                    if (cur.omzet[m] !== 0 || cur.werkgeverslasten[m] !== 0) lastMonth = m + 1
                  }
                  if (lastMonth === 0) lastMonth = 12
                  const sumTo = (arr: number[], n: number) => arr.slice(0, n).reduce((s, v) => s + (v || 0), 0)
                  const periodLabel = lastMonth === 12 ? 'heel jaar' : `P1–P${lastMonth}`

                  const wkzCur = sumTo(cur.werkgeverslasten, lastMonth) + sumTo(cur.kostenExtern, lastMonth)
                  const wkzPrev = sumTo(prev.werkgeverslasten, lastMonth) + sumTo(prev.kostenExtern, lastMonth)
                  const uwvCurSum = sumTo(uwv, lastMonth)
                  const uwvPrevSum = sumTo(uwvPrev, lastMonth)
                  const asrCurSum = sumTo(asr, lastMonth)
                  const asrPrevSum = sumTo(asrPrev, lastMonth)
                  const netCur = wkzCur - uwvCurSum - asrCurSum
                  const netPrev = wkzPrev - uwvPrevSum - asrPrevSum
                  const dagCurSum = sumTo(monthlyCosts2026, lastMonth)

                  if (uwvCurSum === 0 && asrCurSum === 0 && uwvPrevSum === 0 && asrPrevSum === 0) return null

                  return (
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <h4 className="text-sm font-medium text-white mb-1">Vergelijking met {years[1]} — UWV/ASR appels-appels</h4>
                      <p className="text-[11px] text-gray-500 mb-3">
                        Voor UWV en ASR hebben we beide jaren data, dus over {periodLabel} kunnen we netjes vergelijken.
                        Overige kosten staat los want die hebben we alleen voor {currentYear}.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Bruto loon + Extern {periodLabel}</p>
                          <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(wkzCur)}</p>
                          <p className={`text-[11px] tabular-nums ${(wkzCur - wkzPrev) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {wkzCur - wkzPrev > 0 ? '+' : ''}{formatCurrency(wkzCur - wkzPrev)} vs {years[1]}
                          </p>
                        </div>
                        <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/20">
                          <p className="text-[10px] text-green-300/70 uppercase tracking-wider">UWV {periodLabel}</p>
                          <p className="text-lg font-bold text-green-400 tabular-nums">{formatCurrency(uwvCurSum)}</p>
                          <p className={`text-[11px] tabular-nums ${(uwvCurSum - uwvPrevSum) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {uwvCurSum - uwvPrevSum > 0 ? '+' : ''}{formatCurrency(uwvCurSum - uwvPrevSum)} vs {years[1]}
                          </p>
                        </div>
                        <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/20">
                          <p className="text-[10px] text-green-300/70 uppercase tracking-wider">ASR {periodLabel}</p>
                          <p className="text-lg font-bold text-green-400 tabular-nums">{formatCurrency(asrCurSum)}</p>
                          <p className={`text-[11px] tabular-nums ${(asrCurSum - asrPrevSum) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {asrCurSum - asrPrevSum > 0 ? '+' : ''}{formatCurrency(asrCurSum - asrPrevSum)} vs {years[1]}
                          </p>
                        </div>
                        <div className="bg-workx-lime/10 rounded-xl p-3 border border-workx-lime/30">
                          <p className="text-[10px] text-workx-lime/70 uppercase tracking-wider">Werkgeverslasten {periodLabel}</p>
                          <p className="text-lg font-bold text-workx-lime tabular-nums">{formatCurrency(netCur)}</p>
                          <p className={`text-[11px] tabular-nums ${(netCur - netPrev) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {netCur - netPrev > 0 ? '+' : ''}{formatCurrency(netCur - netPrev)} vs {years[1]}
                          </p>
                          {dagCurSum > 0 && (
                            <p className="text-[10px] text-gray-500 mt-1">excl. {formatCurrency(dagCurSum)} overige kosten {currentYear}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-6 space-y-2">
                  <p className="text-xs font-medium text-white/70 mb-2">Per maand: Omzet vs. Totale Kosten</p>
                  {(() => {
                    const monthMaxes = periods.map((_, i) => {
                      const wkzNetVal = (cur.werkgeverslasten[i] || 0) + (wglYear[i] || 0) - (uwv[i] || 0) - (asr[i] || 0)
                      return Math.max(cur.omzet[i] || 0, wkzNetVal + (monthlyCosts2026[i] || 0))
                    })
                    const overallMax = Math.max(...monthMaxes, 1)
                    return periods.map((p, i) => {
                      const om = cur.omzet[i] || 0
                      const wkzNet = (cur.werkgeverslasten[i] || 0) + (wglYear[i] || 0) - (uwv[i] || 0) - (asr[i] || 0)
                      const dag = monthlyCosts2026[i] || 0
                      const tot = wkzNet + dag
                      const omPct = (Math.max(om, 0) / overallMax) * 100
                      const wkzPct = (Math.max(wkzNet, 0) / overallMax) * 100
                      const dagPct = (dag / overallMax) * 100
                      if (om === 0 && tot === 0) return null
                      return (
                        <div key={p} className="text-xs">
                          <div className="flex items-baseline justify-between mb-0.5">
                            <span className="text-white/60 w-10 shrink-0">{p}</span>
                            <span className="text-[10px] text-gray-500 tabular-nums">
                              omzet {formatCurrency(om)} · totale kosten {formatCurrency(tot)}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="h-2.5 bg-white/5 rounded overflow-hidden">
                              <div className="h-full bg-workx-lime/70 rounded" style={{ width: `${omPct}%` }} />
                            </div>
                            <div className="h-2.5 bg-white/5 rounded overflow-hidden flex">
                              <div className="h-full bg-gray-400/60" style={{ width: `${wkzPct}%` }} title="Werkgeverslasten (na UWV/ASR)" />
                              <div className="h-full bg-orange-500/70" style={{ width: `${dagPct}%` }} title="Overige kosten" />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                  <div className="flex items-center gap-4 text-[10px] text-gray-500 mt-3 pt-3 border-t border-white/5">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-workx-lime/70" /> Omzet</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-gray-400/60" /> Werkgeverslasten</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded bg-orange-500/70" /> Overige kosten</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Current Year Input Section */}
          <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-medium">{currentYear} Invoer</h3>
              <div className="flex items-center gap-3">
                {saveSuccess && (
                  <span className="text-green-400 text-sm flex items-center gap-1">
                    <Icons.check size={14} />
                    Opgeslagen!
                  </span>
                )}
                <button
                  onClick={saveCurrentYearData}
                  disabled={saving}
                  className="flex items-center gap-2 px-3 py-1.5 bg-workx-lime/20 text-workx-lime rounded-lg text-sm hover:bg-workx-lime/30 transition-colors disabled:opacity-50"
                >
                  <Icons.save size={14} />
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {(['werkgeverslasten', 'kostenExtern', 'omzet'] as const).map((category) => (
                <div key={category}>
                  <p className="text-sm mb-3 font-medium text-white/60">{
                    category === 'kostenExtern' ? 'Kosten Extern (bv. Lodewijk)' :
                    category === 'werkgeverslasten' ? 'Werkgeverslasten' : 'Omzet'
                  }</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                    {periods.map((p, i) => (
                      <div key={p} className="space-y-1">
                        <label className="text-xs text-gray-400 block">{p}</label>
                        <input
                          type="number"
                          value={currentYearData[category][i] || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            setCurrentYearData(prev => ({
                              ...prev,
                              [category]: prev[category].map((v, idx) => idx === i ? value : v),
                            }))
                          }}
                          className="w-full px-2 sm:px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-workx-lime/50"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Uren - readonly, automatisch berekend */}
              <div>
                <p className="text-white/60 text-sm mb-3 font-medium flex items-center gap-2">
                  Uren
                  <span className="text-xs text-workx-lime/60 bg-workx-lime/10 px-2 py-0.5 rounded-full">automatisch uit Werkdruk</span>
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                  {periods.map((p, i) => (
                    <div key={p} className="space-y-1">
                      <label className="text-xs text-gray-400 block">{p}</label>
                      <div className="w-full px-2 sm:px-3 py-2 bg-white/5 border border-white/5 rounded-lg text-white/50 text-sm">
                        {currentYearData.uren[i] ? formatNumber(currentYearData.uren[i]) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Budgetten Tab */}
      {activeTab === 'budgetten' && (
        <div className="space-y-6">
          {/* Budget Summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
              <p className="text-gray-400 text-xs sm:text-sm">Totaal Budget</p>
              <p className="text-base sm:text-2xl font-semibold text-white mt-1 truncate">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
              <p className="text-gray-400 text-xs sm:text-sm">Besteed</p>
              <p className="text-base sm:text-2xl font-semibold text-white mt-1 truncate">{formatCurrency(totalSpent)}</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 hidden sm:block">{totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0'}% van budget</p>
            </div>
            <div className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
              <p className="text-gray-400 text-xs sm:text-sm">Beschikbaar</p>
              <p className={`text-base sm:text-2xl font-semibold mt-1 truncate ${totalBudget - totalSpent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalBudget - totalSpent)}
              </p>
            </div>
          </div>

          {/* Add Budget Form */}
          <div className="bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
            <h3 className="text-white font-medium mb-4 text-sm sm:text-base">Nieuw Budget Toevoegen</h3>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <input
                type="text"
                value={newBudgetName}
                onChange={(e) => setNewBudgetName(e.target.value)}
                placeholder="Budget naam (bijv. Marketing)"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/50 text-sm sm:text-base"
              />
              <div className="flex gap-3 sm:gap-4">
                <input
                  type="number"
                  value={newBudgetAmount}
                  onChange={(e) => setNewBudgetAmount(e.target.value)}
                  placeholder="Bedrag"
                  className="flex-1 sm:w-40 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/50 text-sm sm:text-base"
                />
                <button
                  onClick={addBudget}
                  disabled={!newBudgetName || !newBudgetAmount}
                  className="flex items-center gap-2 px-4 py-2 bg-workx-lime text-workx-dark rounded-xl font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base whitespace-nowrap"
                >
                  <Icons.plus size={18} />
                  <span className="hidden sm:inline">Toevoegen</span>
                  <span className="sm:hidden">+</span>
                </button>
              </div>
            </div>
          </div>

          {/* Budget Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {budgets.map(budget => {
              const remaining = budget.budget - budget.spent
              const percentage = budget.budget > 0 ? (budget.spent / budget.budget) * 100 : 0

              return (
                <div key={budget.id} className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-white font-medium text-lg">{budget.name}</h3>
                      {editingBudget === budget.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="number"
                            defaultValue={budget.budget}
                            onBlur={(e) => {
                              updateBudgetAmount(budget.id, parseFloat(e.target.value) || budget.budget)
                              setEditingBudget(null)
                            }}
                            className="w-32 px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm focus:outline-none focus:border-workx-lime/50"
                            autoFocus
                          />
                          <span className="text-gray-400 text-sm">budget</span>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm mt-1">
                          Budget: {formatCurrency(budget.budget)}
                          <button
                            onClick={() => setEditingBudget(budget.id)}
                            className="ml-2 text-workx-lime/60 hover:text-workx-lime"
                          >
                            <Icons.edit size={12} />
                          </button>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <BudgetDonut spent={budget.spent} budget={budget.budget} size={80} />
                      <button
                        onClick={() => deleteBudget(budget.id)}
                        className="p-2 text-white/30 hover:text-red-400 transition-colors"
                      >
                        <Icons.trash size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all ${percentage > 100 ? 'bg-red-500' : 'bg-workx-lime'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-gray-400 text-xs">Besteed</p>
                      <p className="text-white font-medium">{formatCurrency(budget.spent)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Resterend</p>
                      <p className={`font-medium ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Percentage</p>
                      <p className={`font-medium ${percentage > 100 ? 'text-red-400' : 'text-workx-lime'}`}>
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Update spent input */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <label className="text-gray-400 text-xs block mb-2">Kosten bijwerken</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        defaultValue={budget.spent}
                        onBlur={(e) => updateBudgetSpent(budget.id, parseFloat(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-workx-lime/50"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Total Budget Visual */}
          {budgets.length > 0 && (
            <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
              <h3 className="text-white font-medium mb-6">Budget Overzicht</h3>
              <div className="space-y-4">
                {budgets.map(budget => {
                  const percentage = totalBudget > 0 ? (budget.spent / totalBudget) * 100 : 0
                  const budgetPercentage = totalBudget > 0 ? (budget.budget / totalBudget) * 100 : 0

                  return (
                    <div key={budget.id} className="flex items-center gap-4">
                      <div className="w-32 text-white text-sm">{budget.name}</div>
                      <div className="flex-1 h-6 bg-white/10 rounded-full overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-white/20 rounded-full"
                          style={{ width: `${budgetPercentage}%` }}
                        />
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${budget.spent > budget.budget ? 'bg-red-500' : 'bg-workx-lime'}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-white/60 text-sm">
                        {formatCurrency(budget.spent)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Salarishuis Tab - Visible to everyone */}
      {activeTab === 'salarishuis' && (
        <div className="space-y-6">
          {/* Header with buttons for managers */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-white/60 text-sm">
                <span className="hidden sm:inline">Het salarishuis van Workx Advocaten - Tarieven per ervaringsjaar</span>
                <span className="sm:hidden">Salarishuis - Tarieven per jaar</span>
              </p>
              <p className="text-gray-400 text-xs mt-1">
                <span className="hidden sm:inline">Alle medewerkers gaan per 1 maart elk jaar automatisch een stap omhoog</span>
                <span className="sm:hidden">Per 1 maart automatisch een stap omhoog</span>
              </p>
            </div>
            {isManager && (
              <div className="flex gap-2">
                {salaryScales.length === 0 ? (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/financien/salary-scales/seed', { method: 'POST' })
                        if (res.ok) {
                          const scaleRes = await fetch('/api/financien/salary-scales')
                          if (scaleRes.ok) {
                            setSalaryScales(await scaleRes.json())
                          }
                        }
                      } catch (error) {
                        console.error('Error seeding salary scales:', error)
                      }
                    }}
                    className="px-4 py-2 bg-workx-lime text-workx-dark rounded-xl font-medium hover:bg-workx-lime/90 transition-colors text-sm"
                  >
                    Salarisschaal Laden
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (isEditingSalarishuis) {
                        // Als we klaar klikken, sluit ook alle open edit velden
                        setEditingSalaryScale(null)
                      }
                      setIsEditingSalarishuis(!isEditingSalarishuis)
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors text-sm ${
                      isEditingSalarishuis
                        ? 'bg-workx-lime text-workx-dark'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Icons.edit size={16} />
                    {isEditingSalarishuis ? 'Klaar' : 'Bewerken'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Salary Scale Table */}
          {salaryScales.length > 0 ? (
            <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 bg-workx-dark/60">
                      <th className="text-left py-4 px-6 text-workx-lime font-medium">Ervaringsjaar</th>
                      <th className="text-right py-4 px-6 text-workx-lime font-medium">Bruto Salaris</th>
                      <th className="text-right py-4 px-6 text-workx-lime font-medium">Uurtarief</th>
                      <th className="text-right py-4 px-6 text-workx-lime font-medium">Range</th>
                      {isEditingSalarishuis && <th className="w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {salaryScales.map((scale, idx) => {
                      const isEditing = editingSalaryScale === scale.id

                      return (
                        <tr
                          key={scale.id}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''} ${isEditing ? 'bg-workx-lime/5' : ''}`}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center">
                                <span className="text-workx-lime font-bold text-sm">{scale.experienceYear}</span>
                              </div>
                              <span className="text-white font-medium">{scale.label}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                id={`salary-${scale.id}`}
                                defaultValue={scale.salary}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm w-24 text-right focus:border-workx-lime/50 focus:outline-none"
                              />
                            ) : (
                              <>
                                <span className="text-white font-semibold text-lg">{formatCurrency(scale.salary)}</span>
                                <span className="text-gray-400 text-sm ml-1">/maand</span>
                              </>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                id={`hourlyRate-${scale.id}`}
                                defaultValue={scale.hourlyRateBase}
                                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm w-20 text-right focus:border-workx-lime/50 focus:outline-none"
                              />
                            ) : (
                              <span className="text-workx-lime font-semibold text-lg">€{scale.hourlyRateBase}</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  id={`rateMin-${scale.id}`}
                                  defaultValue={scale.hourlyRateMin || ''}
                                  placeholder="min"
                                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm w-16 text-right focus:border-workx-lime/50 focus:outline-none"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                  type="number"
                                  id={`rateMax-${scale.id}`}
                                  defaultValue={scale.hourlyRateMax || ''}
                                  placeholder="max"
                                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm w-16 text-right focus:border-workx-lime/50 focus:outline-none"
                                />
                              </div>
                            ) : (
                              scale.hourlyRateMin && scale.hourlyRateMax ? (
                                <span className="text-white/60">
                                  €{scale.hourlyRateMin} - €{scale.hourlyRateMax}
                                </span>
                              ) : (
                                <span className="text-white/30">-</span>
                              )
                            )}
                          </td>
                          {isEditingSalarishuis && (
                            <td className="py-4 px-2">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={async () => {
                                      const salaryInput = document.getElementById(`salary-${scale.id}`) as HTMLInputElement
                                      const hourlyRateInput = document.getElementById(`hourlyRate-${scale.id}`) as HTMLInputElement
                                      const rateMinInput = document.getElementById(`rateMin-${scale.id}`) as HTMLInputElement
                                      const rateMaxInput = document.getElementById(`rateMax-${scale.id}`) as HTMLInputElement

                                      try {
                                        await fetch('/api/financien/salary-scales', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            ...scale,
                                            salary: parseFloat(salaryInput.value) || scale.salary,
                                            hourlyRateBase: parseFloat(hourlyRateInput.value) || scale.hourlyRateBase,
                                            hourlyRateMin: parseFloat(rateMinInput.value) || null,
                                            hourlyRateMax: parseFloat(rateMaxInput.value) || null
                                          })
                                        })
                                        const scaleRes = await fetch('/api/financien/salary-scales')
                                        if (scaleRes.ok) setSalaryScales(await scaleRes.json())
                                        setEditingSalaryScale(null)
                                      } catch (error) {
                                        console.error('Error updating scale:', error)
                                      }
                                    }}
                                    className="p-2 rounded-lg bg-workx-lime text-workx-dark hover:bg-workx-lime/80 transition-colors"
                                    title="Opslaan"
                                  >
                                    <Icons.check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingSalaryScale(null)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                    title="Annuleren"
                                  >
                                    <Icons.x size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setEditingSalaryScale(scale.id)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-workx-lime hover:bg-white/10 transition-colors"
                                  title="Bewerken"
                                >
                                  <Icons.edit size={14} />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-workx-dark/40 rounded-2xl p-12 border border-white/5 text-center">
              <Icons.euro size={48} className="text-white/20 mx-auto mb-4" />
              <p className="text-white/60">Nog geen salarisschaal geladen</p>
              {isManager && (
                <p className="text-gray-400 text-sm mt-2">Klik op "Salarisschaal Laden" om te beginnen</p>
              )}
            </div>
          )}

        </div>
      )}

      {/* Inzichten Tab - alleen voor PARTNER/ADMIN */}
      {activeTab === 'inzichten' && isManager && <InzichtenTab />}

    </div>
  )
}
