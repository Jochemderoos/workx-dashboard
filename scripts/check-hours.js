const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  for (const month of [1, 2, 3]) {
    const hours = await prisma.monthlyHours.findMany({ where: { year: 2026, month } })
    const totalBillable = hours.reduce((s, h) => s + h.billableHours, 0)
    const totalWorked = hours.reduce((s, h) => s + h.workedHours, 0)
    console.log(`\n=== 2026-${String(month).padStart(2, '0')} ===`)
    console.log(`Totaal: ${hours.length} medewerkers, billable: ${Math.round(totalBillable * 100) / 100}, worked: ${Math.round(totalWorked * 100) / 100}`)
    for (const h of hours.sort((a, b) => b.billableHours - a.billableHours)) {
      console.log(`  ${h.employeeName}: billable=${h.billableHours}, worked=${h.workedHours}`)
    }
  }

  // Also check WorkloadDetail counts per month
  console.log('\n=== WorkloadDetail counts ===')
  for (const month of [1, 2, 3]) {
    const startDate = `2026-${String(month).padStart(2, '0')}-01`
    const endMonth = month + 1
    const endDate = `2026-${String(endMonth).padStart(2, '0')}-01`
    const count = await prisma.workloadDetail.count({ where: { date: { gte: startDate, lt: endDate } } })
    const sumResult = await prisma.workloadDetail.aggregate({
      where: { date: { gte: startDate, lt: endDate } },
      _sum: { billableHours: true, workedHours: true },
    })
    console.log(`2026-${String(month).padStart(2, '0')}: ${count} detail rows, billable sum: ${sumResult._sum.billableHours}, worked sum: ${sumResult._sum.workedHours}`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
