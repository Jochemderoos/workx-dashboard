import { PrismaClient } from '@prisma/client'

const directUrl = process.env.DATABASE_URL?.replace(':5432/', ':6543/') || process.env.DATABASE_URL

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
})

async function main() {
  // Check 2026 financial data
  const finData = await prisma.financialData2026.findFirst()
  console.log('2026 Financial Data:', finData)

  // Check monthly hours count
  const hoursCount = await prisma.monthlyHours.count()
  console.log('Total Monthly Hours records:', hoursCount)

  // Check 2025 monthly hours
  const hours2025 = await prisma.monthlyHours.count({ where: { year: 2025 } })
  console.log('2025 Monthly Hours records:', hours2025)

  // Sample of 2025 data
  const sample = await prisma.monthlyHours.findMany({ 
    where: { year: 2025 }, 
    take: 5,
    orderBy: { month: 'asc' }
  })
  console.log('Sample 2025 data:', sample)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
