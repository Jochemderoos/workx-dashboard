import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

// Salarisschaal data per 1 maart 2026
const SALARY_SCALES = [
  { experienceYear: 0, label: 'Juridisch medewerker', salary: 2800, hourlyRateBase: 150, hourlyRateMin: null, hourlyRateMax: null },
  { experienceYear: 1, label: '1e jaars', salary: 3700, hourlyRateBase: 205, hourlyRateMin: 205, hourlyRateMax: 230 },
  { experienceYear: 2, label: '2e jaars', salary: 3900, hourlyRateBase: 225, hourlyRateMin: 225, hourlyRateMax: 250 },
  { experienceYear: 3, label: '3e jaars', salary: 4100, hourlyRateBase: 255, hourlyRateMin: 255, hourlyRateMax: 275 },
  { experienceYear: 4, label: '4e jaars', salary: 5200, hourlyRateBase: 260, hourlyRateMin: 260, hourlyRateMax: 280 },
  { experienceYear: 5, label: '5e jaars', salary: 5600, hourlyRateBase: 270, hourlyRateMin: 270, hourlyRateMax: 300 },
  { experienceYear: 6, label: '6e jaars', salary: 6200, hourlyRateBase: 285, hourlyRateMin: 285, hourlyRateMax: 310 },
  { experienceYear: 7, label: '7e jaars', salary: 6700, hourlyRateBase: 310, hourlyRateMin: 310, hourlyRateMax: 330 },
  { experienceYear: 8, label: '8e jaars', salary: 7100, hourlyRateBase: 310, hourlyRateMin: 310, hourlyRateMax: 330 },
  { experienceYear: 9, label: '9e jaars', salary: 7300, hourlyRateBase: 310, hourlyRateMin: 310, hourlyRateMax: 330 },
  { experienceYear: 10, label: '10e jaars', salary: 7500, hourlyRateBase: 310, hourlyRateMin: null, hourlyRateMax: null },
  { experienceYear: 11, label: '11e jaars', salary: 7700, hourlyRateBase: 310, hourlyRateMin: null, hourlyRateMax: null },
  { experienceYear: 12, label: '12e jaars', salary: 8000, hourlyRateBase: 310, hourlyRateMin: null, hourlyRateMax: null },
]

// Medewerker toewijzingen per maart 2026
const EMPLOYEE_ASSIGNMENTS: Record<string, { experienceYear: number, hourlyRate: number, notes?: string }> = {
  'Heleen': { experienceYear: 2, hourlyRate: 225 },
  'Kay': { experienceYear: 3, hourlyRate: 255 },
  'Erika': { experienceYear: 4, hourlyRate: 260 },
  'Wies': { experienceYear: 8, hourlyRate: 310 },
  'Justine': { experienceYear: 8, hourlyRate: 310 },
  'Barbara': { experienceYear: 8, hourlyRate: 310 },
  'Emma': { experienceYear: 9, hourlyRate: 310 },
  'Alain': { experienceYear: 9, hourlyRate: 290, notes: 'Afwijkend tarief' },
  'Julia': { experienceYear: 9, hourlyRate: 310 },
  'Marlieke': { experienceYear: 10, hourlyRate: 310 },
}

// POST - Seed salarisschaal en medewerker toewijzingen (alleen PARTNER en ADMIN)
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user?.email! }
    })

    if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Seed alle salarisschalen
    const scaleResults = await Promise.all(
      SALARY_SCALES.map(scale =>
        prisma.salaryScale.upsert({
          where: { experienceYear: scale.experienceYear },
          update: {
            label: scale.label,
            salary: scale.salary,
            hourlyRateBase: scale.hourlyRateBase,
            hourlyRateMin: scale.hourlyRateMin,
            hourlyRateMax: scale.hourlyRateMax
          },
          create: scale
        })
      )
    )

    // Zoek alle medewerkers en wijs compensaties toe
    const allUsers = await prisma.user.findMany({
      where: { isActive: true }
    })

    let compensationCount = 0
    for (const dbUser of allUsers) {
      // Zoek op voornaam (case-insensitive)
      const firstName = dbUser.name.split(' ')[0]
      const assignment = Object.entries(EMPLOYEE_ASSIGNMENTS).find(
        ([name]) => name.toLowerCase() === firstName.toLowerCase()
      )

      if (assignment) {
        const [, data] = assignment
        const scale = SALARY_SCALES.find(s => s.experienceYear === data.experienceYear)

        await prisma.employeeCompensation.upsert({
          where: { userId: dbUser.id },
          update: {
            experienceYear: data.experienceYear,
            hourlyRate: data.hourlyRate,
            salary: scale?.salary || null,
            isHourlyWage: false,
            notes: data.notes || null
          },
          create: {
            userId: dbUser.id,
            experienceYear: data.experienceYear,
            hourlyRate: data.hourlyRate,
            salary: scale?.salary || null,
            isHourlyWage: false,
            notes: data.notes || null
          }
        })
        compensationCount++
      }
    }

    return NextResponse.json({
      success: true,
      scalesCount: scaleResults.length,
      compensationsCount: compensationCount
    })
  } catch (error) {
    console.error('Error seeding salary scales:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
