// GET en PUT voor de Workx-jaaragenda. Eén record per jaar.
// Iedereen kan lezen; partners/admins kunnen schrijven.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function canEdit(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

const EMPTY_GOALS = '[]'
const EMPTY_MONTHS = '{}'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear() + 1), 10)

  try {
    let agenda = await prisma.yearAgenda.findUnique({ where: { year } })
    if (!agenda) {
      agenda = await prisma.yearAgenda.create({
        data: { year, goals: EMPTY_GOALS, months: EMPTY_MONTHS },
      })
    }
    return NextResponse.json(agenda)
  } catch (err) {
    console.error('year-agenda GET failed', err)
    return NextResponse.json({ error: 'Kon agenda niet ophalen' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!canEdit(me?.role)) {
    return NextResponse.json({ error: 'Alleen partners/admins mogen de jaaragenda wijzigen' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const year = parseInt(body.year, 10)
    if (!year || year < 2020 || year > 2099) {
      return NextResponse.json({ error: 'Ongeldig jaar' }, { status: 400 })
    }

    // Valideer JSON-strings (parse + serialize zodat we zeker weten dat het werkt)
    const goalsStr = typeof body.goals === 'string'
      ? body.goals
      : JSON.stringify(body.goals ?? [])
    const monthsStr = typeof body.months === 'string'
      ? body.months
      : JSON.stringify(body.months ?? {})
    try { JSON.parse(goalsStr); JSON.parse(monthsStr) } catch {
      return NextResponse.json({ error: 'Ongeldige JSON in goals/months' }, { status: 400 })
    }

    const theme = typeof body.theme === 'string' ? body.theme.trim() || null : undefined

    const updated = await prisma.yearAgenda.upsert({
      where: { year },
      update: {
        ...(body.goals !== undefined && { goals: goalsStr }),
        ...(body.months !== undefined && { months: monthsStr }),
        ...(theme !== undefined && { theme }),
      },
      create: {
        year,
        goals: body.goals !== undefined ? goalsStr : EMPTY_GOALS,
        months: body.months !== undefined ? monthsStr : EMPTY_MONTHS,
        theme: theme ?? null,
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('year-agenda PUT failed', err)
    return NextResponse.json({ error: 'Kon agenda niet opslaan' }, { status: 500 })
  }
}
