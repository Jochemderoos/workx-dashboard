// Syncen van Workx-uitje naar Agenda (CalendarEvent) en Jaaragenda
// (YearAgenda.months[N].milestones). Wordt aangeroepen vanuit de
// workx-outings API bij create/update/delete.

import { prisma } from '@/lib/prisma'

const TYPE_EMOJI: Record<string, string> = {
  'borrel-kantoor': '🍻',
  'borrel-elders': '🍹',
  'etentje': '🍝',
  'film': '🎬',
  'suppen': '🏄',
  'jeu-de-boules': '🎯',
  'opera': '🎭',
  'voorstelling': '🎤',
  'bowling': '🎳',
  'padel': '🎾',
  'bierfiets': '🍺',
  'rollerdisco': '🛼',
  'overig': '✨',
}

interface OutingPayload {
  id: string
  title: string
  type: string
  date: Date
  location: string | null
  description: string | null
  organizerId: string
  calendarEventId: string | null
}

// Werkt 2 uur als duur — voldoende voor de meeste uitjes.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

const JAARAGENDA_PREFIX = '🎉 Workx-uitje: '

export async function syncOutingToCalendar(outing: OutingPayload): Promise<string | null> {
  const emoji = TYPE_EMOJI[outing.type] || '✨'
  const eventTitle = `${emoji} ${outing.title}`
  const endTime = new Date(outing.date.getTime() + DEFAULT_DURATION_MS)
  const fullDescription = [
    `Workx-uitje (${outing.type.replace(/-/g, ' ')})`,
    outing.description || '',
    outing.location ? `Locatie: ${outing.location}` : '',
    '— ingeschreven worden kan via /dashboard/workx-uitjes',
  ].filter(Boolean).join('\n')

  if (outing.calendarEventId) {
    // Update bestaande event
    try {
      await prisma.calendarEvent.update({
        where: { id: outing.calendarEventId },
        data: {
          title: eventTitle,
          description: fullDescription,
          startTime: outing.date,
          endTime,
          location: outing.location,
        },
      })
      return outing.calendarEventId
    } catch {
      // Event bestaat niet meer (handmatig weg) — opnieuw aanmaken
    }
  }

  const created = await prisma.calendarEvent.create({
    data: {
      title: eventTitle,
      description: fullDescription,
      startTime: outing.date,
      endTime,
      location: outing.location,
      color: '#f9ff85', // workx-lime
      category: 'WORKX_UITJE',
      createdById: outing.organizerId,
    },
  })
  await prisma.workxOuting.update({
    where: { id: outing.id },
    data: { calendarEventId: created.id },
  })
  return created.id
}

export async function deleteCalendarEventForOuting(outing: { calendarEventId: string | null }): Promise<void> {
  if (!outing.calendarEventId) return
  try {
    await prisma.calendarEvent.delete({ where: { id: outing.calendarEventId } })
  } catch { /* silent — event was al weg */ }
}

interface MonthData {
  focus?: string
  plans?: string
  milestones?: string
}

// Voegt het uitje als regel toe aan YearAgenda.months[N].milestones.
// Idempotent: wist eerst bestaande regel met dezelfde prefix+title.
export async function syncOutingToYearAgenda(
  outing: { title: string; type: string; date: Date; location: string | null },
  previousTitle?: string
): Promise<void> {
  const year = outing.date.getFullYear()
  const month = outing.date.getMonth() + 1
  const emoji = TYPE_EMOJI[outing.type] || '✨'
  const dateLabel = outing.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
  const newLine = `${emoji} ${dateLabel} — ${outing.title}${outing.location ? ` (${outing.location})` : ''}`

  const removeMarker = `${JAARAGENDA_PREFIX}${previousTitle || outing.title}`

  const agenda = await prisma.yearAgenda.findUnique({ where: { year } })
  let monthsMap: Record<string, MonthData> = {}
  if (agenda) {
    try {
      const parsed = JSON.parse(agenda.months || '{}')
      if (parsed && typeof parsed === 'object') monthsMap = parsed
    } catch { /* fallthrough */ }
  }

  const current = monthsMap[String(month)] || {}
  const existingMilestones = (current.milestones || '').split('\n').filter(Boolean)
  // Verwijder oude regel van ditzelfde uitje (titel-match)
  const filtered = existingMilestones.filter(line =>
    !line.includes(outing.title) && !line.includes(previousTitle || '___none___')
  )
  filtered.push(newLine)

  const nextMonthData: MonthData = {
    ...current,
    milestones: filtered.join('\n'),
  }
  monthsMap[String(month)] = nextMonthData

  if (agenda) {
    await prisma.yearAgenda.update({
      where: { year },
      data: { months: JSON.stringify(monthsMap) },
    })
  } else {
    await prisma.yearAgenda.create({
      data: { year, months: JSON.stringify(monthsMap), goals: '[]' },
    })
  }
}

export async function removeOutingFromYearAgenda(outing: { title: string; date: Date }): Promise<void> {
  const year = outing.date.getFullYear()
  const month = outing.date.getMonth() + 1
  const agenda = await prisma.yearAgenda.findUnique({ where: { year } })
  if (!agenda) return
  let monthsMap: Record<string, MonthData> = {}
  try {
    const parsed = JSON.parse(agenda.months || '{}')
    if (parsed && typeof parsed === 'object') monthsMap = parsed
  } catch { return }

  const current = monthsMap[String(month)]
  if (!current?.milestones) return
  const filtered = current.milestones.split('\n').filter(line => !line.includes(outing.title))
  monthsMap[String(month)] = { ...current, milestones: filtered.join('\n') || undefined }

  await prisma.yearAgenda.update({
    where: { year },
    data: { months: JSON.stringify(monthsMap) },
  })
}
