const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const items = await p.expenseItem.findMany({
    where: { declarationId: 'cmmx9zquf0000plrnp5x7o9en' },
    select: { id: true, description: true, attachmentUrl: true, attachmentName: true }
  })
  items.forEach(i => {
    const u = i.attachmentUrl ? i.attachmentUrl.substring(0, 100) + '...' : 'null'
    console.log(i.description, '|', i.attachmentName, '|', u)
  })
  await p.$disconnect()
}
main()
