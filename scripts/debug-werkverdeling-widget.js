const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // 1. Haal meest recente meetingWeeks op
  const weeks = await prisma.meetingWeek.findMany({
    orderBy: { meetingDate: 'desc' },
    take: 5,
    include: { distributions: true },
  })

  console.log('\n=== RECENTE MEETING WEEKS ===')
  for (const w of weeks) {
    console.log(`\nWeek: ${w.id}`)
    console.log(`  meetingDate: ${w.meetingDate.toISOString()} (${w.dateLabel})`)
    console.log(`  Distributions:`)
    for (const d of w.distributions) {
      console.log(`    ${d.partnerName}: employeeName="${d.employeeName || '(leeg)'}" employeeId="${d.employeeId || '(null)'}"`)
    }
  }

  // 2. Check de date range die de widget zou gebruiken
  const now = new Date()
  const twoWeeksAgo = new Date(now)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 10)
  twoWeeksAgo.setUTCHours(0, 0, 0, 0)
  const twoWeeksAhead = new Date(now)
  twoWeeksAhead.setDate(twoWeeksAhead.getDate() + 8)
  twoWeeksAhead.setUTCHours(23, 59, 59, 999)

  console.log(`\n=== DATE RANGE CHECK ===`)
  console.log(`Now: ${now.toISOString()}`)
  console.log(`Range: ${twoWeeksAgo.toISOString()} - ${twoWeeksAhead.toISOString()}`)

  const found = await prisma.meetingWeek.findFirst({
    where: { meetingDate: { gte: twoWeeksAgo, lte: twoWeeksAhead } },
    include: { distributions: true },
    orderBy: { meetingDate: 'desc' },
  })

  if (found) {
    console.log(`\nGevonden week: ${found.id} (${found.dateLabel})`)
    console.log(`meetingDate: ${found.meetingDate.toISOString()}`)
    for (const d of found.distributions) {
      console.log(`  ${d.partnerName}: "${d.employeeName || '(leeg)'}"`)
    }
  } else {
    console.log('\n!! GEEN WEEK GEVONDEN IN RANGE !!')
  }

  // 3. Check Jochem's user
  const jochem = await prisma.user.findFirst({
    where: { name: { contains: 'Jochem' } },
    select: { id: true, name: true, role: true },
  })
  console.log(`\n=== USER CHECK ===`)
  console.log(`Jochem: ${JSON.stringify(jochem)}`)

  await prisma.$disconnect()
}

main().catch(console.error)
