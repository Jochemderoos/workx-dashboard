'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import jsPDF from 'jspdf'
import { drawWorkxLogo } from '@/lib/pdf'
import { getPhotoUrl } from '@/lib/team-photos'

// Get dynamic years (current year and 2 previous years)
const currentYear = new Date().getFullYear()
const years = [currentYear - 2, currentYear - 1, currentYear] as const
type YearType = typeof years[number]

// Historical financial data - will be extended as years pass
const historicalData: Record<number, { werkgeverslasten: number[], omzet: number[], uren: number[] }> = {
  2024: {
    werkgeverslasten: [83498, 93037, 90637, 97496, 141919, 93079, 110122.21, 81458.26, 87341.8, 95277, 93797, 82992.28],
    omzet: [20771.73, 208021.62, 233890, 268590, 282943.32, 258967.33, 267419.35, 218107.23, 226676.53, 294707.11, 287153.81, 535280.4],
    uren: [904, 843, 1017, 1021, 964, 1003.4, 1061, 747, 804, 972, 916, 883]
  },
  2025: {
    werkgeverslasten: [88521, 72934, 68268, 107452, 90244, 154652, 81963.87, 79466.89, 82125, 80670, 103485, 95562],
    omzet: [-14020, 267211, 258439, 270619, 267833.5, 287433.03, 300822.95, 258031.08, 242402.91, 309577.51, 342265.3, 602865],
    uren: [1000.75, 955, 962, 975, 914, 998, 1020, 716, 1076, 1173, 1013, 1068]
  }
}

