import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Yearly hourly rate upgrade - triggered on 1 January each year
// Default increase: €10 per hour across all scales

interface ScaleChange {
  experienceYear: number
  label: string
  oldHourlyRateBase: number
  newHourlyRateBase: number
  oldHourlyRateMin: number | null
  newHourlyRateMin: number | null
  oldHourlyRateMax: number | null
  newHourlyRateMax: number | null
}

interface EmployeeChange {
  userId: string
  userName: string
  experienceYear: number | null
  oldHourlyRate: number
  newHourlyRate: number
}

// GET - Preview the changes
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString())
    const defaultIncrease = parseFloat(url.searchParams.get('increase') || '10')

    // Check if already processed
    const existingLog = await prisma.yearlyUpgradeLog.findUnique({
      where: {
        type_year: {
          type: 'HOURLY_RATE',
          year: year
        }
      }
    })

    if (existingLog) {
      return NextResponse.json({
        alreadyProcessed: true,
        processedAt: existingLog.processedAt,
        processedBy: existingLog.processedBy,
        changes: JSON.parse(existingLog.changes),
        year
      })
    }

    // Get current salary scales
    const salaryScales = await prisma.salaryScale.findMany({
      orderBy: { experienceYear: 'asc' }
    })

    // Preview scale changes
    const scaleChanges: ScaleChange[] = salaryScales.map(scale => ({
      experienceYear: scale.experienceYear,
      label: scale.label,
      oldHourlyRateBase: scale.hourlyRateBase,
      newHourlyRateBase: scale.hourlyRateBase + defaultIncrease,
      oldHourlyRateMin: scale.hourlyRateMin,
      newHourlyRateMin: scale.hourlyRateMin ? scale.hourlyRateMin + defaultIncrease : null,
      oldHourlyRateMax: scale.hourlyRateMax,
      newHourlyRateMax: scale.hourlyRateMax ? scale.hourlyRateMax + defaultIncrease : null
    }))

    // Get employees with compensation
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        compensation: { isNot: null }
      },
      include: {
        compensation: true
      }
    })

    // Map old scale rates for matching
    const oldScaleRates = new Map(salaryScales.map(s => [s.experienceYear, s.hourlyRateBase]))

    // Preview employee changes - only those whose rate matches the scale
    const employeeChanges: EmployeeChange[] = []
    for (const employee of employees) {
      if (employee.compensation) {
        const expYear = employee.compensation.experienceYear
        const currentRate = employee.compensation.hourlyRate

        // Check if employee's rate matches their scale's base rate
        if (expYear !== null) {
          const scaleRate = oldScaleRates.get(expYear)
          if (scaleRate !== undefined && currentRate === scaleRate) {
            employeeChanges.push({
              userId: employee.id,
              userName: employee.name,
              experienceYear: expYear,
              oldHourlyRate: currentRate,
              newHourlyRate: currentRate + defaultIncrease
            })
          }
        }
      }
    }

    return NextResponse.json({
      alreadyProcessed: false,
      year,
      effectiveDate: `${year}-01-01`,
      defaultIncrease,
      scaleChanges,
      employeeChanges,
      totalScales: scaleChanges.length,
      totalEmployees: employeeChanges.length
    })
  } catch (error) {
    console.error('Error previewing hourly rate upgrade:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST - Execute the upgrade
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const year = body.year || new Date().getFullYear()
    const defaultIncrease = body.defaultIncrease || 10
    const overrides: Record<number, number> = body.overrides || {} // { experienceYear: customIncrease }

    // Check if already processed
    const existingLog = await prisma.yearlyUpgradeLog.findUnique({
      where: {
        type_year: {
          type: 'HOURLY_RATE',
          year: year
        }
      }
    })

    if (existingLog) {
      return NextResponse.json({
        error: 'Uurtarief upgrade al uitgevoerd voor dit jaar',
        processedAt: existingLog.processedAt
      }, { status: 400 })
    }

    // Get current salary scales
    const salaryScales = await prisma.salaryScale.findMany({
      orderBy: { experienceYear: 'asc' }
    })

    // Map old rates for employee matching
    const oldScaleRates = new Map(salaryScales.map(s => [s.experienceYear, s.hourlyRateBase]))

    // Update salary scales
    const scaleChanges: ScaleChange[] = []
    for (const scale of salaryScales) {
      const increase = overrides[scale.experienceYear] ?? defaultIncrease

      const newData = {
        hourlyRateBase: scale.hourlyRateBase + increase,
        hourlyRateMin: scale.hourlyRateMin ? scale.hourlyRateMin + increase : null,
        hourlyRateMax: scale.hourlyRateMax ? scale.hourlyRateMax + increase : null
      }

      await prisma.salaryScale.update({
        where: { id: scale.id },
        data: newData
      })

      scaleChanges.push({
        experienceYear: scale.experienceYear,
        label: scale.label,
        oldHourlyRateBase: scale.hourlyRateBase,
        newHourlyRateBase: newData.hourlyRateBase,
        oldHourlyRateMin: scale.hourlyRateMin,
        newHourlyRateMin: newData.hourlyRateMin,
        oldHourlyRateMax: scale.hourlyRateMax,
        newHourlyRateMax: newData.hourlyRateMax
      })
    }

    // Get employees with compensation
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        compensation: { isNot: null }
      },
      include: {
        compensation: true
      }
    })

    // Update employee hourly rates - only those matching their scale
    const employeeChanges: EmployeeChange[] = []
    for (const employee of employees) {
      if (employee.compensation) {
        const expYear = employee.compensation.experienceYear
        const currentRate = employee.compensation.hourlyRate

        if (expYear !== null) {
          const scaleRate = oldScaleRates.get(expYear)
          if (scaleRate !== undefined && currentRate === scaleRate) {
            const increase = overrides[expYear] ?? defaultIncrease
            const newRate = currentRate + increase

            await prisma.employeeCompensation.update({
              where: { userId: employee.id },
              data: { hourlyRate: newRate }
            })

            employeeChanges.push({
              userId: employee.id,
              userName: employee.name,
              experienceYear: expYear,
              oldHourlyRate: currentRate,
              newHourlyRate: newRate
            })
          }
        }
      }
    }

    // Log the upgrade
    await prisma.yearlyUpgradeLog.create({
      data: {
        type: 'HOURLY_RATE',
        year: year,
        effectiveDate: new Date(`${year}-01-01`),
        processedBy: currentUser.id,
        changes: JSON.stringify({
          defaultIncrease,
          overrides,
          scaleChanges,
          employeeChanges
        })
      }
    })

    return NextResponse.json({
      success: true,
      year,
      effectiveDate: `${year}-01-01`,
      scaleChanges,
      employeeChanges,
      totalScalesUpdated: scaleChanges.length,
      totalEmployeesUpdated: employeeChanges.length
    })
  } catch (error) {
    console.error('Error executing hourly rate upgrade:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
