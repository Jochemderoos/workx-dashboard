import { PrismaClient } from '@prisma/client'

const directUrl = process.env.DATABASE_URL?.replace(':5432/', ':6543/') || process.env.DATABASE_URL

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
})

async function main() {
  // Check Jochem's role
  const jochem = await prisma.user.findFirst({
    where: { 
      OR: [
        { name: { contains: 'Jochem' } },
        { email: { contains: 'jochem' } }
      ]
    },
    select: { id: true, name: true, email: true, role: true }
  })
  console.log('Jochem user:', jochem)

  // Check 2026 financial data
  const finData = await prisma.financialData2026.findFirst()
  console.log('2026 Financial Data:', finData)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
