import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - eigen taken + openstaande notulen-actiepunten waar de huidige
// gebruiker als verantwoordelijke is toebedeeld. Notulen-taken hebben
// source='meeting' en kunnen alleen worden afgevinkt (niet bewerkt of
// verwijderd) — dat gebeurt automatisch in de notulen-pagina.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const userId = session.user.id
    const userName = (session.user as { name?: string }).name || ''
    const role = (session.user as { role?: string }).role || ''
    const firstName = userName.split(' ')[0].trim().toLowerCase()

    // Partneroverleg-actiepunten zijn vertrouwelijk. Ze mogen ALLEEN zichtbaar
    // zijn voor partners/admins en Hanna (Head of Office) — ook hier in de
    // eigen-takenlijst. Andere medewerkers (incl. office zoals Lotte/Bente)
    // krijgen ze niet, ook niet als hun naam als verantwoordelijke is ingevuld.
    const canSeeMeetingActions =
      role === 'PARTNER' || role === 'ADMIN' || firstName === 'hanna'

    const personalTasks = await prisma.personalTask.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    // Notulen actiepunten waar de current user verantwoordelijke is.
    // responsibleName is een string, mogelijk komma-gescheiden ('Bas, Jochem').
    // Match op first name case-insensitive.
    let meetingTasks: Array<{
      id: string
      title: string
      description: string | null
      dueDate: string | null
      sortOrder: number
      createdAt: string
      source: 'meeting'
      meetingActionId: string
      meetingWeekId: string
      meetingMonthId: string
      meetingDateLabel: string
    }> = []
    if (firstName && canSeeMeetingActions) {
      try {
        const actions = await prisma.meetingAction.findMany({
          where: { isCompleted: false },
          include: {
            week: {
              select: { id: true, dateLabel: true, monthId: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        meetingTasks = actions
          .filter(a => {
            const names = a.responsibleName.split(',').map(s => s.trim().toLowerCase())
            return names.some(n => n === firstName || n.startsWith(firstName + ' ') || n.split(' ')[0] === firstName)
          })
          .map(a => ({
            id: `meeting-${a.id}`,
            title: a.description,
            description: null,
            dueDate: null,
            sortOrder: 0,
            createdAt: a.createdAt.toISOString(),
            source: 'meeting' as const,
            meetingActionId: a.id,
            meetingWeekId: a.weekId,
            meetingMonthId: a.week.monthId,
            meetingDateLabel: a.week.dateLabel,
          }))
      } catch (e) {
        // Tabel mogelijk nog niet aanwezig — silently overslaan
        console.warn('MeetingAction-query overgeslagen:', (e as Error)?.message)
      }
    }

    return NextResponse.json([...meetingTasks, ...personalTasks])
  } catch (error) {
    console.error('Error fetching personal tasks:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - nieuwe taak
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const { title, description, dueDate } = await req.json()
    if (!title?.trim()) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    const maxSort = await prisma.personalTask.aggregate({
      where: { userId: session.user.id },
      _max: { sortOrder: true },
    })
    const created = await prisma.personalTask.create({
      data: {
        userId: session.user.id,
        title: String(title).trim(),
        description: description?.trim() || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    })
    return NextResponse.json(created)
  } catch (error) {
    console.error('Error creating personal task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
