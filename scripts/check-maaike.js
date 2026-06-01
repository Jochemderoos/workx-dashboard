const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
async function main() {
  // Check MonthlyHours for Maaike
  const mh = await prisma.monthlyHours.findMany({
    where: { employeeName: { contains: 'Maaike' } },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  })
  console.log('MonthlyHours voor Maaike:')
  for (const r of mh) {
    console.log(`  ${r.year}-${String(r.month).padStart(2,'0')}: billable=${r.billableHours}, worked=${r.workedHours}`)
  }

  // Check WorkloadDetail for Maaike in March
  const detail = await prisma.workloadDetail.findMany({
    where: { personName: { contains: 'Maaike' }, date: { gte: '2026-03-01', lt: '2026-04-01' } },
    orderBy: { date: 'asc' },
  })
  console.log(`\nWorkloadDetail maart (${detail.length} records):`)
  let totalBillable = 0
  for (const d of detail) {
    console.log(`  ${d.date} | ${d.projectName} | ${d.activityType} | billable=${d.billableHours} worked=${d.workedHours}`)
    totalBillable += d.billableHours
  }
  console.log(`\nTotaal billable maart: ${Math.round(totalBillable * 100) / 100}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
