import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBeforeReveal, RECRUITMENT_REVEAL_AT } from '@/lib/recruitment-config'
import { sendChannelMessage } from '@/lib/slack'

// GET — geeft:
// - eigen entry (altijd)
// - alle entries (na reveal OF voor PARTNER/ADMIN)
// - lijst van actieve teamleden voor partner-overzicht
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const userId = session.user.id
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  })
  if (!me) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  const isManager = me.role === 'PARTNER' || me.role === 'ADMIN'
  const canSeeAll = isManager || !isBeforeReveal()

  // Eigen entry
  const ownEntry = await prisma.recruitmentEntry.findUnique({
    where: { userId },
    include: { candidates: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
  })

  // Alle entries (alleen voor wie 't mag zien)
  let allEntries: any[] = []
  let activeUsers: any[] = []
  if (canSeeAll) {
    allEntries = await prisma.recruitmentEntry.findMany({
      include: {
        user: { select: { id: true, name: true, role: true, avatarUrl: true } },
        candidates: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] },
      },
      orderBy: { updatedAt: 'desc' },
    })
    // De historische lijst ('Eerdere ronde') is alleen voor partners + Hanna.
    if (!isManager) {
      allEntries = allEntries.filter((e: any) => e.user?.name !== 'Eerdere ronde')
    }
    // Het overzicht 'wie heeft wat ingevuld' gaat over onze advocaten —
    // partners + office (Hanna, Lotte, Bente, Diyar) excluderen, want
    // het hoort niet bij hun rol om dit lijstje in te vullen.
    const OFFICE_NAMES = ['Hanna Blaauboer', 'Lotte van Sint Truiden', 'Bente Karels', 'Diyar Wakkas']
    activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        role: 'EMPLOYEE',
        name: { notIn: OFFICE_NAMES },
      },
      select: { id: true, name: true, role: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    })
  }

  return NextResponse.json({
    currentUser: me,
    revealAt: RECRUITMENT_REVEAL_AT.toISOString(),
    isBeforeReveal: isBeforeReveal(),
    canSeeAll,
    ownEntry,
    allEntries,
    activeUsers,
  })
}

// POST — upsert eigen entry + candidates (vervangt de hele candidate-set)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const userId = session.user.id

  const body = await req.json()
  const {
    visibilityIdeas,
    willPostHimself,
    postingFormat,
    candidates = [],
  } = body as {
    visibilityIdeas?: string | null
    willPostHimself?: string | null
    postingFormat?: string | null
    candidates?: Array<{
      type: 'candidate' | 'ambassador'
      name: string
      experienceYear?: number | null
      currentOffice?: string | null
      linkedinUrl?: string | null
      inNetwork?: boolean
      notes?: string | null
      sortOrder?: number
    }>
  }

  // Upsert entry
  const entry = await prisma.recruitmentEntry.upsert({
    where: { userId },
    create: {
      userId,
      visibilityIdeas: visibilityIdeas ?? null,
      willPostHimself: willPostHimself ?? null,
      postingFormat: postingFormat ?? null,
      submittedAt: new Date(),
    },
    update: {
      visibilityIdeas: visibilityIdeas ?? null,
      willPostHimself: willPostHimself ?? null,
      postingFormat: postingFormat ?? null,
      submittedAt: new Date(),
    },
  })

  // Sync candidates — eenvoudige strategie: delete alle bestaande, insert opnieuw.
  // Approach-metadata van partners blijft alleen behouden als ze niet de eigen
  // entry betreffen. Voor de eigen entry geldt: medewerker bewerkt zelf, dus
  // approach-velden komen uit een aparte PATCH endpoint.
  // We mergen handig op naam+type om approach-data te behouden.
  const existing = await prisma.recruitmentCandidate.findMany({
    where: { entryId: entry.id },
  })
  const keyOf = (c: { type: string; name: string }) => `${c.type}|${c.name.trim().toLowerCase()}`
  const existingByKey = new Map(existing.map(c => [keyOf(c), c]))

  // Verwijder die niet meer in body zitten
  const newKeys = new Set(candidates.map(c => keyOf(c)))
  const toDelete = existing.filter(c => !newKeys.has(keyOf(c)))
  if (toDelete.length > 0) {
    await prisma.recruitmentCandidate.deleteMany({
      where: { id: { in: toDelete.map(c => c.id) } },
    })
  }

  // Upsert per kandidaat — houd nieuwe (post-reveal) bij voor Slack-notificatie
  const newlyAddedAfterReveal: { type: string; name: string; experienceYear: number | null; currentOffice: string | null }[] = []
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    if (!c.name?.trim()) continue
    const k = keyOf(c)
    const existingC = existingByKey.get(k)
    if (existingC) {
      // Update — bewaar approach-metadata
      await prisma.recruitmentCandidate.update({
        where: { id: existingC.id },
        data: {
          experienceYear: c.experienceYear ?? null,
          currentOffice: c.currentOffice ?? null,
          linkedinUrl: c.linkedinUrl ?? null,
          inNetwork: c.inNetwork ?? false,
          notes: c.notes ?? null,
          sortOrder: c.sortOrder ?? i,
        },
      })
    } else {
      await prisma.recruitmentCandidate.create({
        data: {
          entryId: entry.id,
          type: c.type,
          name: c.name.trim(),
          experienceYear: c.experienceYear ?? null,
          currentOffice: c.currentOffice ?? null,
          linkedinUrl: c.linkedinUrl ?? null,
          inNetwork: c.inNetwork ?? false,
          notes: c.notes ?? null,
          sortOrder: c.sortOrder ?? i,
        },
      })
      if (!isBeforeReveal()) {
        newlyAddedAfterReveal.push({
          type: c.type,
          name: c.name.trim(),
          experienceYear: c.experienceYear ?? null,
          currentOffice: c.currentOffice ?? null,
        })
      }
    }
  }

  // Slack-notificatie naar #mt-groot bij post-reveal toevoegingen (non-blocking)
  if (newlyAddedAfterReveal.length > 0) {
    void (async () => {
      try {
        const me = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        })
        const firstName = me?.name?.split(' ')[0] || 'Iemand'
        const base = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
        const url = `${base}/dashboard/recruitment`
        const lines = newlyAddedAfterReveal.map((c) => {
          const label = c.type === 'ambassador' ? '🤝 Ambassadeur' : '👤 Kandidaat'
          const meta = [c.experienceYear ? `${c.experienceYear} jaar` : null, c.currentOffice].filter(Boolean).join(' · ')
          return meta ? `${label} ${c.name} (${meta})` : `${label} ${c.name}`
        })
        const blocks = [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: `Nieuwe recruitment-input van ${firstName}\n`, style: { bold: true } },
                  { type: 'text', text: lines.join('\n') + '\n→ ' },
                  { type: 'link', url, text: 'Open recruitment-overzicht' },
                ],
              },
            ],
          },
        ]
        const fallback = `${firstName} heeft ${newlyAddedAfterReveal.length} nieuwe ${newlyAddedAfterReveal.length === 1 ? 'naam' : 'namen'} toegevoegd aan recruitment — ${url}`
        await sendChannelMessage('mt-groot', fallback, blocks as any)
      } catch (err) {
        console.error('[recruitment] Slack-notificatie mislukt (non-blocking):', err)
      }
    })()
  }

  const updated = await prisma.recruitmentEntry.findUnique({
    where: { id: entry.id },
    include: { candidates: { orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] } },
  })

  return NextResponse.json(updated)
}
