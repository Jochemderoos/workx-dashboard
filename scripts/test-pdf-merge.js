const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const all = await p.expenseDeclaration.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  })

  console.log('Total declarations:', all.length, '\n')
  for (const d of all) {
    console.log(`=== ${d.employeeName} | ${d.invoiceNumber || 'no invoice'} | ${d.status} | ${d.createdAt.toISOString()} ===`)
    for (const i of d.items) {
      console.log(`  desc="${i.description}" type=${i.expenseType} amt=${i.amount}`)
      console.log(`  attachmentUrl=${i.attachmentUrl ? `"${i.attachmentUrl.substring(0,30)}..." (${i.attachmentUrl.length} chars)` : 'NULL'}`)
      console.log(`  attachmentName=${i.attachmentName || 'NULL'}`)
    }
    console.log()
  }

  await p.$disconnect()
}
main()
