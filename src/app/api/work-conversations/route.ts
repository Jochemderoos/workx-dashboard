import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendDirectMessage } from '@/lib/slack'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    // Selectie: ALLE MeetingWeek-records, chronologisch.
    // Geen filter — zo blijven historische gesprekken altijd zichtbaar.
    // De pagina kiest standaard de eerstvolgende toekomstige vergadering
    // als actieve tab.
    const weeks = await prisma.meetingWeek.findMany({
      orderBy: { meetingDate: 'asc' },
      include: { distributions: true, conversations: true },
    })

    // Haal alle actieve medewerkers op
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
    })

    return NextResponse.json({ weeks, employees })
  } catch (error) {
    console.error('Error fetching work conversations:', error)
    return NextResponse.json(
      { error: 'Kon gesprekken niet ophalen' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }
    if (!['PARTNER', 'ADMIN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { weekId, employeeId, employeeName, partnerName, capacity, notes } = await req.json()

    if (!weekId || !employeeId || !employeeName || !partnerName) {
      return NextResponse.json(
        { error: 'weekId, employeeId, employeeName en partnerName zijn verplicht' },
        { status: 400 }
      )
    }

    // Detecteer of partner-toewijzing wijzigt (voor Slack DM)
    const previous = await prisma.workConversation.findUnique({
      where: { weekId_employeeId: { weekId, employeeId } },
      select: { partnerName: true },
    })
    const previousAssigned = previous?.partnerName && previous.partnerName !== '-' ? previous.partnerName : null
    const newAssigned = partnerName && partnerName !== '-' ? partnerName : null

    const conversation = await prisma.workConversation.upsert({
      where: {
        weekId_employeeId: { weekId, employeeId },
      },
      create: {
        weekId,
        employeeId,
        employeeName,
        partnerName,
        capacity: capacity || null,
        notes: notes || null,
      },
      update: {
        partnerName,
        capacity: capacity || null,
        notes: notes || null,
      },
    })

    // Slack DM naar medewerker bij nieuwe / gewijzigde partner-toewijzing
    if (newAssigned && newAssigned !== previousAssigned) {
      void (async () => {
        try {
          const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { email: true, name: true },
          })
          if (!employee?.email) return
          const base = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
          const url = `${base}/dashboard`
          const blocks = [
            {
              type: 'rich_text',
              elements: [
                {
                  type: 'rich_text_section',
                  elements: [
                    { type: 'text', text: 'Werkverdelingsgesprek deze week\n', style: { bold: true } },
                    { type: 'text', text: `Je hebt deze week een werkverdelingsgesprek met ${newAssigned}. Plan het samen in.\n→ ` },
                    { type: 'link', url, text: 'Open dashboard' },
                  ],
                },
              ],
            },
          ]
          await sendDirectMessage(
            employee.email,
            `Werkverdelingsgesprek deze week met ${newAssigned}. ${url}`,
            blocks as any
          )
        } catch (err) {
          console.error('Slack DM voor werkverdelingsgesprek mislukt (non-blocking):', err)
        }
      })()
    }

    return NextResponse.json(conversation)
  } catch (error) {
    console.error('Error saving work conversation:', error)
    return NextResponse.json(
      { error: 'Kon gesprek niet opslaan' },
      { status: 500 }
    )
  }
}
