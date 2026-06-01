const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const rows = await p.workloadDetail.findMany({
    where: { projectName: { contains: 'Brightwell', mode: 'insensitive' } },
    select: { personName: true, date: true, projectName: true, workedHours: true },
    orderBy: { date: 'desc' }
  })
  console.log('Totaal records:', rows.length)
  if (rows.length > 0) console.log('Project naam:', rows[0].projectName)

  const byPerson = {}
  for (const r of rows) {
    byPerson[r.personName] = (byPerson[r.personName] || 0) + r.workedHours
  }
  console.log('\nUren per persoon:')
  Object.entries(byPerson).sort((a, b) => b[1] - a[1]).forEach(([name, hours]) => {
    console.log(' ', name, '-', Math.round(hours * 10) / 10, 'u')
  })

  // Check if Kay is in there
  const hasKay = Object.keys(byPerson).some(n => n.includes('Kay'))
  console.log('\nKay Maes aanwezig:', hasKay)

  await p.$disconnect()
}
main()
