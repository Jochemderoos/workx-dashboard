const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const weekId = 'cmmd8u35r0001pqejbknc2tye' // Week 9 maart 2026

  await prisma.workDistribution.updateMany({
    where: { weekId },
    data: { employeeName: '', employeeId: null },
  })

  console.log('Distributies van week 9 maart leeggemaakt.')

  const dists = await prisma.workDistribution.findMany({ where: { weekId } })
  for (const d of dists) {
    console.log('  ', d.partnerName, '->', d.employeeName || '(leeg)')
  }

  await prisma.$disconnect()
}

main().catch(console.error)
