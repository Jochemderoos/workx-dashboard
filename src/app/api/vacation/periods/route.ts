import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateVacationDays, parseWerkdagen, DEFAULT_WERKDAGEN_STRING } from '@/lib/vacation-utils'

/**
 * Parse a date string to a Date object, ensuring we get the correct local date
 * regardless of timezone. This handles both ISO strings and date-only strings.
 */
function parseLocalDate(dateStr: string | Date): Date {
  if (dateStr instanceof Date) {
    // If it's already a Date, normalize it to midnight local time
    return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate())
  }

  // If it's an ISO string like "2026-03-18T23:00:00.000Z", extract the date part
  // accounting for potential timezone shifts
  const date = new Date(dateStr)

  // Check if this looks like a UTC midnight that should be the next day in local time
  // or if we should just use the date components directly
  if (dateStr.includes('T')) {
    // ISO string - use UTC date components to avoid timezone issues
    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  }

  // Date-only string like "2026-03-18" - parse directly
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

// GET - Fetch vacation periods for a user/year
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || session.user.id
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    // Check if user has admin permissions to view other users' periods
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    // Non-admins can only view their own periods
    if (!isAdmin && userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const periods = await prisma.vacationPeriod.findMany({
      where: {
        userId,
        year,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    })

    return NextResponse.json(periods)
  } catch (error) {
    console.error('Error fetching vacation periods:', error)
    return NextResponse.json({ error: 'Kon niet ophalen vacation periods' }, { status: 500 })
  }
}

// POST - Create a new vacation period
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { userId, startDate, endDate, werkdagen, note } = body

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - only admins can create periods' }, { status: 403 })
    }

    if (!userId || !startDate || !endDate) {
      return NextResponse.json({ error: 'userId, startDate, and endDate are required' }, { status: 400 })
    }

    // Parse dates properly to avoid timezone issues
    const start = parseLocalDate(startDate)
    const end = parseLocalDate(endDate)
    const year = start.getFullYear()

    // Parse werkdagen
    const werkdagenArray = werkdagen ? parseWerkdagen(werkdagen) : parseWerkdagen(DEFAULT_WERKDAGEN_STRING)
    const werkdagenStr = werkdagen || DEFAULT_WERKDAGEN_STRING

    // Calculate vacation days
    const days = calculateVacationDays(start, end, werkdagenArray)

    // Get or create vacation balance for this user/year
    let balance = await prisma.vacationBalance.findFirst({
      where: { userId, year },
    })

    if (!balance) {
      // Create a new balance for this user/year
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
      const isPartner = user?.role === 'PARTNER'

      balance = await prisma.vacationBalance.create({
        data: {
          userId,
          year,
          overgedragenVorigJaar: 0,
          opbouwLopendJaar: isPartner ? 0 : 25,
          bijgekocht: 0,
          opgenomenLopendJaar: 0,
          updatedById: session.user.id,
        },
      })
    }

    // Create the vacation period
    const period = await prisma.vacationPeriod.create({
      data: {
        userId,
        balanceId: balance.id,
        year,
        startDate: start,
        endDate: end,
        werkdagen: werkdagenStr,
        days,
        note,
        createdById: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Update the vacation balance
    await prisma.vacationBalance.update({
      where: { id: balance.id },
      data: {
        opgenomenLopendJaar: balance.opgenomenLopendJaar + days,
        updatedById: session.user.id,
      },
    })

    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    console.error('Error creating vacation period:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken vacation period' }, { status: 500 })
  }
}

// PATCH - Update a vacation period
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { id, startDate, endDate, werkdagen, note } = body

    if (!id) {
      return NextResponse.json({ error: 'Period id is verplicht' }, { status: 400 })
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - only admins can update periods' }, { status: 403 })
    }

    // Get existing period
    const existingPeriod = await prisma.vacationPeriod.findUnique({
      where: { id },
      include: { balance: true },
    })

    if (!existingPeriod) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    // Calculate new days if dates or werkdagen changed
    // Parse dates properly to avoid timezone issues
    const newStart = startDate ? parseLocalDate(startDate) : parseLocalDate(existingPeriod.startDate)
    const newEnd = endDate ? parseLocalDate(endDate) : parseLocalDate(existingPeriod.endDate)
    const newWerkdagenStr = werkdagen || existingPeriod.werkdagen
    const newWerkdagenArray = parseWerkdagen(newWerkdagenStr)
    const newDays = calculateVacationDays(newStart, newEnd, newWerkdagenArray)

    // Calculate difference for balance update
    const daysDiff = newDays - existingPeriod.days

    // Update the period
    const updatedPeriod = await prisma.vacationPeriod.update({
      where: { id },
      data: {
        startDate: newStart,
        endDate: newEnd,
        werkdagen: newWerkdagenStr,
        days: newDays,
        note: note !== undefined ? note : existingPeriod.note,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Update the vacation balance if days changed
    if (daysDiff !== 0) {
      await prisma.vacationBalance.update({
        where: { id: existingPeriod.balanceId },
        data: {
          opgenomenLopendJaar: existingPeriod.balance.opgenomenLopendJaar + daysDiff,
          updatedById: session.user.id,
        },
      })
    }

    return NextResponse.json(updatedPeriod)
  } catch (error) {
    console.error('Error updating vacation period:', error)
    return NextResponse.json({ error: 'Kon niet bijwerken vacation period' }, { status: 500 })
  }
}

// DELETE - Remove a vacation period
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Period id is verplicht' }, { status: 400 })
    }

    // Check if user has admin permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden - only admins can delete periods' }, { status: 403 })
    }

    // Get existing period to calculate balance adjustment
    const period = await prisma.vacationPeriod.findUnique({
      where: { id },
      include: { balance: true },
    })

    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }

    // Delete the period
    await prisma.vacationPeriod.delete({
      where: { id },
    })

    // Update the vacation balance (subtract the days)
    await prisma.vacationBalance.update({
      where: { id: period.balanceId },
      data: {
        opgenomenLopendJaar: Math.max(0, period.balance.opgenomenLopendJaar - period.days),
        updatedById: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vacation period:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen vacation period' }, { status: 500 })
  }
}
