import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Updating maternity leave dates to 2026...\n')

  // Update Wies: 6 maart 2026 - 12 juni 2026
  const wies = await prisma.user.findFirst({ where: { name: { contains: 'Wies' } } })
  if (wies) {
    await prisma.parentalLeave.updateMany({
      where: { userId: wies.id },
      data: {
        zwangerschapsverlofStart: new Date('2026-03-06'),
        zwangerschapsverlofStatus: '2026-03-06 t/m 2026-06-12',
        note: 'Zwangerschapsverlof: 6 maart 2026 - 12 juni 2026',
      },
    })
    await prisma.vacationRequest.updateMany({
      where: { userId: wies.id, reason: 'Zwangerschapsverlof' },
      data: {
        startDate: new Date('2026-03-06'),
        endDate: new Date('2026-06-12'),
      },
    })
    console.log('✅ Wies: 6 maart 2026 - 12 juni 2026')
  }

  // Update Justine: 25 april 2026 - 15 augustus 2026
  const justine = await prisma.user.findFirst({ where: { name: { contains: 'Justine' } } })
  if (justine) {
    await prisma.parentalLeave.updateMany({
      where: { userId: justine.id },
      data: {
        zwangerschapsverlofStart: new Date('2026-04-25'),
        zwangerschapsverlofStatus: '2026-04-25 t/m 2026-08-15',
        note: 'Zwangerschapsverlof: 25 april 2026 - 15 augustus 2026',
      },
    })
    await prisma.vacationRequest.updateMany({
      where: { userId: justine.id, reason: 'Zwangerschapsverlof' },
      data: {
        startDate: new Date('2026-04-25'),
        endDate: new Date('2026-08-15'),
      },
    })
    console.log('✅ Justine: 25 april 2026 - 15 augustus 2026')
  }

  console.log('\nDone!')
}

main().finally(() => prisma.$disconnect())
