/**
 * Audit script: check vacation balance consistency for all users
 * Vergelijkt opgenomenLopendJaar met de werkelijke som van goedgekeurde aanvragen + periodes
 *
 * Usage: node scripts/audit-vacation-balances.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function audit() {
  const currentYear = new Date().getFullYear()

  // Get all users with vacation balances
  const balances = await prisma.vacationBalance.findMany({
    where: { year: currentYear },
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  console.log(`\n=== VAKANTIESALDO AUDIT ${currentYear} ===\n`)

  for (const balance of balances) {
    const userId = balance.userId
    const userName = balance.user?.name || 'Onbekend'

    // Sum of approved vacation requests for this year
    const approvedRequests = await prisma.vacationRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        startDate: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1),
        },
      },
      select: { id: true, days: true, startDate: true, endDate: true },
    })
    const requestDaysTotal = approvedRequests.reduce((sum, r) => sum + r.days, 0)

    // Sum of vacation periods for this year
    const periods = await prisma.vacationPeriod.findMany({
      where: { userId, year: currentYear },
      select: { id: true, days: true, startDate: true, endDate: true },
    })
    const periodDaysTotal = periods.reduce((sum, p) => sum + p.days, 0)

    // Check for overlapping requests + periods (potential double-counts)
    const overlaps = []
    for (const req of approvedRequests) {
      for (const period of periods) {
        const reqStart = new Date(req.startDate).getTime()
        const reqEnd = new Date(req.endDate).getTime()
        const perStart = new Date(period.startDate).getTime()
        const perEnd = new Date(period.endDate).getTime()
        if (reqStart <= perEnd && reqEnd >= perStart) {
          overlaps.push({
            requestId: req.id,
            requestDays: req.days,
            periodId: period.id,
            periodDays: period.days,
          })
        }
      }
    }

    const balanceValue = balance.opgenomenLopendJaar
    const totaal = balance.overgedragenVorigJaar + balance.opbouwLopendJaar + (balance.bijgekocht || 0)
    const resterend = totaal - balanceValue

    // Flag inconsistencies
    const hasOverlap = overlaps.length > 0
    const flag = hasOverlap ? ' ⚠️  DUBBELTELLING' : ''

    console.log(`--- ${userName} ---${flag}`)
    console.log(`  Saldo: ${totaal} totaal, ${balanceValue} opgenomen, ${resterend} resterend`)
    console.log(`  Goedgekeurde aanvragen: ${approvedRequests.length} (${requestDaysTotal} dagen)`)
    console.log(`  Vakantieperiodes: ${periods.length} (${periodDaysTotal} dagen)`)

    if (hasOverlap) {
      console.log(`  ⚠️  OVERLAP gevonden (${overlaps.length}x):`)
      for (const o of overlaps) {
        console.log(`     Request ${o.requestId.slice(0,8)}... (${o.requestDays}d) <-> Period ${o.periodId.slice(0,8)}... (${o.periodDays}d)`)
      }
      console.log(`  ➡️  Verwacht opgenomen: ${requestDaysTotal} (alleen requests), maar staat op: ${balanceValue}`)
      if (balanceValue === requestDaysTotal + periodDaysTotal) {
        console.log(`  ✅ Bevestigd: dubbeltelling! Saldo is som van requests + periodes`)
        console.log(`  ➡️  Correcte waarde zou moeten zijn: ${requestDaysTotal}`)
      }
    }

    // List all requests
    if (approvedRequests.length > 0) {
      console.log(`  Aanvragen:`)
      for (const r of approvedRequests) {
        const start = new Date(r.startDate).toLocaleDateString('nl-NL')
        const end = new Date(r.endDate).toLocaleDateString('nl-NL')
        console.log(`    - ${start} t/m ${end}: ${r.days} dagen`)
      }
    }

    // List all periods
    if (periods.length > 0) {
      console.log(`  Periodes:`)
      for (const p of periods) {
        const start = new Date(p.startDate).toLocaleDateString('nl-NL')
        const end = new Date(p.endDate).toLocaleDateString('nl-NL')
        console.log(`    - ${start} t/m ${end}: ${p.days} dagen`)
      }
    }

    console.log()
  }

  await prisma.$disconnect()
}

audit().catch(console.error)
