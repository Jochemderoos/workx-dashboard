// Office-aanwezigheid API.
// GET → entries + phone-days voor [startDate..endDate].
// Iedereen mag lezen; bewerken via /api/office/attendance en /api/office/phone.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const start = parseDate(url.searchParams.get('startDate'))
    const end = parseDate(url.searchParams.get('endDate'))
    if (!start || !end) {
      return NextResponse.json({ error: 'startDate en endDate verplicht (YYYY-MM-DD)' }, { status: 400 })
    }

    const entries = await prisma.officeAttendanceEntry.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    })
    const phoneDays = await prisma.officePhoneDay.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    })

    return NextResponse.json({ entries, phoneDays })
  } catch (error) {
    console.error('Error loading office data:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
