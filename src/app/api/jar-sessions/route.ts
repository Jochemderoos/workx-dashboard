import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const where = yearParam ? { year: parseInt(yearParam, 10) } : {}
    const sessions = await prisma.jarSession.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    return NextResponse.json(sessions)
  } catch (error) {
    console.error('Error fetching JAR sessions:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (!body.date || !body.name) {
      return NextResponse.json({ error: 'date en name verplicht' }, { status: 400 })
    }
    const date = new Date(body.date)
    const created = await prisma.jarSession.create({
      data: {
        date,
        name: String(body.name).trim(),
        year: date.getFullYear(),
        notes: body.notes ? String(body.notes) : null,
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('Error creating JAR session:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
