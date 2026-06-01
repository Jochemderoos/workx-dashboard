const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find March 2026 month
  const marchMonth = await prisma.meetingMonth.findFirst({
    where: { year: 2026, month: 3, isLustrum: false },
  })

  if (!marchMonth) {
    // Create it if it doesn't exist yet
    const created = await prisma.meetingMonth.create({
      data: { year: 2026, month: 3, label: 'Maart 2026', isLustrum: false },
    })
    console.log('Maart 2026 aangemaakt:', created.id)
    marchMonth = created
  }

  console.log('Maart 2026 month ID:', marchMonth.id)

  // Find February month
  const febMonth = await prisma.meetingMonth.findFirst({
    where: { year: 2026, month: 2, isLustrum: false },
  })

  if (!febMonth) {
    console.log('Februari 2026 niet gevonden')
    await prisma.$disconnect()
    return
  }

  console.log('Februari 2026 month ID:', febMonth.id)

  // Find all weeks in February that have a March meeting date
  const febWeeks = await prisma.meetingWeek.findMany({
    where: { monthId: febMonth.id },
    orderBy: { meetingDate: 'asc' },
  })

  console.log(`\nWeken in Februari:`)
  for (const w of febWeeks) {
    const date = w.meetingDate.toISOString().substring(0, 10)
    const isMarech = w.meetingDate.getMonth() === 2 // 0-indexed, 2 = March
    console.log(`  ${w.dateLabel} (${date}) - ${isMarech ? '→ VERPLAATSEN NAAR MAART' : 'blijft in februari'}`)
  }

  // Move March weeks
  const marchWeeks = febWeeks.filter(w => w.meetingDate.getMonth() === 2)

  if (marchWeeks.length === 0) {
    console.log('\nGeen maart-weken gevonden in februari')
    await prisma.$disconnect()
    return
  }

  for (const w of marchWeeks) {
    await prisma.meetingWeek.update({
      where: { id: w.id },
      data: { monthId: marchMonth.id },
    })
    console.log(`Verplaatst: ${w.dateLabel}`)
  }

  console.log(`\n${marchWeeks.length} weken verplaatst naar Maart 2026`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
