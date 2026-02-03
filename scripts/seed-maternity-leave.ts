import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MATERNITY_LEAVES = [
  {
    name: 'Wies',
    startDate: '2025-03-06',
    endDate: '2025-06-12',
  },
  {
    name: 'Justine',
    startDate: '2025-04-25',
    endDate: '2025-08-15',
  },
]

async function main() {
  console.log('Adding maternity leave (zwangerschapsverlof)...\n')

  for (const leave of MATERNITY_LEAVES) {
    // Find user by name (partial match)
    const user = await prisma.user.findFirst({
      where: {
        name: { contains: leave.name },
      },
    })

    if (!user) {
      console.error(`❌ User "${leave.name}" not found!`)
      continue
    }

    console.log(`Found user: ${user.name} (${user.id})`)

    // Check if ParentalLeave already exists for this user
    let parentalLeave = await prisma.parentalLeave.findFirst({
      where: { userId: user.id },
    })

    const startDate = new Date(leave.startDate)
    const endDate = new Date(leave.endDate)

    if (parentalLeave) {
      // Update existing record
      parentalLeave = await prisma.parentalLeave.update({
        where: { id: parentalLeave.id },
        data: {
          zwangerschapsverlofStart: startDate,
          zwangerschapsverlofStatus: `${leave.startDate} t/m ${leave.endDate}`,
          note: `Zwangerschapsverlof: ${startDate.toLocaleDateString('nl-NL')} - ${endDate.toLocaleDateString('nl-NL')}`,
        },
      })
      console.log(`✅ Updated ParentalLeave for ${user.name}`)
    } else {
      // Create new record
      parentalLeave = await prisma.parentalLeave.create({
        data: {
          userId: user.id,
          zwangerschapsverlofStart: startDate,
          zwangerschapsverlofStatus: `${leave.startDate} t/m ${leave.endDate}`,
          note: `Zwangerschapsverlof: ${startDate.toLocaleDateString('nl-NL')} - ${endDate.toLocaleDateString('nl-NL')}`,
        },
      })
      console.log(`✅ Created ParentalLeave for ${user.name}`)
    }

    // Also create a vacation request to show in the Vakantie&Verlof calendar
    // Check if a maternity vacation already exists
    const existingVacation = await prisma.vacationRequest.findFirst({
      where: {
        userId: user.id,
        reason: { contains: 'Zwangerschapsverlof' },
        startDate: startDate,
      },
    })

    if (!existingVacation) {
      // Calculate days
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      await prisma.vacationRequest.create({
        data: {
          userId: user.id,
          startDate: startDate,
          endDate: endDate,
          days: diffDays,
          reason: `Zwangerschapsverlof`,
          status: 'APPROVED',
        },
      })
      console.log(`✅ Created VacationRequest (calendar entry) for ${user.name} - ${diffDays} dagen`)
    } else {
      console.log(`ℹ️ VacationRequest already exists for ${user.name}`)
    }

    console.log('')
  }

  console.log('Done!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
