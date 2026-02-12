import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const NAME_CORRECTIONS: Record<string, string> = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
}

// 2025 historical data (hardcoded, same as page.tsx)
const HISTORICAL_2025 = {
  werkgeverslasten: [88521, 72934, 68268, 107452, 90244, 154652, 81963.87, 79466.89, 82125, 80670, 103485, 95562],
  omzet: [-14020, 267211, 258439, 270619, 267833.5, 287433.03, 300822.95, 258031.08, 242402.91, 309577.51, 342265.3, 602865],
  uren: [1000.75, 955, 962, 975, 914, 998, 1020, 716, 1076, 1173, 1013, 1068],
}

function correctName(name: string): string {
  return NAME_CORRECTIONS[name] || name
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['PARTNER', 'ADMIN'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1

    // Run all queries in parallel
    const [
      monthlyHoursData,
      usersWithComp,
      salaryScales,
      sickDays,
      vacationBalances,
      financialData2026,
      bonusCalcs,
    ] = await Promise.all([
      prisma.monthlyHours.findMany({
        where: { year: currentYear }
      }),
      prisma.user.findMany({
        where: { isActive: true, role: { notIn: ['PARTNER', 'ADMIN'] }, NOT: { name: { contains: 'Lotte' } } },
        include: { compensation: true }
      }),
      prisma.salaryScale.findMany(),
      prisma.sickDayEntry.findMany({
        where: {
          startDate: { gte: new Date(currentYear, 0, 1) },
          endDate: { lte: new Date(currentYear, 11, 31) }
        }
      }),
      prisma.vacationBalance.findMany({
        include: { user: { select: { name: true } } }
      }),
      prisma.financialData2026.findFirst(),
      prisma.bonusCalculation.findMany({
        where: {
          createdAt: { gte: new Date(currentYear, 0, 1) }
        },
        include: { user: { select: { name: true } } }
      }),
    ])

    // Build name -> user mapping
    const nameToUser: Record<string, typeof usersWithComp[0]> = {}
    for (const user of usersWithComp) {
      if (user.name) nameToUser[user.name] = user
    }

    // Helper: find user for a MonthlyHours employeeName
    const findUserForName = (employeeName: string) => {
      const corrected = correctName(employeeName)
      if (nameToUser[corrected]) return nameToUser[corrected]
      // Fuzzy: match on first name
      const firstName = corrected.split(' ')[0]
      return usersWithComp.find(u => u.name?.split(' ')[0] === firstName) || null
    }

    // Helper: resolve salary for a user
    const resolveSalary = (user: typeof usersWithComp[0]): number | null => {
      if (user.compensation?.salary) return user.compensation.salary
      if (user.compensation?.experienceYear !== null && user.compensation?.experienceYear !== undefined) {
        const scale = salaryScales.find(s => s.experienceYear === user.compensation?.experienceYear)
        return scale?.salary || null
      }
      return null
    }

    // Aggregate monthly hours per employee (exclude partners/admins)
    const employeeHours: Record<string, { billable: number; worked: number; name: string }> = {}
    for (const entry of monthlyHoursData) {
      const name = correctName(entry.employeeName)
      // Only include employees that exist in usersWithComp (excludes PARTNER/ADMIN)
      const matchedUser = (() => {
        if (nameToUser[name]) return nameToUser[name]
        const firstName = name.split(' ')[0]
        return usersWithComp.find(u => u.name?.split(' ')[0] === firstName) || null
      })()
      if (!matchedUser) continue
      if (!employeeHours[name]) employeeHours[name] = { billable: 0, worked: 0, name }
      employeeHours[name].billable += entry.billableHours
      employeeHours[name].worked += entry.workedHours
    }

    // Monthly totals for forecast
    const monthlyTotals: { month: number; totalBillable: number; totalWorked: number }[] = []
    for (let m = 1; m <= 12; m++) {
      const monthEntries = monthlyHoursData.filter(e => e.month === m)
      if (monthEntries.length > 0) {
        monthlyTotals.push({
          month: m,
          totalBillable: monthEntries.reduce((s, e) => s + e.billableHours, 0),
          totalWorked: monthEntries.reduce((s, e) => s + e.workedHours, 0),
        })
      }
    }

    // Months elapsed (months with data)
    const monthsElapsed = monthlyTotals.length || Math.max(currentMonth - 1, 1)

    // ======= #1 Bezettingsgraad =======
    const bezettingsgraadPerEmployee = Object.entries(employeeHours).map(([name, h]) => ({
      name,
      billableHours: h.billable,
      workedHours: h.worked,
      percentage: h.worked > 0 ? (h.billable / h.worked) * 100 : 0,
    })).sort((a, b) => b.percentage - a.percentage)

    const totalBillable = Object.values(employeeHours).reduce((s, h) => s + h.billable, 0)
    const totalWorked = Object.values(employeeHours).reduce((s, h) => s + h.worked, 0)
    const kantoorGemiddeldeBezetting = totalWorked > 0 ? (totalBillable / totalWorked) * 100 : 0

    // ======= #2 Omzet per medewerker =======
    const omzetPerMedewerker = Object.entries(employeeHours).map(([name, h]) => {
      const user = findUserForName(name)
      const hourlyRate = user?.compensation?.hourlyRate || 0
      return {
        name,
        estimated: h.billable * hourlyRate,
        billableHours: h.billable,
        hourlyRate,
      }
    }).sort((a, b) => b.estimated - a.estimated)

    // ======= #3 Realisatiegraad =======
    const totalOmzet = omzetPerMedewerker.reduce((s, e) => s + e.estimated, 0)
    const kantoorGemiddeldTarief = totalBillable > 0 ? totalOmzet / totalBillable : 0

    const realisatiegraadPerEmployee = Object.entries(employeeHours).map(([name, h]) => {
      const user = findUserForName(name)
      const hourlyRate = user?.compensation?.hourlyRate || 0
      return {
        name,
        hourlyRate,
        effectiveRate: h.billable > 0 ? (h.billable * hourlyRate) / h.billable : 0,
      }
    }).sort((a, b) => b.hourlyRate - a.hourlyRate)

    // ======= #4 Kostprijs per medewerker =======
    const kostprijs = Object.entries(employeeHours).map(([name, h]) => {
      const user = findUserForName(name)
      const hourlyRate = user?.compensation?.hourlyRate || 0
      const monthlySalary = user ? (resolveSalary(user) || 0) : 0
      const salaryCostYTD = monthlySalary * monthsElapsed
      const kostprijsPerUur = h.billable > 0 && salaryCostYTD > 0 ? salaryCostYTD / h.billable : 0
      const margePerUur = hourlyRate - kostprijsPerUur
      return {
        name,
        kostprijsPerUur,
        margePerUur,
        hourlyRate,
        annualSalary: monthlySalary * 12,
        totalBillable: h.billable,
      }
    }).filter(e => e.annualSalary > 0).sort((a, b) => b.margePerUur - a.margePerUur)

    // ======= #5 Break-even analyse =======
    const breakeven = Object.entries(employeeHours).map(([name, h]) => {
      const user = findUserForName(name)
      const hourlyRate = user?.compensation?.hourlyRate || 0
      const annualSalary = user ? (resolveSalary(user) || 0) * 12 : 0
      const annualTargetHours = hourlyRate > 0 && annualSalary > 0 ? annualSalary / hourlyRate : 0
      const proRataTarget = annualTargetHours * (monthsElapsed / 12)
      const percentage = proRataTarget > 0 ? (h.billable / proRataTarget) * 100 : 0
      return {
        name,
        targetHours: proRataTarget,
        annualTargetHours,
        actualHoursYTD: h.billable,
        surplusHours: h.billable - proRataTarget,
        percentage,
      }
    }).filter(e => e.annualTargetHours > 0).sort((a, b) => b.percentage - a.percentage)

    // ======= #6 Verzuimpercentage =======
    // Calculate sick days per user per quarter
    const sickDaysPerUser: Record<string, { userId: string; name: string; totalDays: number; perQuarter: number[] }> = {}
    for (const entry of sickDays) {
      const user = usersWithComp.find(u => u.id === entry.userId)
      if (!user) continue
      const name = user.name || 'Onbekend'
      if (!sickDaysPerUser[entry.userId]) {
        sickDaysPerUser[entry.userId] = { userId: entry.userId, name, totalDays: 0, perQuarter: [0, 0, 0, 0] }
      }
      sickDaysPerUser[entry.userId].totalDays += entry.workDays
      const quarter = Math.floor((entry.startDate.getMonth()) / 3)
      sickDaysPerUser[entry.userId].perQuarter[quarter] += entry.workDays
    }

    // Available days per year (roughly 260 workdays minus holidays ~8 = 252)
    const availableDaysPerYear = 252
    const employeeCount = usersWithComp.length || 1

    const totalSickDays = Object.values(sickDaysPerUser).reduce((s, u) => s + u.totalDays, 0)
    const kantoorGemiddeldeVerzuim = (totalSickDays / (employeeCount * availableDaysPerYear)) * 100

    // Per quarter totals
    const perQuarterTotals = [0, 0, 0, 0]
    Object.values(sickDaysPerUser).forEach(u => {
      u.perQuarter.forEach((days, q) => { perQuarterTotals[q] += days })
    })
    const availableDaysPerQuarter = (availableDaysPerYear / 4) * employeeCount
    const perQuarterPercentages = perQuarterTotals.map(d => (d / availableDaysPerQuarter) * 100)

    // ======= #7 Vakantiedagen-risico =======
    const vakantieRisico = vacationBalances.map(vb => {
      const totaal = vb.opbouwLopendJaar + vb.overgedragenVorigJaar + vb.bijgekocht
      const opgenomen = vb.opgenomenLopendJaar
      const resterend = totaal - opgenomen
      return {
        name: vb.user?.name || 'Onbekend',
        opgenomen,
        resterend,
        totaal,
      }
    }).sort((a, b) => b.resterend - a.resterend)

    // ======= #8 Forecast =======
    const current2026Data = financialData2026 ? {
      omzet: JSON.parse(financialData2026.omzet) as number[],
      werkgeverslasten: JSON.parse(financialData2026.werkgeverslasten) as number[],
      uren: JSON.parse(financialData2026.uren) as number[],
    } : { omzet: Array(12).fill(0), werkgeverslasten: Array(12).fill(0), uren: Array(12).fill(0) }

    const actualMonths: { month: number; omzet: number }[] = []
    for (let m = 0; m < 12; m++) {
      if (current2026Data.omzet[m] !== 0) {
        actualMonths.push({ month: m + 1, omzet: current2026Data.omzet[m] })
      }
    }

    const totalOmzetYTD = actualMonths.reduce((s, m) => s + m.omzet, 0)
    const monthsWithData = actualMonths.length || 1
    const projectedMonthly = totalOmzetYTD / monthsWithData
    const forecastedTotal = projectedMonthly * 12

    const projectedRemaining: { month: number; omzet: number }[] = []
    for (let m = monthsWithData + 1; m <= 12; m++) {
      projectedRemaining.push({ month: m, omzet: projectedMonthly })
    }

    const previousYearOmzetTotal = HISTORICAL_2025.omzet.reduce((s, v) => s + v, 0)

    // ======= #9 Year-over-Year groei =======
    const current2026Totals = {
      omzet: current2026Data.omzet.reduce((s: number, v: number) => s + v, 0),
      werkgeverslasten: current2026Data.werkgeverslasten.reduce((s: number, v: number) => s + v, 0),
      uren: current2026Data.uren.reduce((s: number, v: number) => s + v, 0),
    }
    const current2026Saldo = current2026Totals.omzet - current2026Totals.werkgeverslasten

    const prev2025Totals = {
      omzet: HISTORICAL_2025.omzet.reduce((s, v) => s + v, 0),
      werkgeverslasten: HISTORICAL_2025.werkgeverslasten.reduce((s, v) => s + v, 0),
      uren: HISTORICAL_2025.uren.reduce((s, v) => s + v, 0),
    }
    const prev2025Saldo = prev2025Totals.omzet - prev2025Totals.werkgeverslasten

    const calcGrowth = (current: number, previous: number) => ({
      current,
      previous,
      growth: previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : 0,
    })

    const yoy = {
      omzet: calcGrowth(current2026Totals.omzet, prev2025Totals.omzet),
      werkgeverslasten: calcGrowth(current2026Totals.werkgeverslasten, prev2025Totals.werkgeverslasten),
      uren: calcGrowth(current2026Totals.uren, prev2025Totals.uren),
      saldo: calcGrowth(current2026Saldo, prev2025Saldo),
    }

    // ======= #10 Bonus ROI =======
    const totalInvoiceAmount = bonusCalcs.reduce((s, b) => s + b.invoiceAmount, 0)
    const totalBonusPaid = bonusCalcs.filter(b => b.bonusPaid).reduce((s, b) => s + b.bonusAmount, 0)
    const totalBonusPending = bonusCalcs.filter(b => !b.bonusPaid).reduce((s, b) => s + b.bonusAmount, 0)
    const totalUnpaidInvoices = bonusCalcs.filter(b => !b.invoicePaid).reduce((s, b) => s + b.invoiceAmount, 0)

    // ======= KPI Kaarten =======
    const employeesWithRate = usersWithComp.filter(u => u.compensation?.hourlyRate)
    const fteCount = employeesWithRate.length || 1
    const omzetPerFTE = totalOmzet / fteCount
    const avgMargePerUur = kostprijs.length > 0
      ? kostprijs.reduce((s, k) => s + k.margePerUur, 0) / kostprijs.length
      : 0

    return NextResponse.json({
      bezettingsgraad: {
        perEmployee: bezettingsgraadPerEmployee,
        kantoorGemiddelde: kantoorGemiddeldeBezetting,
        monthlyTrend: monthlyTotals,
      },
      omzetPerMedewerker,
      realisatiegraad: {
        kantoorGemiddeld: kantoorGemiddeldTarief,
        perEmployee: realisatiegraadPerEmployee,
      },
      kostprijs,
      breakeven,
      verzuim: {
        kantoorGemiddelde: kantoorGemiddeldeVerzuim,
        benchmark: 3,
        perQuarter: perQuarterPercentages,
        perEmployee: Object.values(sickDaysPerUser),
      },
      vakantieRisico,
      forecast: {
        actualMonths,
        forecastedTotal,
        projectedRemaining,
        previousYearTotal: previousYearOmzetTotal,
      },
      yoy,
      bonusROI: {
        totalInvoiceAmount,
        totalBonusPaid,
        totalBonusPending,
        totalUnpaidInvoices,
      },
      kpis: {
        omzetPerFTE,
        avgMargePerUur,
        verzuimPercentage: kantoorGemiddeldeVerzuim,
      },
      currentYear,
      monthsElapsed,
    })
  } catch (error) {
    console.error('Error computing analytics:', error)
    return NextResponse.json({ error: 'Kon analytics niet berekenen' }, { status: 500 })
  }
}
