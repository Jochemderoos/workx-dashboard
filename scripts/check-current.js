const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  for (const month of [1, 2, 3]) {
    const start = `2026-${String(month).padStart(2, '0')}-01`
    const end = month < 12 ? `2026-${String(month + 1).padStart(2, '0')}-01` : '2027-01-01'
    const mh = await prisma.monthlyHours.aggregate({
      where: { year: 2026, month },
      _sum: { billableHours: true, workedHours: true },
    })
    const detail = await prisma.workloadDetail.aggregate({
      where: { date: { gte: start, lt: end } },
      _sum: { billableHours: true },
    })
    console.log(`2026-${String(month).padStart(2,'0')}: MonthlyHours billable=${Math.round((mh._sum.billableHours||0)*100)/100}, WorkloadDetail billable=${Math.round((detail._sum.billableHours||0)*100)/100}`)
  }
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
