/**
 * Fix script: herbereken alle vakantiesaldo's op basis van goedgekeurde aanvragen
 * Corrigeert de dubbeltelling die ontstond door zowel requests als periodes het saldo te laten aanpassen
 *
 * Usage: node scripts/fix-vacation-balances.js
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fix() {
  const currentYear = new Date().getFullYear()

  const balances = await prisma.vacationBalance.findMany({
    where: { year: currentYear },
    include: {
      user: { select: { id: true, name: true } },
    },
  })

  console.log(`\n=== VAKANTIESALDO CORRECTIE ${currentYear} ===\n`)

  let fixCount = 0

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
      select: { days: true },
    })
    const correctDays = approvedRequests.reduce((sum, r) => sum + r.days, 0)
    const currentDays = balance.opgenomenLopendJaar

    if (Math.abs(currentDays - correctDays) > 0.01) {
      const diff = currentDays - correctDays
      console.log(`${userName}: ${currentDays} → ${correctDays} (verschil: ${diff > 0 ? '+' : ''}${diff})`)

      await prisma.vacationBalance.update({
        where: { id: balance.id },
        data: { opgenomenLopendJaar: correctDays },
      })

      fixCount++
    } else {
      console.log(`${userName}: ${currentDays} ✓ (correct)`)
    }
  }

  console.log(`\n${fixCount} saldo's gecorrigeerd.\n`)

  await prisma.$disconnect()
}

fix().catch(console.error)
