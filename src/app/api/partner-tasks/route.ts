import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requirePartnerOrAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session, user }
}

// GET - hoofdstukken + taken (met assignments) + team
export async function GET() {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const [chapters, teamMembers] = await Promise.all([
      prisma.partnerTaskChapter.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          tasks: {
            orderBy: { sortOrder: 'asc' },
            include: {
              assignments: {
                include: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, avatarUrl: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ])
    return NextResponse.json({ chapters, teamMembers })
  } catch (error) {
    console.error('Error fetching partner tasks:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - nieuwe taak toevoegen
export async function POST(req: NextRequest) {
  const guard = await requirePartnerOrAdmin()
  if (guard.error) return guard.error
  try {
    const { chapterId, task, responsibleId } = await req.json()
    if (!chapterId || !task) {
      return NextResponse.json({ error: 'chapterId en task zijn verplicht' }, { status: 400 })
    }
    const maxSort = await prisma.partnerTask.aggregate({ where: { chapterId }, _max: { sortOrder: true } })
    const created = await prisma.partnerTask.create({
      data: {
        chapterId,
        task,
        responsibleId: responsibleId || null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        assignments: responsibleId ? { create: [{ userId: responsibleId }] } : undefined,
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating partner task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
