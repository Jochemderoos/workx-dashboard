import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const emma = await prisma.user.findFirst({ where: { name: { contains: 'Emma' } } })
  if (!emma) {
    console.log('Emma niet gevonden')
    return
  }

  console.log('Found:', emma.name)

  const startDate = new Date('2026-01-12')
  const endDate = new Date('2026-05-18')
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Update or create ParentalLeave
  let pl = await prisma.parentalLeave.findFirst({ where: { userId: emma.id } })
  if (pl) {
    await prisma.parentalLeave.update({
      where: { id: pl.id },
      data: {
        zwangerschapsverlofStart: startDate,
        zwangerschapsverlofStatus: '2026-01-12 t/m 2026-05-18',
        note: 'Zwangerschapsverlof: 12 januari 2026 - 18 mei 2026',
      },
    })
    console.log('Updated ParentalLeave')
  } else {
    await prisma.parentalLeave.create({
      data: {
        userId: emma.id,
        zwangerschapsverlofStart: startDate,
        zwangerschapsverlofStatus: '2026-01-12 t/m 2026-05-18',
        note: 'Zwangerschapsverlof: 12 januari 2026 - 18 mei 2026',
      },
    })
    console.log('Created ParentalLeave')
  }

  // Create vacation request for calendar
  const existing = await prisma.vacationRequest.findFirst({
    where: { userId: emma.id, reason: 'Zwangerschapsverlof' }
  })

  if (!existing) {
    await prisma.vacationRequest.create({
      data: {
        userId: emma.id,
        startDate,
        endDate,
        days,
        reason: 'Zwangerschapsverlof',
        status: 'APPROVED',
      },
    })
    console.log('Created VacationRequest')
  } else {
    console.log('VacationRequest already exists')
  }

  console.log(`\n✅ Emma: 12 januari 2026 - 18 mei 2026 (${days} dagen)`)
}

main().finally(() => prisma.$disconnect())
