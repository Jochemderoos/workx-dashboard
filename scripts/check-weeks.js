const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const weeks = await prisma.meetingWeek.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { distributions: true },
  })
  for (const w of weeks) {
    console.log('Week:', w.dateLabel, '| Aangemaakt:', w.createdAt.toISOString(), '| ID:', w.id)
    for (const d of w.distributions) {
      console.log('  ', d.partnerName, '->', d.employeeName || '(leeg)')
    }
    console.log()
  }
  await prisma.$disconnect()
}

main().catch(console.error)
