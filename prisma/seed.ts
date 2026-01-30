import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create default channels
  const generalChannel = await prisma.chatChannel.upsert({
    where: { id: 'general' },
    update: {},
    create: {
      id: 'general',
      name: 'algemeen',
      description: 'Algemene discussies en aankondigingen',
      isPrivate: false,
    }
  })

  const arbeidsrechtChannel = await prisma.chatChannel.upsert({
    where: { id: 'arbeidsrecht' },
    update: {},
    create: {
      id: 'arbeidsrecht',
      name: 'arbeidsrecht',
      description: 'Discussies over arbeidsrechtzaken',
      isPrivate: false,
    }
  })

  const randomChannel = await prisma.chatChannel.upsert({
    where: { id: 'random' },
    update: {},
    create: {
      id: 'random',
      name: 'random',
      description: 'Off-topic en gezelligheid',
      isPrivate: false,
    }
  })

  console.log('Created channels:', { generalChannel, arbeidsrechtChannel, randomChannel })

  // Create demo admin user
  const hashedPassword = await bcrypt.hash('workx2024', 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@workxadvocaten.nl' },
    update: {},
    create: {
      email: 'admin@workxadvocaten.nl',
      name: 'Admin Workx',
      password: hashedPassword,
      role: 'ADMIN',
      department: 'Management',
    }
  })

  console.log('Created admin user:', adminUser.email)

  // Create vacation days for admin
  const currentYear = new Date().getFullYear()
  await prisma.vacationDays.upsert({
    where: {
      id: `${adminUser.id}-${currentYear}`,
    },
    update: {},
    create: {
      userId: adminUser.id,
      year: currentYear,
      totalDays: 25,
      usedDays: 0,
    }
  })

  // Add admin to general channel
  await prisma.channelMember.upsert({
    where: {
      userId_channelId: {
        userId: adminUser.id,
        channelId: 'general',
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      channelId: 'general',
    }
  })

  // Create a welcome message
  await prisma.chatMessage.create({
    data: {
      content: 'Welkom bij het Workx Dashboard! Dit is het #algemeen kanaal voor teamcommunicatie.',
      senderId: adminUser.id,
      channelId: 'general',
    }
  })

  // Create sample calendar events
  const now = new Date()

  // Event 1: Team meeting in 2 days
  const meeting1Date = new Date(now)
  meeting1Date.setDate(meeting1Date.getDate() + 2)
  meeting1Date.setHours(10, 0, 0, 0)

  await prisma.calendarEvent.create({
    data: {
      title: 'Wekelijks teamoverleg',
      description: 'Bespreken van lopende zaken en updates',
      startTime: meeting1Date,
      endTime: new Date(meeting1Date.getTime() + 60 * 60 * 1000), // 1 hour
      isAllDay: false,
      location: 'Vergaderruimte 1',
      color: '#60a5fa', // blue for meetings
      category: 'MEETING',
      createdById: adminUser.id,
    }
  })

  // Event 2: Deadline in 5 days
  const deadline = new Date(now)
  deadline.setDate(deadline.getDate() + 5)
  deadline.setHours(17, 0, 0, 0)

  await prisma.calendarEvent.create({
    data: {
      title: 'Deadline jaarrapport',
      description: 'Inleveren jaarlijkse rapportage bij de orde',
      startTime: deadline,
      endTime: deadline,
      isAllDay: false,
      location: null,
      color: '#f87171', // red for deadlines
      category: 'DEADLINE',
      createdById: adminUser.id,
    }
  })

  // Event 3: Training next week
  const training = new Date(now)
  training.setDate(training.getDate() + 7)
  training.setHours(9, 0, 0, 0)

  await prisma.calendarEvent.create({
    data: {
      title: 'Cursus nieuwe wetgeving',
      description: 'Update over recente wijzigingen in arbeidsrecht',
      startTime: training,
      endTime: new Date(training.getTime() + 4 * 60 * 60 * 1000), // 4 hours
      isAllDay: false,
      location: 'Externe locatie',
      color: '#a78bfa', // purple for training
      category: 'TRAINING',
      createdById: adminUser.id,
    }
  })

  // Event 4: Friday drinks
  const friday = new Date(now)
  const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7
  friday.setDate(friday.getDate() + daysUntilFriday)
  friday.setHours(17, 0, 0, 0)

  await prisma.calendarEvent.create({
    data: {
      title: 'Vrijdagmiddagborrel',
      description: 'Gezellig afsluiten van de week!',
      startTime: friday,
      endTime: new Date(friday.getTime() + 2 * 60 * 60 * 1000), // 2 hours
      isAllDay: false,
      location: 'Kantoor - pantry',
      color: '#34d399', // green for social
      category: 'SOCIAL',
      createdById: adminUser.id,
    }
  })

  console.log('Created sample calendar events')
  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