// Get data for a year - returns zeros if not available
const getYearData = (year: number) => {
  return historicalData[year] || {
    werkgeverslasten: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
  betaaldTotaalWeken: number
  betaaldOpgenomenWeken: number
  onbetaaldTotaalWeken: number
  onbetaaldOpgenomenWeken: number
  eindDatum: string | null
  note: string | null
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
  parentalLeave: ParentalLeave | null
}

type TabType = 'overzicht' | 'grafieken' | 'budgetten' | 'salarishuis' | 'arbeidsvoorwaarden'

export default function FinancienPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabType>('overzicht')
  const [currentYearData, setCurrentYearData] = useState({
    werkgeverslasten: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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

  // Check if user is PARTNER or ADMIN
  const isManager = session?.user?.role === 'PARTNER' || session?.user?.role === 'ADMIN'

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
      omzet: {},
      uren: {}
    }

    const saldo: Record<number, number[]> = {}
    const saldoTotals: Record<number, number> = {}

    years.forEach(year => {
      const yearData = getDataForYear(year)
      totals.werkgeverslasten[year] = yearData.werkgeverslasten.reduce((a, b) => a + b, 0)
      totals.omzet[year] = yearData.omzet.reduce((a, b) => a + b, 0)
      totals.uren[year] = yearData.uren.reduce((a, b) => a + b, 0)
      saldo[year] = periods.map((_, i) => yearData.omzet[i] - yearData.werkgeverslasten[i])
      saldoTotals[year] = totals.omzet[year] - totals.werkgeverslasten[year]
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
    const percentage = Math.min((spent / budget) * 100, 100)
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
  const downloadPDF = () => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Column positions - adjusted for better spacing
    const col1 = 20    // Label
    const col2 = 95    // 2024
    const col3 = 135   // 2025
    const col4 = 175   // Verschil

    // Draw authentic Workx logo
    drawWorkxLogo(doc, 15, 15, 55)

    // Title
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Financieel Overzicht', 80, 28)

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
    const afterRow1 = drawBarChart('Werkgeverslasten', [getDataForYear(years[0]).werkgeverslasten, getDataForYear(years[1]).werkgeverslasten], y, chartWidth, chartHeight, rightX)
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

  const totalBudget = budgets.reduce((a, b) => a + b.budget, 0)
  const totalSpent = budgets.reduce((a, b) => a + b.spent, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-workx-lime"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
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
            { id: 'grafieken' as TabType, label: 'Grafieken', icon: Icons.activity },
            { id: 'budgetten' as TabType, label: 'Budgetten', icon: Icons.pieChart },
            { id: 'salarishuis' as TabType, label: 'Salarishuis', icon: Icons.euro },
            { id: 'arbeidsvoorwaarden' as TabType, label: 'Arbeidsvoorwaarden', icon: Icons.users },
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
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              {
                label: `Omzet ${years[1]}`,
                value: formatCurrency(calculations.totals.omzet[years[1]]),
                diff: calculations.totals.omzet[years[1]] - calculations.totals.omzet[years[0]],
                positive: true
              },
              {
                label: `Werkgeverslasten ${years[1]}`,
                value: formatCurrency(calculations.totals.werkgeverslasten[years[1]]),
                diff: calculations.totals.werkgeverslasten[years[1]] - calculations.totals.werkgeverslasten[years[0]],
                positive: false
              },
              {
                label: `Saldo ${years[1]}`,
                value: formatCurrency(calculations.saldoTotals[years[1]]),
                diff: calculations.saldoTotals[years[1]] - calculations.saldoTotals[years[0]],
                positive: true
              },
              {
                label: `Uren ${years[1]}`,
                value: formatNumber(calculations.totals.uren[years[1]]),
                diff: calculations.totals.uren[years[1]] - calculations.totals.uren[years[0]],
                positive: true
              }
            ].map((kpi, i) => (
              <div key={i} className="bg-workx-dark/40 rounded-2xl p-3 sm:p-6 border border-white/5">
                <p className="text-gray-400 text-xs sm:text-sm truncate">{kpi.label}</p>
                <p className="text-lg sm:text-2xl font-semibold text-white mt-1 truncate">{kpi.value}</p>
                <div className={`flex items-center gap-1 mt-1 sm:mt-2 text-xs sm:text-sm ${
                  (kpi.positive && kpi.diff > 0) || (!kpi.positive && kpi.diff < 0)
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {kpi.diff > 0 ? <Icons.trendingUp size={12} className="flex-shrink-0 sm:w-[14px] sm:h-[14px]" /> : <Icons.trendingDown size={12} className="flex-shrink-0 sm:w-[14px] sm:h-[14px]" />}
                  <span className="truncate">{kpi.diff > 0 ? '+' : ''}{i === 3 ? formatNumber(kpi.diff) : formatCurrency(kpi.diff)}</span>
                  <span className="text-white/30 hidden sm:inline">vs {years[0]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Chart - all 3 years */}
          <LineChart
            data={[
              calculations.saldo[years[0]],
              calculations.saldo[years[1]],
              calculations.saldo[years[2]]
            ]}
            labels={periods}
            title="Saldo per periode (Omzet - Werkgeverslasten)"
            colors={['#f97316', '#06b6d4', '#f9ff85']}
            height={250}
          />

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
                  {/* Werkgeverslasten - all 3 years */}
                  {years.map((year, yearIdx) => (
                    <tr key={`wl-${year}`} className={`border-b border-white/5 hover:bg-white/5 ${yearIdx === 2 ? 'bg-workx-lime/5' : ''}`}>
                      {yearIdx === 0 && <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top">Werkgeverslasten</td>}
                      <td className={`py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime' : 'text-white/60'}`}>{year}</td>
                      {getDataForYear(year).werkgeverslasten.map((v, i) => (
                        <td key={i} className={`text-right py-3 px-4 text-sm ${yearIdx === 2 ? 'text-workx-lime/80' : 'text-gray-200'}`}>
                          {formatCurrency(v)}
                        </td>
                      ))}
                      <td className={`text-right py-3 px-4 font-medium ${yearIdx === 2 ? 'text-workx-lime' : 'text-white'}`}>
                        {formatCurrency(calculations.totals.werkgeverslasten[year])}
                      </td>
                    </tr>
                  ))}

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
              {['werkgeverslasten', 'omzet', 'uren'].map((category) => (
                <div key={category}>
                  <p className="text-white/60 text-sm mb-3 capitalize font-medium">{category}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                    {periods.map((p, i) => (
                      <div key={p} className="space-y-1">
                        <label className="text-xs text-gray-400 block">{p}</label>
                        <input
                          type="number"
                          value={currentYearData[category as keyof typeof currentYearData][i] || ''}
                          onChange={(e) => {
                            const newData = { ...currentYearData }
                            newData[category as keyof typeof currentYearData][i] = parseFloat(e.target.value) || 0
                            setCurrentYearData(newData)
                          }}
                          className="w-full px-2 sm:px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-workx-lime/50"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grafieken Tab */}
      {activeTab === 'grafieken' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <LineChart
            data={[
              getDataForYear(years[0]).omzet,
              getDataForYear(years[1]).omzet,
              getDataForYear(years[2]).omzet
            ]}
            labels={periods}
            title="Omzet Ontwikkeling"
            colors={['#f97316', '#06b6d4', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              getDataForYear(years[0]).werkgeverslasten,
              getDataForYear(years[1]).werkgeverslasten,
              getDataForYear(years[2]).werkgeverslasten
            ]}
            labels={periods}
            title="Werkgeverslasten Ontwikkeling"
            colors={['#f97316', '#06b6d4', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              getDataForYear(years[0]).uren,
              getDataForYear(years[1]).uren,
              getDataForYear(years[2]).uren
            ]}
            labels={periods}
            title="Uren Ontwikkeling"
            colors={['#f97316', '#06b6d4', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              calculations.saldo[years[0]],
              calculations.saldo[years[1]],
              calculations.saldo[years[2]]
            ]}
            labels={periods}
            title="Saldo Ontwikkeling"
            colors={['#f97316', '#06b6d4', '#f9ff85']}
            height={200}
          />

          {/* Year comparison - all 3 years */}
          <div className="md:col-span-2 bg-workx-dark/40 rounded-2xl p-4 sm:p-6 border border-white/5">
            <h3 className="text-white font-medium mb-4 sm:mb-6">Jaarlijkse Vergelijking</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8">
              {['Omzet', 'Werkgeverslasten', 'Saldo', 'Uren'].map((label, idx) => {
                const values = [
                  [calculations.totals.omzet[years[0]], calculations.totals.omzet[years[1]], calculations.totals.omzet[years[2]]],
                  [calculations.totals.werkgeverslasten[years[0]], calculations.totals.werkgeverslasten[years[1]], calculations.totals.werkgeverslasten[years[2]]],
                  [calculations.saldoTotals[years[0]], calculations.saldoTotals[years[1]], calculations.saldoTotals[years[2]]],
                  [calculations.totals.uren[years[0]], calculations.totals.uren[years[1]], calculations.totals.uren[years[2]]]
                ][idx]
                const max = Math.max(...values.map(Math.abs)) || 1
                const isUren = idx === 3
                const barColors = ['bg-orange-500', 'bg-cyan-500', 'bg-workx-lime']

                return (
                  <div key={label}>
                    <p className="text-white/60 text-sm mb-4 text-center">{label}</p>
                    <div className="flex items-end justify-center gap-3 h-32">
                      {values.map((v, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                          <div
                            className={`w-10 rounded-t-lg transition-all ${barColors[i]}`}
                            style={{ height: `${(Math.abs(v) / max) * 100}%`, minHeight: 20 }}
                          />
                          <span className="text-xs text-gray-400">{years[i]}</span>
                          <span className="text-xs text-gray-200">{isUren ? formatNumber(v) : formatCurrency(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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
              <p className="text-xs sm:text-sm text-gray-400 mt-1 hidden sm:block">{((totalSpent / totalBudget) * 100).toFixed(1)}% van budget</p>
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
              const percentage = (budget.spent / budget.budget) * 100

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
                  const percentage = (budget.spent / totalBudget) * 100
                  const budgetPercentage = (budget.budget / totalBudget) * 100

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

      {/* Arbeidsvoorwaarden Tab - Voor iedereen (medewerkers zien alleen eigen plaatje) */}
      {activeTab === 'arbeidsvoorwaarden' && (
        <div className="space-y-6">
          <div>
            <p className="text-white/60 text-sm">
              {isManager
                ? 'Overzicht van alle medewerkers met hun arbeidsvoorwaarden en bonussen'
                : 'Jouw arbeidsvoorwaarden en bonussen'
              }
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Salarissen zijn gekoppeld aan het salarishuis per 1 maart 2026
            </p>
          </div>

          {/* Employee Cards - Football card style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map(employee => {
              const photoUrl = getPhotoUrl(employee.name)
              const yearsOfService = employee.startDate
                ? Math.floor((new Date().getTime() - new Date(employee.startDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
                : null
              const salaryScale = employee.compensation?.experienceYear !== null && employee.compensation?.experienceYear !== undefined
                ? salaryScales.find(s => s.experienceYear === employee.compensation?.experienceYear)
                : null

              // Check if this is support staff (Hanna, Lotte) - no experience year
              const isSupportStaff = employee.compensation?.experienceYear === null || employee.compensation?.experienceYear === undefined
              const isHourlyWage = employee.compensation?.isHourlyWage || false
              const firstName = employee.name.split(' ')[0].toLowerCase()
              const isHannaOrLotte = firstName === 'hanna' || firstName === 'lotte'

              return (
                <div
                  key={employee.id}
                  className="relative group"
                >
                  {/* Card Background with gradient border */}
                  <div className="absolute inset-0 bg-gradient-to-br from-workx-lime/30 via-workx-lime/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div className="relative bg-gradient-to-br from-workx-dark/80 to-workx-dark/40 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
                    {/* Top accent bar - different color for support staff */}
                    <div className={`h-1 bg-gradient-to-r ${isHannaOrLotte ? 'from-cyan-400 via-cyan-400/50' : 'from-workx-lime via-workx-lime/50'} to-transparent`} />

                    {/* Photo and Name Section */}
                    <div className="p-4 sm:p-6 pb-4">
                      <div className="flex items-start gap-4">
                        {/* Photo */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden ring-2 ${isHannaOrLotte ? 'ring-cyan-400/30 shadow-cyan-400/20' : 'ring-workx-lime/30 shadow-workx-lime/20'} shadow-lg`}>
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt={employee.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full bg-gradient-to-br ${isHannaOrLotte ? 'from-cyan-400 to-cyan-400/60' : 'from-workx-lime to-workx-lime/60'} flex items-center justify-center`}>
                                <span className="text-workx-dark text-xl sm:text-2xl font-bold">
                                  {employee.name.charAt(0)}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Experience badge - only for lawyers with experience year */}
                          {!isHannaOrLotte && employee.compensation?.experienceYear !== null && employee.compensation?.experienceYear !== undefined && (
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-workx-lime flex items-center justify-center shadow-lg">
                              <span className="text-workx-dark text-xs font-bold">{employee.compensation.experienceYear}</span>
                            </div>
                          )}
                          {/* Support staff badge */}
                          {isHannaOrLotte && (
                            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-lg bg-cyan-400 flex items-center justify-center shadow-lg">
                              <span className="text-workx-dark text-xs font-bold">STAFF</span>
                            </div>
                          )}
                        </div>

                        {/* Name and Role */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-lg truncate">{employee.name}</h3>
                          <p className="text-gray-400 text-sm">{employee.role === 'ADMIN' ? 'Kantoormanager' : employee.role === 'EMPLOYEE' ? 'Advocaat' : employee.role}</p>
                          {yearsOfService !== null && (
                            <p className={`${isHannaOrLotte ? 'text-cyan-400/60' : 'text-workx-lime/60'} text-xs mt-1`}>
                              {yearsOfService} jaar bij Workx
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats Section */}
                    <div className="px-4 sm:px-6 py-4 border-t border-white/5 bg-black/20">
                      {isHannaOrLotte ? (
                        /* Support Staff: Salary/Hourly wage only */
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                              {isHourlyWage ? 'Uurloon' : 'Salaris'}
                            </p>
                            <p className="text-cyan-400 font-semibold">
                              {employee.compensation?.salary
                                ? isHourlyWage
                                  ? `€${employee.compensation.salary}/uur`
                                  : formatCurrency(employee.compensation.salary)
                                : '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Type</p>
                            <p className="text-white font-medium">
                              {isHourlyWage ? 'Uurloner' : 'Vast contract'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* Lawyers: Experience year, salary, hourly rate */
                        <div>
                          {/* Row 1: Experience Year and Hourly Rate */}
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <span className="text-gray-400 text-sm block mb-1">Ervaringsjaar</span>
                              <span className="text-white text-base">
                                {salaryScale?.label || (employee.compensation?.experienceYear !== null ? `${employee.compensation?.experienceYear}e jaars` : '-')}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-gray-400 text-sm block mb-1">Uurtarief</span>
                              <span className="text-workx-lime text-base font-semibold">
                                {employee.compensation ? `€${employee.compensation.hourlyRate}` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Row 2: Salary */}
                          <div className="pt-4 border-t border-gray-700">
                            <span className="text-gray-400 text-sm block mb-1">Bruto Salaris</span>
                            <span className="text-white font-bold text-xl">
                              {employee.compensation?.salary ? formatCurrency(employee.compensation.salary) : (salaryScale ? formatCurrency(salaryScale.salary) : '-')}
                            </span>
                            <span className="text-gray-500 text-sm ml-1">/mnd</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bonus Section - only for lawyers */}
                    {!isHannaOrLotte && (
                      <div className="px-4 sm:px-6 py-4 border-t border-white/5">
                        <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Bonus {currentYear}</p>
                        <div className="grid grid-cols-2 gap-3">
                          {/* Paid Bonus */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                              <span className="text-white/60 text-xs">Betaald</span>
                            </div>
                            <p className="text-green-400 font-semibold">{formatCurrency(employee.bonusPaid)}</p>
                          </div>

                          {/* Pending Bonus */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse flex-shrink-0" />
                              <span className="text-white/60 text-xs">In afwachting</span>
                            </div>
                            <p className="text-orange-400 font-semibold">{formatCurrency(employee.bonusPending)}</p>
                          </div>
                        </div>

                        {/* Total Bonus Bar */}
                        {employee.bonusTotal > 0 && (
                          <div className="mt-3">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-400"
                                style={{
                                  width: `${(employee.bonusPaid / employee.bonusTotal) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vacation Section */}
                    {employee.vacationBalance && (
                      <div className="px-4 sm:px-6 py-4 border-t border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Icons.sun size={14} className="text-green-400" />
                            <span className="text-gray-400 text-sm">Vakantiedagen {currentYear}</span>
                          </div>
                          {employee.parentalLeave && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">O.V.</span>
                          )}
                        </div>
                        <div className="flex justify-between items-start">
                          {/* Remaining Days */}
                          <div>
                            <span className="text-2xl font-bold text-green-400">
                              {(employee.vacationBalance.opbouwLopendJaar + employee.vacationBalance.overgedragenVorigJaar + employee.vacationBalance.bijgekocht - employee.vacationBalance.opgenomenLopendJaar).toFixed(1)}
                            </span>
                            <span className="text-gray-400 text-sm block">dagen over</span>
                          </div>

                          {/* Details */}
                          <div className="text-right space-y-1">
                            <div className="text-sm">
                              <span className="text-gray-500">Totaal: </span>
                              <span className="text-gray-300">{(employee.vacationBalance.opbouwLopendJaar + employee.vacationBalance.overgedragenVorigJaar + employee.vacationBalance.bijgekocht).toFixed(1)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-gray-500">Opgenomen: </span>
                              <span className="text-gray-300">{employee.vacationBalance.opgenomenLopendJaar.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Parental Leave indicator */}
                        {employee.parentalLeave && (
                          <div className="mt-3 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-purple-400">Betaald O.V.</span>
                              <span className="text-white/60">
                                {employee.parentalLeave.betaaldOpgenomenWeken}/{employee.parentalLeave.betaaldTotaalWeken} wk
                              </span>
                            </div>
                            {employee.parentalLeave.onbetaaldTotaalWeken > 0 && (
                              <div className="flex items-center justify-between text-xs mt-1">
                                <span className="text-purple-400/70">Onbetaald O.V.</span>
                                <span className="text-white/60">
                                  {employee.parentalLeave.onbetaaldOpgenomenWeken}/{employee.parentalLeave.onbetaaldTotaalWeken} wk
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Edit Button (for managers) */}
                    {isManager && (
                      <div className="px-4 sm:px-6 py-3 border-t border-white/5 bg-black/10">
                        <button
                          onClick={() => setEditingEmployee(editingEmployee === employee.id ? null : employee.id)}
                          className={`w-full flex items-center justify-center gap-2 text-gray-400 ${isHannaOrLotte ? 'hover:text-cyan-400' : 'hover:text-workx-lime'} transition-colors text-sm`}
                        >
                          <Icons.edit size={14} />
                          <span>Bewerken</span>
                        </button>

                        {/* Edit Form */}
                        {editingEmployee === employee.id && (
                          <div className="mt-4 space-y-3">
                            {isHannaOrLotte ? (
                              /* Support staff edit form - manual salary/hourly wage */
                              <>
                                <div>
                                  <label className="text-gray-400 text-xs block mb-1">Type beloning</label>
                                  <select
                                    defaultValue={isHourlyWage ? 'hourly' : 'salary'}
                                    onChange={async (e) => {
                                      const newIsHourlyWage = e.target.value === 'hourly'
                                      try {
                                        await fetch('/api/financien/employee-compensation', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            userId: employee.id,
                                            experienceYear: null,
                                            hourlyRate: employee.compensation?.hourlyRate || 0,
                                            salary: employee.compensation?.salary || null,
                                            isHourlyWage: newIsHourlyWage
                                          })
                                        })
                                        const empRes = await fetch('/api/financien/employee-compensation')
                                        if (empRes.ok) setEmployees(await empRes.json())
                                      } catch (error) {
                                        console.error('Error updating compensation:', error)
                                      }
                                    }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                                  >
                                    <option value="salary" className="bg-workx-dark">Vast salaris</option>
                                    <option value="hourly" className="bg-workx-dark">Uurloon</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-gray-400 text-xs block mb-1">
                                    {isHourlyWage ? 'Uurloon (€)' : 'Bruto salaris (€)'}
                                  </label>
                                  <input
                                    type="number"
                                    defaultValue={employee.compensation?.salary || ''}
                                    placeholder={isHourlyWage ? 'bijv. 25' : 'bijv. 3500'}
                                    onBlur={async (e) => {
                                      const value = parseFloat(e.target.value)
                                      if (!isNaN(value)) {
                                        try {
                                          await fetch('/api/financien/employee-compensation', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              userId: employee.id,
                                              experienceYear: null,
                                              hourlyRate: isHourlyWage ? value : 0,
                                              salary: value,
                                              isHourlyWage: isHourlyWage
                                            })
                                          })
                                          const empRes = await fetch('/api/financien/employee-compensation')
                                          if (empRes.ok) setEmployees(await empRes.json())
                                        } catch (error) {
                                          console.error('Error updating compensation:', error)
                                        }
                                      }
                                    }}
                                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-400/50"
                                  />
                                </div>
                              </>
                            ) : (
                              /* Lawyer edit form - experience year selection */
                              <div>
                                <label className="text-gray-400 text-xs block mb-1">Ervaringsjaar</label>
                                <select
                                  defaultValue={employee.compensation?.experienceYear ?? 0}
                                  onChange={async (e) => {
                                    const scale = salaryScales.find(s => s.experienceYear === parseInt(e.target.value))
                                    if (scale) {
                                      try {
                                        await fetch('/api/financien/employee-compensation', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            userId: employee.id,
                                            experienceYear: scale.experienceYear,
                                            hourlyRate: scale.hourlyRateBase,
                                            salary: scale.salary
                                          })
                                        })
                                        const empRes = await fetch('/api/financien/employee-compensation')
                                        if (empRes.ok) setEmployees(await empRes.json())
                                      } catch (error) {
                                        console.error('Error updating compensation:', error)
                                      }
                                    }
                                  }}
                                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-workx-lime/50"
                                >
                                  {salaryScales.map(scale => (
                                    <option key={scale.id} value={scale.experienceYear} className="bg-workx-dark">
                                      {scale.label} - €{scale.salary}/mnd - €{scale.hourlyRateBase}/uur
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {employees.length === 0 && (
            <div className="bg-workx-dark/40 rounded-2xl p-12 border border-white/5 text-center">
              <Icons.users size={48} className="text-white/20 mx-auto mb-4" />
              <p className="text-white/60">
                {isManager
                  ? 'Nog geen medewerkers met arbeidsvoorwaarden'
                  : 'Je arbeidsvoorwaarden zijn nog niet ingesteld. Neem contact op met HR.'
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
