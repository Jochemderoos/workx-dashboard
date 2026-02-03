import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// JAR Rooster 2026
const JAR_SCHEDULE_2026 = [
  { date: '2026-02-12', name: 'Wies' },
  { date: '2026-03-05', name: 'Alain' },
  { date: '2026-03-26', name: 'Julia' },
  { date: '2026-04-16', name: 'Marnix' },
  { date: '2026-05-07', name: 'Heleen' },
  { date: '2026-05-28', name: 'Marlieke' },
  { date: '2026-06-18', name: 'Emma' },
  { date: '2026-07-09', name: 'Maaike' },
  { date: '2026-07-30', name: 'Kay' },
  { date: '2026-08-20', name: 'Jochem' },
  { date: '2026-09-10', name: 'Barbara' },
  { date: '2026-10-01', name: 'Erika' },
  { date: '2026-10-22', name: 'Justine' },
  { date: '2026-11-12', name: 'Bas' },
  { date: '2026-12-03', name: 'Juliette' },
  { date: '2026-12-24', name: 'Wies' },
]

async function main() {
  console.log('Seeding JAR rooster 2026...')

  // Get first user to use as creator
  const firstUser = await prisma.user.findFirst()
  if (!firstUser) {
    console.error('No users found in database. Please create a user first.')
    process.exit(1)
  }

  console.log(`Using user "${firstUser.name}" as creator`)

  // Check if JAR events already exist
  const existing = await prisma.calendarEvent.findMany({
    where: {
      title: { startsWith: 'JAR' },
      startTime: {
        gte: new Date('2026-01-01'),
        lte: new Date('2026-12-31'),
      },
    },
  })

  if (existing.length > 0) {
    console.log(`Found ${existing.length} existing JAR events. Deleting them first...`)
    await prisma.calendarEvent.deleteMany({
      where: {
        title: { startsWith: 'JAR' },
        startTime: {
          gte: new Date('2026-01-01'),
          lte: new Date('2026-12-31'),
        },
      },
    })
    console.log('Deleted existing JAR events.')
  }

  // Create all JAR events
  for (const jar of JAR_SCHEDULE_2026) {
    const startDate = new Date(jar.date)
    // JAR meetings from 16:00-17:00
    startDate.setHours(16, 0, 0, 0)

    const endDate = new Date(jar.date)
    endDate.setHours(17, 0, 0, 0)

    await prisma.calendarEvent.create({
      data: {
        title: `JAR - ${jar.name}`,
        description: `JAR beurt van ${jar.name}`,
        startTime: startDate,
        endTime: endDate,
        isAllDay: false,
        location: 'Vergaderruimte',
        color: '#60a5fa', // Blue color
        category: 'MEETING',
        createdById: firstUser.id,
      },
    })
    console.log(`Created: JAR - ${jar.name} (${jar.date} 16:00-17:00)`)
  }

  console.log(`\n✅ Successfully created ${JAR_SCHEDULE_2026.length} JAR events!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
