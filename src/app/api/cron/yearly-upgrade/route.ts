import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Yearly experience year upgrade - triggered on 1 March each year
// Can be called manually by PARTNER/ADMIN or by cron

interface UpgradeChange {
  userId: string
  userName: string
  oldExperienceYear: number
  newExperienceYear: number
  oldSalary: number | null
  newSalary: number | null
}

// GET - Preview the changes
export async function GET(req: NextRequest) {
  try {
    // Check auth - either cron secret or logged in manager
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronRequest) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
      })

      if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get year from query param or use current year
    const url = new URL(req.url)
    const year = parseInt(url.searchParams.get('year') || new Date().getFullYear().toString())

    // Check if upgrade already done for this year
    const existingLog = await prisma.yearlyUpgradeLog.findUnique({
      where: {
        type_year: {
          type: 'EXPERIENCE_YEAR',
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

    // Get all employees with compensation data
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        compensation: {
          isNot: null,
          experienceYear: { not: null }
        }
      },
      include: {
        compensation: true
      }
    })

    // Get salary scales for new salaries
    const salaryScales = await prisma.salaryScale.findMany()
    const scaleMap = new Map(salaryScales.map(s => [s.experienceYear, s]))

    // Calculate preview changes
    const changes: UpgradeChange[] = []
    for (const employee of employees) {
      if (employee.compensation && employee.compensation.experienceYear !== null) {
        const oldYear = employee.compensation.experienceYear
        const newYear = oldYear + 1
        const oldScale = scaleMap.get(oldYear)
        const newScale = scaleMap.get(newYear)

        changes.push({
          userId: employee.id,
          userName: employee.name,
          oldExperienceYear: oldYear,
          newExperienceYear: newYear,
          oldSalary: employee.compensation.salary || oldScale?.salary || null,
          newSalary: newScale?.salary || null
        })
      }
    }

    return NextResponse.json({
      alreadyProcessed: false,
      year,
      effectiveDate: `${year}-03-01`,
      totalEmployees: changes.length,
      changes
    })
  } catch (error) {
    console.error('Error previewing yearly upgrade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Execute the upgrade
export async function POST(req: NextRequest) {
  try {
    // Check auth - either cron secret or logged in manager
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`
    let processedBy = 'CRON'

    if (!isCronRequest) {
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, name: true }
      })

      if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      processedBy = currentUser.id
    }

    // Get year from body or use current year
    const body = await req.json().catch(() => ({}))
    const year = body.year || new Date().getFullYear()

    // Check if already processed
    const existingLog = await prisma.yearlyUpgradeLog.findUnique({
      where: {
        type_year: {
          type: 'EXPERIENCE_YEAR',
          year: year
        }
      }
    })

    if (existingLog) {
      return NextResponse.json({
        error: 'Upgrade al uitgevoerd voor dit jaar',
        processedAt: existingLog.processedAt
      }, { status: 400 })
    }

    // Get all employees with compensation data
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        compensation: {
          isNot: null,
          experienceYear: { not: null }
        }
      },
      include: {
        compensation: true
      }
    })

    // Get salary scales
    const salaryScales = await prisma.salaryScale.findMany()
    const scaleMap = new Map(salaryScales.map(s => [s.experienceYear, s]))

    // Execute upgrades
    const changes: UpgradeChange[] = []
    for (const employee of employees) {
      if (employee.compensation && employee.compensation.experienceYear !== null) {
        const oldYear = employee.compensation.experienceYear
        const newYear = oldYear + 1
        const oldScale = scaleMap.get(oldYear)
        const newScale = scaleMap.get(newYear)

        const oldSalary = employee.compensation.salary || oldScale?.salary || null
        const newSalary = newScale?.salary || null

        // Update the compensation record
        await prisma.employeeCompensation.update({
          where: { userId: employee.id },
          data: {
            experienceYear: newYear,
            salary: newSalary
          }
        })

        changes.push({
          userId: employee.id,
          userName: employee.name,
          oldExperienceYear: oldYear,
          newExperienceYear: newYear,
          oldSalary,
          newSalary
        })
      }
    }

    // Log the upgrade
    await prisma.yearlyUpgradeLog.create({
      data: {
        type: 'EXPERIENCE_YEAR',
        year: year,
        effectiveDate: new Date(`${year}-03-01`),
        processedBy,
        changes: JSON.stringify(changes)
      }
    })

    return NextResponse.json({
      success: true,
      year,
      effectiveDate: `${year}-03-01`,
      totalUpdated: changes.length,
      changes
    })
  } catch (error) {
    console.error('Error executing yearly upgrade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
