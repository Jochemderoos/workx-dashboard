import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Team Workx Advocaten
// Rollen: PARTNER (directie), ADMIN (Hanna - kantoormanager), EMPLOYEE (medewerkers)
// Partners + Admin kunnen vakantiesaldo beheren

// Echte verjaardagen uit loonstroken (format: MM-DD)
// startDate: datum in dienst uit loonstroken januari 2026
const TEAM_MEMBERS = [
  // Partners + Admin met volledige toegang
  { name: 'Hanna Blaauboer', email: 'hanna.blaauboer@workxadvocaten.nl', role: 'ADMIN', department: 'Kantoor', birthDate: '12-23', startDate: '2019-01-01' }, // 23-12-1991, in dienst 1-1-2019
  { name: 'Jochem de Roos', email: 'jochem.deroos@workxadvocaten.nl', role: 'PARTNER', department: 'Partner', birthDate: '03-02', startDate: null },
  { name: 'Marnix Ritmeester', email: 'marnix.ritmeester@workxadvocaten.nl', role: 'PARTNER', department: 'Partner', birthDate: null, startDate: null },
  { name: 'Bas den Ridder', email: 'bas.denridder@workxadvocaten.nl', role: 'PARTNER', department: 'Partner', birthDate: null, startDate: null },
  { name: 'Maaike de Jong', email: 'maaike.dejong@workxadvocaten.nl', role: 'PARTNER', department: 'Partner', birthDate: null, startDate: null },
  { name: 'Juliette Niersman', email: 'juliette.niersman@workxadvocaten.nl', role: 'PARTNER', department: 'Partner', birthDate: null, startDate: null },

  // Medewerkers (echte data uit loonstroken januari 2026)
  { name: 'Alain Heunen', email: 'alain.heunen@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '04-03', startDate: '2023-09-04' }, // in dienst 4-9-2023
  { name: 'Marlieke Schipper', email: 'marlieke.schipper@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '01-10', startDate: '2022-01-17' }, // in dienst 17-1-2022
  { name: 'Justine Schellekens', email: 'justine.schellekens@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '06-29', startDate: '2022-02-01' }, // in dienst 1-2-2022
  { name: 'Wies van Pesch', email: 'wies.vanpesch@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '01-16', startDate: '2022-11-01' }, // in dienst 1-11-2022
  { name: 'Emma van der Vos', email: 'emma.vandervos@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '09-04', startDate: '2023-06-01' }, // in dienst 1-6-2023
  { name: 'Kay Maes', email: 'kay.maes@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '01-24', startDate: '2023-11-15' }, // in dienst 15-11-2023
  { name: 'Erika van Zadelhof', email: 'erika.vanzadelhof@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '06-23', startDate: '2024-01-03' }, // in dienst 3-1-2024
  { name: 'Barbara Rip', email: 'barbara.rip@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '04-04', startDate: '2024-10-01' }, // in dienst 1-10-2024
  { name: 'Julia Groen', email: 'julia.groen@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '07-15', startDate: '2025-06-01' }, // in dienst 1-6-2025
  { name: 'Heleen Pesser', email: 'heleen.pesser@workxadvocaten.nl', role: 'EMPLOYEE', department: 'Arbeidsrecht', birthDate: '07-14', startDate: '2024-10-01' }, // in dienst 1-10-2024
  { name: 'Lotte van Sint Truiden', email: 'officemanagement@workxadvocaten.nl', role: 'ADMIN', department: 'Kantoor (Officemanagement)', birthDate: '06-03', startDate: '2024-10-01' }, // in dienst 1-10-2024
]

// Vakantiesaldo 2026 data (uit Excel)
const VACATION_BALANCES: Record<string, { overgedragen: number; opbouw: number; bijgekocht: number; opgenomen: number }> = {
  'hanna.blaauboer@workxadvocaten.nl': { overgedragen: 11, opbouw: 22.5, bijgekocht: 0, opgenomen: 7 },
  'justine.schellekens@workxadvocaten.nl': { overgedragen: 5, opbouw: 23, bijgekocht: 0, opgenomen: 10 },
  'marlieke.schipper@workxadvocaten.nl': { overgedragen: 6, opbouw: 22, bijgekocht: 0, opgenomen: 17 },
  'wies.vanpesch@workxadvocaten.nl': { overgedragen: 1.5, opbouw: 23, bijgekocht: 4, opgenomen: 9 },
  'emma.vandervos@workxadvocaten.nl': { overgedragen: 3, opbouw: 25, bijgekocht: 0, opgenomen: 0 },
  'alain.heunen@workxadvocaten.nl': { overgedragen: 0, opbouw: 10, bijgekocht: 0, opgenomen: 10 },
  'kay.maes@workxadvocaten.nl': { overgedragen: 0, opbouw: 25, bijgekocht: 0, opgenomen: 0 },
  'erika.vanzadelhof@workxadvocaten.nl': { overgedragen: 6, opbouw: 25, bijgekocht: 5, opgenomen: 12 },
  'barbara.rip@workxadvocaten.nl': { overgedragen: 13.5, opbouw: 25, bijgekocht: 0, opgenomen: 1.5 },
  'julia.groen@workxadvocaten.nl': { overgedragen: 5, opbouw: 25, bijgekocht: 0, opgenomen: 5 },
  'heleen.pesser@workxadvocaten.nl': { overgedragen: 0, opbouw: 25, bijgekocht: 5, opgenomen: 12 },
  'officemanagement@workxadvocaten.nl': { overgedragen: 0, opbouw: 25, bijgekocht: 0, opgenomen: 0 },
}

async function main() {
  console.log('🌱 Seeding Workx database...\n')

  // Standaard wachtwoord voor alle gebruikers (moet na eerste login gewijzigd worden)
  const defaultPassword = await bcrypt.hash('Workx2024!', 12)
  const currentYear = new Date().getFullYear()

  // Create all team members
  console.log('👥 Creating team members...')

  for (const member of TEAM_MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        name: member.name,
        role: member.role,
        department: member.department,
        birthDate: member.birthDate,
        startDate: member.startDate ? new Date(member.startDate) : null,
      },
      create: {
        email: member.email,
        name: member.name,
        password: defaultPassword,
        role: member.role,
        department: member.department,
        birthDate: member.birthDate,
        startDate: member.startDate ? new Date(member.startDate) : null,
      }
    })

    console.log(`  ✓ ${member.name} (${member.role})`)

    // Create vacation balance for employees and admin (not for partners)
    const vacationData = VACATION_BALANCES[member.email]
    if (vacationData) {
      await prisma.vacationBalance.upsert({
        where: { userId: user.id },
        update: {
          year: currentYear,
          overgedragenVorigJaar: vacationData.overgedragen,
          opbouwLopendJaar: vacationData.opbouw,
          bijgekocht: vacationData.bijgekocht || 0,
          opgenomenLopendJaar: vacationData.opgenomen,
        },
        create: {
          userId: user.id,
          year: currentYear,
          overgedragenVorigJaar: vacationData.overgedragen,
          opbouwLopendJaar: vacationData.opbouw,
          bijgekocht: vacationData.bijgekocht || 0,
          opgenomenLopendJaar: vacationData.opgenomen,
        }
      })
    }
  }

  // Create chat channels
  console.log('\n💬 Creating chat channels...')

  const channels = [
    { id: 'general', name: 'algemeen', description: 'Algemene discussies en aankondigingen' },
    { id: 'arbeidsrecht', name: 'arbeidsrecht', description: 'Discussies over arbeidsrechtzaken' },
    { id: 'random', name: 'random', description: 'Off-topic en gezelligheid' },
  ]

  for (const channel of channels) {
    await prisma.chatChannel.upsert({
      where: { id: channel.id },
      update: {},
      create: {
        id: channel.id,
        name: channel.name,
        description: channel.description,
        isPrivate: false,
      }
    })
    console.log(`  ✓ #${channel.name}`)
  }

  // Get Hanna for creating demo content
  const hanna = await prisma.user.findUnique({ where: { email: 'hanna@workxadvocaten.nl' } })

  if (hanna) {
    // Add all users to general channel
    console.log('\n📝 Adding users to channels...')
    const allUsers = await prisma.user.findMany()

    for (const user of allUsers) {
      await prisma.channelMember.upsert({
        where: {
          userId_channelId: {
            userId: user.id,
            channelId: 'general',
          }
        },
        update: {},
        create: {
          userId: user.id,
          channelId: 'general',
        }
      })
    }
    console.log(`  ✓ ${allUsers.length} users added to #algemeen`)

    // Create sample calendar events
    console.log('\n📅 Creating calendar events...')
    const now = new Date()

    // Team meeting
    const meeting = new Date(now)
    meeting.setDate(meeting.getDate() + 2)
    meeting.setHours(10, 0, 0, 0)

    await prisma.calendarEvent.upsert({
      where: { id: 'weekly-meeting' },
      update: {},
      create: {
        id: 'weekly-meeting',
        title: 'Wekelijks teamoverleg',
        description: 'Bespreken van lopende zaken en updates',
        startTime: meeting,
        endTime: new Date(meeting.getTime() + 60 * 60 * 1000),
        isAllDay: false,
        location: 'Vergaderruimte 1',
        color: '#60a5fa',
        category: 'MEETING',
        createdById: hanna.id,
      }
    })
    console.log('  ✓ Wekelijks teamoverleg')

    // Friday drinks
    const friday = new Date(now)
    const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7
    friday.setDate(friday.getDate() + daysUntilFriday)
    friday.setHours(17, 0, 0, 0)

    await prisma.calendarEvent.upsert({
      where: { id: 'friday-drinks' },
      update: {},
      create: {
        id: 'friday-drinks',
        title: 'Vrijdagmiddagborrel',
        description: 'Gezellig afsluiten van de week!',
        startTime: friday,
        endTime: new Date(friday.getTime() + 2 * 60 * 60 * 1000),
        isAllDay: false,
        location: 'Kantoor - pantry',
        color: '#34d399',
        category: 'SOCIAL',
        createdById: hanna.id,
      }
    })
    console.log('  ✓ Vrijdagmiddagborrel')
  }

  console.log('\n✅ Database seeded successfully!')
  console.log('\n📧 Login credentials:')
  console.log('   Password: Workx2024!')
  console.log('\n   VOLLEDIGE TOEGANG (6 accounts):')
  console.log('   - hanna.blaauboer@workxadvocaten.nl (Admin)')
  console.log('   - jochem.deroos@workxadvocaten.nl (Partner)')
  console.log('   - marnix.ritmeester@workxadvocaten.nl (Partner)')
  console.log('   - bas.denridder@workxadvocaten.nl (Partner)')
  console.log('   - maaike.dejong@workxadvocaten.nl (Partner)')
  console.log('   - juliette.niersman@workxadvocaten.nl (Partner)')
  console.log('\n   EIGEN DASHBOARD (10 accounts):')
  console.log('   - alain.heunen@workxadvocaten.nl')
  console.log('   - marlieke.schipper@workxadvocaten.nl')
  console.log('   - justine.schellekens@workxadvocaten.nl')
  console.log('   - wies.vanpesch@workxadvocaten.nl')
  console.log('   - emma.vandervos@workxadvocaten.nl')
  console.log('   - kay.maes@workxadvocaten.nl')
  console.log('   - erika.vanzadelhof@workxadvocaten.nl')
  console.log('   - barbara.rip@workxadvocaten.nl')
  console.log('   - julia.groen@workxadvocaten.nl')
  console.log('   - officemanagement@workxadvocaten.nl (Lotte)')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
