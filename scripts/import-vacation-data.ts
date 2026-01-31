import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Vakantiedata uit Excel "Vakantiedagen overzicht 2026.xlsx"
const vacationData = [
  {
    name: 'Hanna',
    opbouwLopendJaar: 22.5,
    overgedragenVorigJaar: 11,
    bijgekocht: 0,
    opgenomenLopendJaar: 7,
    note: 'Totaal 33,5 dagen'
  },
  {
    name: 'Justine',
    opbouwLopendJaar: 23,
    overgedragenVorigJaar: 5,
    bijgekocht: 0,
    opgenomenLopendJaar: 10,
    note: '20 dagen eigenlijk maar vanaf 25 april met verlof. Dus 23 dagen over 2026'
  },
  {
    name: 'Marlieke',
    opbouwLopendJaar: 22,
    overgedragenVorigJaar: 6,
    bijgekocht: 0,
    opgenomenLopendJaar: 17,
    note: 'Betaald ouderschapsverlof t/m 5 juni. Totaal 22 dagen (geen vakantie over onbetaald o.v.)'
  },
  {
    name: 'Wies',
    opbouwLopendJaar: 23,
    overgedragenVorigJaar: 1.5,
    bijgekocht: 4,
    opgenomenLopendJaar: 9,
    note: 'Eigenlijk 20 totaal maar ze gaat 6 maart met verlof dus 23 dagen totaal. 4 dagen bijgekocht verwerkt in feb.'
  },
  {
    name: 'Emma',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 3,
    bijgekocht: 0,
    opgenomenLopendJaar: 0,
    note: 'Totaal 28 dagen'
  },
  {
    name: 'Alain',
    opbouwLopendJaar: 20,
    overgedragenVorigJaar: 0,
    bijgekocht: 0,
    opgenomenLopendJaar: 10,
    note: 'Per 1 juni uit dienst dus 10 totaal'
  },
  {
    name: 'Heleen',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 0,
    bijgekocht: 5,
    opgenomenLopendJaar: 12,
    note: '5 dagen bijgekocht verwerkt in jan/feb. Totaal 30 dagen.'
  },
  {
    name: 'Erika',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 6,
    bijgekocht: 5,
    opgenomenLopendJaar: 12,
    note: '5 bijgekocht verwerkt in jan/feb. 6 van 2025. Totaal 36 dagen.'
  },
  {
    name: 'Kay',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 0,
    bijgekocht: 0,
    opgenomenLopendJaar: 0,
    note: 'Totaal 25 dagen'
  },
  {
    name: 'Barbara',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 13.5,
    bijgekocht: 0,
    opgenomenLopendJaar: 1.5,
    note: '13,5 over van 2025. Totaal 38,5 dagen.'
  },
  {
    name: 'Julia',
    opbouwLopendJaar: 25,
    overgedragenVorigJaar: 5,
    bijgekocht: 0,
    opgenomenLopendJaar: 5,
    note: '5 van 2025. Totaal 30 dagen.'
  },
  {
    name: 'Lotte',
    opbouwLopendJaar: 2.5,
    overgedragenVorigJaar: 0,
    bijgekocht: 0,
    opgenomenLopendJaar: 0,
    note: 'Werkstudent. Bij 2 dagen in de week werken, 1 vol jaar, recht op 10 vakantiedagen. Diyar 3 maanden: 2,5 vakantiedag'
  },
]

async function importVacationData() {
  console.log('Starting vacation data import...\n')

  for (const data of vacationData) {
    // Find user by first name (partial match)
    const user = await prisma.user.findFirst({
      where: {
        name: {
          contains: data.name,
          mode: 'insensitive'
        }
      }
    })

    if (!user) {
      console.log(`❌ User not found: ${data.name}`)
      continue
    }

    // Check if vacation balance exists
    const existingBalance = await prisma.vacationBalance.findUnique({
      where: { userId: user.id }
    })

    const balanceData = {
      year: 2026,
      opbouwLopendJaar: data.opbouwLopendJaar,
      overgedragenVorigJaar: data.overgedragenVorigJaar,
      bijgekocht: data.bijgekocht,
      opgenomenLopendJaar: data.opgenomenLopendJaar,
      note: data.note,
    }

    if (existingBalance) {
      // Update existing
      await prisma.vacationBalance.update({
        where: { userId: user.id },
        data: balanceData
      })
      console.log(`✅ Updated: ${user.name} (${user.email})`)
    } else {
      // Create new
      await prisma.vacationBalance.create({
        data: {
          userId: user.id,
          ...balanceData
        }
      })
      console.log(`✅ Created: ${user.name} (${user.email})`)
    }

    const total = data.opbouwLopendJaar + data.overgedragenVorigJaar + data.bijgekocht
    const remaining = total - data.opgenomenLopendJaar
    console.log(`   Totaal: ${total} | Opgenomen: ${data.opgenomenLopendJaar} | Resterend: ${remaining}\n`)
  }

  console.log('Import completed!')
}

importVacationData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
