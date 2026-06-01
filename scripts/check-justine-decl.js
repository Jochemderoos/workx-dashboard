const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const all = await p.expenseDeclaration.findMany({
    include: { items: true },
    orderBy: { createdAt: 'desc' }
  })

  console.log('Total declarations:', all.length)
  all.forEach(d => {
    console.log('\n=== Declaration ===')
    console.log('Employee:', d.employeeName, '| Invoice:', d.invoiceNumber, '| Status:', d.status)
    console.log('Created:', d.createdAt.toISOString())
    d.items.forEach((i, idx) => {
      console.log('  Item', idx, ':', {
        desc: i.description,
        type: i.expenseType,
        amount: i.amount,
        hasAttachment: !!i.attachmentUrl,
        attachmentLength: i.attachmentUrl ? i.attachmentUrl.length : 0,
        attachmentStart: i.attachmentUrl ? i.attachmentUrl.substring(0, 40) : 'GEEN',
        attachmentName: i.attachmentName || 'GEEN'
      })
    })
  })

  await p.$disconnect()
}

main()
