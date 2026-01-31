'use client'

import { useState, useMemo, useEffect } from 'react'
import { Icons } from '@/components/ui/Icons'
import jsPDF from 'jspdf'
import { drawWorkxLogo } from '@/lib/pdf'

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

type TabType = 'overzicht' | 'grafieken' | 'budgetten'

export default function FinancienPage() {
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
      } catch (error) {
        console.error('Error loading financial data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Save current year data to API
  const saveCurrentYearData = async () => {
    setSaving(true)
    try {
      await fetch('/api/financien', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentYearData)
      })
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

  // Line chart component
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
    const range = maxValue - minValue || 1

    const getY = (value: number) => {
      return height * 0.9 - ((value - minValue) / range) * (height * 0.8)
    }

    const getX = (index: number) => {
      return (index / (labels.length - 1)) * 95 + 2.5
    }

    return (
      <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
        <h3 className="text-white font-medium mb-4">{title}</h3>
        <div className="relative" style={{ height }}>
          <svg width="100%" height="100%" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line key={y} x1="0" y1={y * height / 100} x2="100" y2={y * height / 100} stroke="rgba(255,255,255,0.1)" strokeWidth="0.2" />
            ))}
            {/* Lines */}
            {data.map((series, seriesIdx) => {
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
        </div>
        <div className="flex justify-between mt-2 px-2">
          {labels.map((label, i) => (
            <span key={i} className="text-[10px] text-white/40">{label}</span>
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
          <span className="text-[10px] text-white/40">gebruikt</span>
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
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Categorie', 20, y + 7)
    doc.text('2024', 80, y + 7, { align: 'right' })
    doc.text('2025', 120, y + 7, { align: 'right' })
    doc.text('Verschil', 160, y + 7, { align: 'right' })
    y += 15

    doc.setFont('helvetica', 'normal')

    // Werkgeverslasten
    doc.text('Werkgeverslasten', 20, y)
    doc.text(formatCurrency(calculations.totals.werkgeverslasten[2024]), 80, y, { align: 'right' })
    doc.text(formatCurrency(calculations.totals.werkgeverslasten[2025]), 120, y, { align: 'right' })
    const wlDiff = calculations.totals.werkgeverslasten[2025] - calculations.totals.werkgeverslasten[2024]
    doc.setTextColor(wlDiff < 0 ? 0 : 200, wlDiff < 0 ? 150 : 50, 50)
    doc.text(formatCurrency(wlDiff), 160, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 8

    // Omzet
    doc.text('Omzet', 20, y)
    doc.text(formatCurrency(calculations.totals.omzet[2024]), 80, y, { align: 'right' })
    doc.text(formatCurrency(calculations.totals.omzet[2025]), 120, y, { align: 'right' })
    const omzetDiff = calculations.totals.omzet[2025] - calculations.totals.omzet[2024]
    doc.setTextColor(omzetDiff > 0 ? 0 : 200, omzetDiff > 0 ? 150 : 50, 50)
    doc.text(formatCurrency(omzetDiff), 160, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 8

    // Uren
    doc.text('Uren', 20, y)
    doc.text(formatNumber(calculations.totals.uren[2024]), 80, y, { align: 'right' })
    doc.text(formatNumber(calculations.totals.uren[2025]), 120, y, { align: 'right' })
    const urenDiff = calculations.totals.uren[2025] - calculations.totals.uren[2024]
    doc.setTextColor(urenDiff > 0 ? 0 : 200, urenDiff > 0 ? 150 : 50, 50)
    doc.text(formatNumber(urenDiff), 160, y, { align: 'right' })
    doc.setTextColor(50, 50, 50)
    y += 12

    // Saldo
    doc.setFont('helvetica', 'bold')
    doc.setFillColor(249, 255, 133)
    doc.rect(15, y - 5, pageWidth - 30, 12, 'F')
    doc.setTextColor(30, 30, 30)
    doc.text('Saldo (Omzet - Kosten)', 20, y + 3)
    doc.text(formatCurrency(calculations.saldoTotals[2024]), 80, y + 3, { align: 'right' })
    doc.text(formatCurrency(calculations.saldoTotals[2025]), 120, y + 3, { align: 'right' })
    const saldoDiff = calculations.saldoTotals[2025] - calculations.saldoTotals[2024]
    doc.text(formatCurrency(saldoDiff), 160, y + 3, { align: 'right' })
    y += 25

    // Budgets section
    if (budgets.length > 0) {
      doc.setTextColor(50, 50, 50)
      doc.setFontSize(14)
      doc.text('Budgetten', 15, y)
      y += 10

      doc.setFillColor(245, 245, 245)
      doc.rect(15, y, pageWidth - 30, 10, 'F')
      doc.setFontSize(10)
      doc.text('Categorie', 20, y + 7)
      doc.text('Budget', 80, y + 7, { align: 'right' })
      doc.text('Besteed', 120, y + 7, { align: 'right' })
      doc.text('Resterend', 160, y + 7, { align: 'right' })
      y += 15

      doc.setFont('helvetica', 'normal')
      budgets.forEach(budget => {
        const remaining = budget.budget - budget.spent
        doc.text(budget.name, 20, y)
        doc.text(formatCurrency(budget.budget), 80, y, { align: 'right' })
        doc.text(formatCurrency(budget.spent), 120, y, { align: 'right' })
        doc.setTextColor(remaining >= 0 ? 0 : 200, remaining >= 0 ? 150 : 50, 50)
        doc.text(formatCurrency(remaining), 160, y, { align: 'right' })
        doc.setTextColor(50, 50, 50)
        y += 8
      })

      // Budget totals
      const totalBudget = budgets.reduce((a, b) => a + b.budget, 0)
      const totalSpent = budgets.reduce((a, b) => a + b.spent, 0)
      const totalRemaining = totalBudget - totalSpent

      y += 4
      doc.setFont('helvetica', 'bold')
      doc.text('Totaal', 20, y)
      doc.text(formatCurrency(totalBudget), 80, y, { align: 'right' })
      doc.text(formatCurrency(totalSpent), 120, y, { align: 'right' })
      doc.setTextColor(totalRemaining >= 0 ? 0 : 200, totalRemaining >= 0 ? 150 : 50, 50)
      doc.text(formatCurrency(totalRemaining), 160, y, { align: 'right' })
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
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Financien</h1>
          <p className="text-white/40 mt-1">Overzicht werkgeverslasten, omzet en budgetten</p>
        </div>
        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-workx-lime text-workx-dark rounded-xl font-medium hover:bg-workx-lime/90 transition-colors"
        >
          <Icons.download size={18} />
          PDF Export
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { id: 'overzicht' as TabType, label: 'Overzicht', icon: Icons.chart },
          { id: 'grafieken' as TabType, label: 'Grafieken', icon: Icons.activity },
          { id: 'budgetten' as TabType, label: 'Budgetten', icon: Icons.pieChart },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-workx-lime text-workx-dark'
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overzicht Tab */}
      {activeTab === 'overzicht' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                label: `Omzet ${years[1]}`,
                value: formatCurrency(calculations.totals.omzet[years[1]]),
                diff: calculations.totals.omzet[years[1]] - calculations.totals.omzet[years[0]],
                positive: true
              },
              {
                label: `Kosten ${years[1]}`,
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
              <div key={i} className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
                <p className="text-white/40 text-sm">{kpi.label}</p>
                <p className="text-2xl font-semibold text-white mt-1">{kpi.value}</p>
                <div className={`flex items-center gap-1 mt-2 text-sm ${
                  (kpi.positive && kpi.diff > 0) || (!kpi.positive && kpi.diff < 0)
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {kpi.diff > 0 ? <Icons.trendingUp size={14} /> : <Icons.trendingDown size={14} />}
                  <span>{kpi.diff > 0 ? '+' : ''}{i === 3 ? formatNumber(kpi.diff) : formatCurrency(kpi.diff)}</span>
                  <span className="text-white/30">vs {years[0]}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Main Chart */}
          <LineChart
            data={[
              calculations.saldo[years[0]],
              calculations.saldo[years[1]]
            ]}
            labels={periods}
            title="Saldo per periode (Omzet - Werkgeverslasten)"
            colors={['#6366f1', '#f9ff85']}
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
                    <th className="text-left py-3 px-4 text-white/40 text-sm font-medium">Categorie</th>
                    <th className="text-left py-3 px-4 text-white/40 text-sm font-medium">Jaar</th>
                    {periods.map(p => (
                      <th key={p} className="text-right py-3 px-4 text-white/40 text-sm font-medium">{p}</th>
                    ))}
                    <th className="text-right py-3 px-4 text-workx-lime text-sm font-medium">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Werkgeverslasten */}
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top">Werkgeverslasten</td>
                    <td className="py-3 px-4 text-white/60 text-sm">{years[0]}</td>
                    {getDataForYear(years[0]).werkgeverslasten.map((v, i) => (
                      <td key={i} className="text-right py-3 px-4 text-white/80 text-sm">{formatCurrency(v)}</td>
                    ))}
                    <td className="text-right py-3 px-4 text-white font-medium">{formatCurrency(calculations.totals.werkgeverslasten[years[0]])}</td>
                  </tr>
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white/60 text-sm">{years[1]}</td>
                    {getDataForYear(years[1]).werkgeverslasten.map((v, i) => (
                      <td key={i} className="text-right py-3 px-4 text-white/80 text-sm">{formatCurrency(v)}</td>
                    ))}
                    <td className="text-right py-3 px-4 text-white font-medium">{formatCurrency(calculations.totals.werkgeverslasten[years[1]])}</td>
                  </tr>
                  <tr className="border-b border-white/5 bg-white/5">
                    <td className="py-3 px-4 text-workx-lime text-sm">Verschil</td>
                    {getDataForYear(years[1]).werkgeverslasten.map((v, i) => {
                      const diff = v - getDataForYear(years[0]).werkgeverslasten[i]
                      return (
                        <td key={i} className={`text-right py-3 px-4 text-sm ${diff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                      )
                    })}
                    <td className={`text-right py-3 px-4 font-medium ${
                      calculations.totals.werkgeverslasten[years[1]] - calculations.totals.werkgeverslasten[years[0]] < 0
                        ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(calculations.totals.werkgeverslasten[years[1]] - calculations.totals.werkgeverslasten[years[0]])}
                    </td>
                  </tr>

                  {/* Omzet */}
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td rowSpan={3} className="py-3 px-4 text-white font-medium align-top">Omzet</td>
                    <td className="py-3 px-4 text-white/60 text-sm">{years[0]}</td>
                    {getDataForYear(years[0]).omzet.map((v, i) => (
                      <td key={i} className="text-right py-3 px-4 text-white/80 text-sm">{formatCurrency(v)}</td>
                    ))}
                    <td className="text-right py-3 px-4 text-white font-medium">{formatCurrency(calculations.totals.omzet[years[0]])}</td>
                  </tr>
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4 text-white/60 text-sm">{years[1]}</td>
                    {getDataForYear(years[1]).omzet.map((v, i) => (
                      <td key={i} className="text-right py-3 px-4 text-white/80 text-sm">{formatCurrency(v)}</td>
                    ))}
                    <td className="text-right py-3 px-4 text-white font-medium">{formatCurrency(calculations.totals.omzet[years[1]])}</td>
                  </tr>
                  <tr className="border-b border-white/5 bg-white/5">
                    <td className="py-3 px-4 text-workx-lime text-sm">Verschil</td>
                    {getDataForYear(years[1]).omzet.map((v, i) => {
                      const diff = v - getDataForYear(years[0]).omzet[i]
                      return (
                        <td key={i} className={`text-right py-3 px-4 text-sm ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                        </td>
                      )
                    })}
                    <td className={`text-right py-3 px-4 font-medium ${
                      calculations.totals.omzet[years[1]] - calculations.totals.omzet[years[0]] > 0
                        ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(calculations.totals.omzet[years[1]] - calculations.totals.omzet[years[0]])}
                    </td>
                  </tr>

                  {/* Saldo */}
                  <tr className="bg-workx-lime/10">
                    <td className="py-3 px-4 text-workx-lime font-medium">Saldo {years[0]}</td>
                    <td></td>
                    {calculations.saldo[years[0]].map((v, i) => (
                      <td key={i} className={`text-right py-3 px-4 font-medium ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(v)}
                      </td>
                    ))}
                    <td className={`text-right py-3 px-4 font-bold ${calculations.saldoTotals[years[0]] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(calculations.saldoTotals[years[0]])}
                    </td>
                  </tr>
                  <tr className="bg-workx-lime/20">
                    <td className="py-3 px-4 text-workx-lime font-medium">Saldo {years[1]}</td>
                    <td></td>
                    {calculations.saldo[years[1]].map((v, i) => (
                      <td key={i} className={`text-right py-3 px-4 font-medium ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(v)}
                      </td>
                    ))}
                    <td className={`text-right py-3 px-4 font-bold ${calculations.saldoTotals[years[1]] >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(calculations.saldoTotals[years[1]])}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Current Year Input Section */}
          <div className="bg-workx-dark/40 rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-medium">{currentYear} Invoer</h3>
              <button
                onClick={saveCurrentYearData}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 bg-workx-lime/20 text-workx-lime rounded-lg text-sm hover:bg-workx-lime/30 transition-colors disabled:opacity-50"
              >
                <Icons.save size={14} />
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
            <div className="p-6 space-y-6">
              {['werkgeverslasten', 'omzet', 'uren'].map((category) => (
                <div key={category}>
                  <p className="text-white/60 text-sm mb-3 capitalize font-medium">{category}</p>
                  <div className="grid grid-cols-6 gap-3">
                    {periods.map((p, i) => (
                      <div key={p} className="space-y-1">
                        <label className="text-[10px] text-white/40 block">{p}</label>
                        <input
                          type="number"
                          value={currentYearData[category as keyof typeof currentYearData][i] || ''}
                          onChange={(e) => {
                            const newData = { ...currentYearData }
                            newData[category as keyof typeof currentYearData][i] = parseFloat(e.target.value) || 0
                            setCurrentYearData(newData)
                          }}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-workx-lime/50"
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
        <div className="grid grid-cols-2 gap-6">
          <LineChart
            data={[
              getDataForYear(years[0]).omzet,
              getDataForYear(years[1]).omzet
            ]}
            labels={periods}
            title="Omzet Ontwikkeling"
            colors={['#6366f1', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              getDataForYear(years[0]).werkgeverslasten,
              getDataForYear(years[1]).werkgeverslasten
            ]}
            labels={periods}
            title="Werkgeverslasten Ontwikkeling"
            colors={['#6366f1', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              getDataForYear(years[0]).uren,
              getDataForYear(years[1]).uren
            ]}
            labels={periods}
            title="Uren Ontwikkeling"
            colors={['#6366f1', '#f9ff85']}
            height={200}
          />

          <LineChart
            data={[
              calculations.saldo[years[0]],
              calculations.saldo[years[1]]
            ]}
            labels={periods}
            title="Saldo Ontwikkeling"
            colors={['#6366f1', '#f9ff85']}
            height={200}
          />

          {/* Year comparison */}
          <div className="col-span-2 bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-medium mb-6">Jaarlijkse Vergelijking</h3>
            <div className="grid grid-cols-4 gap-8">
              {['Omzet', 'Kosten', 'Saldo', 'Uren'].map((label, idx) => {
                const values = [
                  [calculations.totals.omzet[years[0]], calculations.totals.omzet[years[1]]],
                  [calculations.totals.werkgeverslasten[years[0]], calculations.totals.werkgeverslasten[years[1]]],
                  [calculations.saldoTotals[years[0]], calculations.saldoTotals[years[1]]],
                  [calculations.totals.uren[years[0]], calculations.totals.uren[years[1]]]
                ][idx]
                const max = Math.max(...values)
                const isUren = idx === 3

                return (
                  <div key={label}>
                    <p className="text-white/60 text-sm mb-4 text-center">{label}</p>
                    <div className="flex items-end justify-center gap-4 h-32">
                      {values.map((v, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                          <div
                            className={`w-12 rounded-t-lg transition-all ${i === 0 ? 'bg-indigo-500' : 'bg-workx-lime'}`}
                            style={{ height: `${(v / max) * 100}%`, minHeight: 20 }}
                          />
                          <span className="text-[10px] text-white/40">{[years[0], years[1]][i]}</span>
                          <span className="text-xs text-white/80">{isUren ? formatNumber(v) : formatCurrency(v)}</span>
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
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
              <p className="text-white/40 text-sm">Totaal Budget</p>
              <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
              <p className="text-white/40 text-sm">Totaal Besteed</p>
              <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(totalSpent)}</p>
              <p className="text-sm text-white/40 mt-1">{((totalSpent / totalBudget) * 100).toFixed(1)}% van budget</p>
            </div>
            <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
              <p className="text-white/40 text-sm">Nog te Besteden</p>
              <p className={`text-2xl font-semibold mt-1 ${totalBudget - totalSpent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalBudget - totalSpent)}
              </p>
            </div>
          </div>

          {/* Add Budget Form */}
          <div className="bg-workx-dark/40 rounded-2xl p-6 border border-white/5">
            <h3 className="text-white font-medium mb-4">Nieuw Budget Toevoegen</h3>
            <div className="flex gap-4">
              <input
                type="text"
                value={newBudgetName}
                onChange={(e) => setNewBudgetName(e.target.value)}
                placeholder="Budget naam (bijv. Marketing)"
                className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/50"
              />
              <input
                type="number"
                value={newBudgetAmount}
                onChange={(e) => setNewBudgetAmount(e.target.value)}
                placeholder="Bedrag"
                className="w-40 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/50"
              />
              <button
                onClick={addBudget}
                disabled={!newBudgetName || !newBudgetAmount}
                className="flex items-center gap-2 px-4 py-2 bg-workx-lime text-workx-dark rounded-xl font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icons.plus size={18} />
                Toevoegen
              </button>
            </div>
          </div>

          {/* Budget Cards */}
          <div className="grid grid-cols-2 gap-6">
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
                          <span className="text-white/40 text-sm">budget</span>
                        </div>
                      ) : (
                        <p className="text-white/40 text-sm mt-1">
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
                      <p className="text-white/40 text-xs">Besteed</p>
                      <p className="text-white font-medium">{formatCurrency(budget.spent)}</p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Resterend</p>
                      <p className={`font-medium ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Percentage</p>
                      <p className={`font-medium ${percentage > 100 ? 'text-red-400' : 'text-workx-lime'}`}>
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Update spent input */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <label className="text-white/40 text-xs block mb-2">Kosten bijwerken</label>
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
    </div>
  )
}
