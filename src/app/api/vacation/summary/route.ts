import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultVacationDays } from '@/lib/config'
import { normalizeVerlofType } from '@/lib/verlof-types'
import { verlofKey, recurringTakenThisYear } from '@/lib/recurring-leave'

// Transform DB parental leave (uren/dagen) to frontend format (weken)
function transformParentalLeaveForFrontend(leave: any) {
  return {
    id: leave.id,
    userId: leave.userId,
    betaaldTotaalWeken: Math.round((leave.betaaldTotaalUren / 36) * 10) / 10,
    betaaldOpgenomenWeken: Math.round((leave.betaaldOpgenomenUren / 36) * 10) / 10,
    onbetaaldTotaalWeken: Math.round((leave.onbetaaldTotaalDagen / 5) * 10) / 10,
    onbetaaldOpgenomenWeken: Math.round((leave.onbetaaldOpgenomenDagen / 5) * 10) / 10,
    kindNaam: leave.kindNaam,
    kindGeboorteDatum: leave.kindGeboorteDatum,
    startDatum: leave.betaaldVerlofEinddatum,
    eindDatum: leave.onbetaaldVerlofEinddatum,
    note: leave.note,
    user: leave.user,
  }
}

// GET - Fetch all vacation page data in one bundled API call
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const userId = session.user.id
    const currentYear = new Date().getFullYear()

    // Get current user to check role
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'OFFICE_MANAGER'

    // Fetch all data in parallel using Promise.all
    const [
      vacations,
      teamMembers,
      vacationBalances,
      allParentalLeaves,
      myParentalLeave,
      myVacationBalance,
      vacationPeriods,
      myVacationPeriods,
    ] = await Promise.all([
      // 1. All approved vacation requests
      prisma.vacationRequest.findMany({
        where: {
          status: 'APPROVED',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),

      // 2. All active team members
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          werkdagen: true,
        },
        orderBy: { name: 'asc' },
      }),

      // 3. Vacation balances (all users, for admins)
      isAdmin
        ? prisma.vacationBalance.findMany({
            where: { year: currentYear },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          })
        : [],

      // 4. All parental leaves (for admins)
      isAdmin
        ? prisma.parentalLeave.findMany({
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ userId: 'asc' }, { childNumber: 'asc' }],
          })
        : [],

      // 5. Current user's parental leave
      prisma.parentalLeave.findMany({
        where: { userId },
        orderBy: { childNumber: 'asc' },
      }),

      // 6. Current user's vacation balance
      prisma.vacationBalance.findFirst({
        where: {
          userId,
          year: currentYear,
        },
      }),

      // 7. All vacation periods — alle ingelogde gebruikers mogen 'm zien
      //    voor planning (was eerst isAdmin-gated).
      prisma.vacationPeriod.findMany({
        where: { year: currentYear },
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
      }),

      // 8. Current user's vacation periods
      prisma.vacationPeriod.findMany({
        where: {
          userId,
          year: currentYear,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      }),
    ])

    // ─── Eén bron van waarheid ───
    // Kalender, Overzicht én "opgenomen" komen uit dezelfde gecombineerde lijst:
    //   • goedgekeurde vakantie-aanvragen (medewerkers) — leidend, incl. type
    //   • partner-periodes (VacationPeriod) — puur voor de agenda/overzicht
    // Ontdubbeld: een periode die overlapt met een goedgekeurde aanvraag van
    // dezelfde persoon is dezelfde vakantie → telt maar één keer.
    const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS <= bE && bS <= aE

    const requestItems = vacations.map((r: any) => ({
      id: r.id,
      source: 'request' as const,
      userId: r.userId,
      user: r.user,
      startDate: r.startDate,
      endDate: r.endDate,
      days: r.days,
      reason: r.reason ?? null,
      note: r.reason ?? null,
      type: r.type || 'vakantie',
      childNumber: r.childNumber ?? null,
      status: 'APPROVED' as const,
      werkdagen: '1,2,3,4,5',
      createdBy: null,
    }))

    const periodItems = (vacationPeriods as any[])
      .filter(p => !vacations.some((r: any) => r.userId === p.userId && overlaps(p.startDate, p.endDate, r.startDate, r.endDate)))
      .map(p => ({
        id: p.id,
        source: 'period' as const,
        userId: p.userId,
        user: p.user,
        startDate: p.startDate,
        endDate: p.endDate,
        days: p.days,
        reason: p.note ?? null,
        note: p.note ?? null,
        type: 'vakantie' as const,
        childNumber: null as number | null,
        status: 'APPROVED' as const,
        werkdagen: p.werkdagen,
        createdBy: p.createdBy ?? null,
      }))

    const combined = [...requestItems, ...periodItems]

    // Opgenomen (saldo) = som van 'vakantie'-dagen. Alle andere types zijn
    // verlof dat apart geteld wordt en NIET van het vakantiesaldo afgaat.
    const round1 = (n: number) => Math.round(n * 10) / 10
    const takenByUser = new Map<string, number>()
    const verlofByUser = new Map<string, Record<string, number>>() // userId -> { verlofKey: dagen }
    const addVerlof = (uid: string, key: string, days: number) => {
      const rec = verlofByUser.get(uid) || {}
      rec[key] = round1((rec[key] || 0) + days)
      verlofByUser.set(uid, rec)
    }
    for (const c of combined) {
      const t = normalizeVerlofType(c.type)
      if (t === 'vakantie') {
        takenByUser.set(c.userId, round1((takenByUser.get(c.userId) || 0) + c.days))
      } else {
        addVerlof(c.userId, verlofKey(t, c.childNumber), c.days)
      }
    }

    // Terugkerende vaste verlofdagen — occurrences dit jaar t/m vandaag meetellen.
    const recurringRules = await prisma.recurringLeave.findMany()
    const nowD = new Date()
    for (const r of recurringRules) {
      const t = normalizeVerlofType(r.type)
      const taken = recurringTakenThisYear(r as any, currentYear, nowD)
      if (taken > 0) {
        if (t === 'vakantie') takenByUser.set(r.userId, round1((takenByUser.get(r.userId) || 0) + taken))
        else addVerlof(r.userId, verlofKey(t, r.childNumber), taken)
      }
    }
    const verlofOf = (uid: string): Record<string, number> => verlofByUser.get(uid) || {}

    // Regels voor de subtiele kalender-markering (met naam erbij).
    const nameById = new Map((teamMembers as any[]).map(m => [m.id, m.name]))
    const recurringForCalendar = recurringRules.map(r => ({
      id: r.id, userId: r.userId, userName: nameById.get(r.userId) || '',
      type: r.type, weekday: r.weekday, childNumber: r.childNumber,
      startDate: r.startDate, endDate: r.endDate, dayValue: r.dayValue,
    }))

    // Format vacation balances — opgenomen automatisch afgeleid, tenzij Hanna
    // een noodgeval-override heeft gezet (opgenomenOverride).
    const formattedBalances = vacationBalances.map((b: any) => {
      const derived = takenByUser.get(b.userId) || 0
      const opgenomen = b.opgenomenOverride ?? derived
      return {
        userId: b.userId,
        personName: b.user?.name || 'Onbekend',
        overgedragenVorigJaar: b.overgedragenVorigJaar,
        opbouwLopendJaar: b.opbouwLopendJaar,
        bijgekocht: b.bijgekocht,
        opgenomenLopendJaar: opgenomen,
        opgenomenAuto: derived,
        opgenomenOverride: b.opgenomenOverride ?? null,
        onbetaaldDagen: verlofOf(b.userId).onbetaald || 0,
        verlof: verlofOf(b.userId),
        note: b.note,
        isPartner: b.user?.role === 'PARTNER',
      }
    })

    // Format my vacation balance — zelfde afleiding
    const isPartner = currentUser?.role === 'PARTNER'
    const defaultOpbouw = getDefaultVacationDays(currentUser?.role || 'EMPLOYEE')

    const myDerived = takenByUser.get(userId) || 0
    const myVacationBalanceFormatted = myVacationBalance
      ? {
          year: myVacationBalance.year,
          overgedragenVorigJaar: myVacationBalance.overgedragenVorigJaar,
          opbouwLopendJaar: myVacationBalance.opbouwLopendJaar,
          bijgekocht: myVacationBalance.bijgekocht,
          opgenomenLopendJaar: (myVacationBalance as any).opgenomenOverride ?? myDerived,
          onbetaaldDagen: verlofOf(userId).onbetaald || 0,
          verlof: verlofOf(userId),
          totaalDagen:
            myVacationBalance.overgedragenVorigJaar +
            myVacationBalance.opbouwLopendJaar +
            myVacationBalance.bijgekocht,
          resterend:
            myVacationBalance.overgedragenVorigJaar +
            myVacationBalance.opbouwLopendJaar +
            myVacationBalance.bijgekocht -
            ((myVacationBalance as any).opgenomenOverride ?? myDerived),
          isPartner,
        }
      : {
          year: currentYear,
          overgedragenVorigJaar: 0,
          opbouwLopendJaar: defaultOpbouw,
          bijgekocht: 0,
          opgenomenLopendJaar: myDerived,
          onbetaaldDagen: verlofOf(userId).onbetaald || 0,
          verlof: verlofOf(userId),
          totaalDagen: defaultOpbouw,
          resterend: defaultOpbouw - myDerived,
          isPartner,
        }

    // Kalender-grid gebruikt 'vacations' (nu de gecombineerde lijst) en het
    // Overzicht gebruikt 'vacationPeriods' — beide uit dezelfde bron, dus gelijk.
    const myCombined = combined.filter(c => c.userId === userId)

    return NextResponse.json({
      vacations: combined,
      teamMembers,
      vacationBalances: formattedBalances,
      allParentalLeaves: (allParentalLeaves as any[]).map(transformParentalLeaveForFrontend),
      myParentalLeave: myParentalLeave.length > 0 ? transformParentalLeaveForFrontend(myParentalLeave[0] as any) : null,
      myVacationBalance: isPartner ? null : myVacationBalanceFormatted,
      vacationPeriods: combined,
      myVacationPeriods: myCombined,
      recurringLeaves: recurringForCalendar,
      currentUser,
      isAdmin,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching vacation summary:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen vacation summary' },
      { status: 500 }
    )
  }
}
