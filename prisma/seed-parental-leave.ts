import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Excel data geconverteerd naar seed data
const parentalLeaveData = [
  {
    userName: 'Wies',
    childNumber: 1,
    kindNaam: 'Olaf',
    kindGeboorteDatum: new Date('2024-01-20'),
    zwangerschapsverlofStatus: 'WAZO 16 weken ontvangen',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 324, // 9 weken volledig opgenomen
    betaaldVerlofDetails: '1 augustus 2024 ingegaan. 9 weken opgenomen',
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 21, // 10 + 11 dagen
    onbetaaldVerlofDetails: 'Tot verlof aantal dagen opgenomen: 3 t/m 16 oktober 2024 (= 10 werkdagen); 1 t/m 15 november onbetaald ouderschapsverlof (= 11 werkdagen). 64 over en vanaf 16 november elke maandag onbetaald verlof',
    uwvAangevraagd: true,
    uwvDetails: 'Bedrag ontvangen: WAZO, 9 weken betaald ouderschapsverlof',
  },
  {
    userName: 'Wies',
    childNumber: 2,
    uitgerekendeDatum: new Date('2026-04-17'),
    zwangerschapsverlofStart: new Date('2026-03-06'),
    zwangerschapsverlofStatus: 'Verlof per: vrijdag 6 maart 2026',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 0,
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    uwvAangevraagd: false,
  },
  {
    userName: 'Alain',
    childNumber: 1,
    kindNaam: 'Jibbi',
    kindGeboorteDatum: new Date('2025-07-06'),
    geboorteverlofPartner: '1 week geboorteverlof',
    aanvullendVerlofPartner: 'ja - 5 weken',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 138.66,
    betaaldVerlofDetails: 'Van de 324 uur (9 weken x 36 uur) heeft hij 138.66 uur opgenomen. Vanaf februari; Hij heeft dus nog 185.34 uur over. Dus 23 dagen. In feb nog 4 gebruikt dus 19 over na 6 feb.',
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    uwvAangevraagd: true,
    uwvDetails: 'Bedrag ontvangen: aanvullend ouderschapsverlof, betaald ouderschapsverlof 9 weken',
  },
  {
    userName: 'Emma',
    childNumber: 1,
    uitgerekendeDatum: new Date('2026-02-22'),
    zwangerschapsverlofStart: new Date('2026-01-12'),
    zwangerschapsverlofStatus: 'Uitgerekende datum is 22 februari, vanaf 12 jan met verlof, gepland retour: 18 mei 2026',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 72, // 10 dagen = ca 72 uur (2 weken)
    betaaldVerlofDetails: '4 t/m 15 mei (2 weken) betaald opgenomen (10). Verwerken in mei! Erna vanaf 21 mei elke donderdag betaald verlof. (30 over). Laatste dag betaald ouderschapsverlof: 10 december 2026',
    betaaldVerlofEinddatum: new Date('2026-12-10'),
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    onbetaaldVerlofDetails: 'Vanaf 17 december elke donderdag opnemen onbetaald verlof.',
    uwvAangevraagd: false,
  },
  {
    userName: 'Justine',
    childNumber: 1,
    kindNaam: 'Emma',
    kindGeboorteDatum: new Date('2024-07-03'),
    zwangerschapsverlofStatus: 'WAZO 16 weken ontvangen',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 324, // 9 weken volledig opgenomen
    betaaldVerlofDetails: '9 weken opgenomen, 23 april laatste dag betaald verlof',
    betaaldVerlofEinddatum: new Date('2025-04-23'),
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 52,
    onbetaaldVerlofDetails: 'Vanaf 30 april elke woensdag. Tot verlof baby 2 aantal dagen opgenomen: 52 dagen.',
    uwvAangevraagd: true,
    uwvDetails: 'Bedrag ontvangen: WAZO, 9 weken betaald ouderschapsverlof',
  },
  {
    userName: 'Justine',
    childNumber: 2,
    zwangerschapsverlofStart: new Date('2025-04-25'),
    zwangerschapsverlofStatus: 'Ze gaat 25 april met verlof (6 weken voor uitgerekende datum)',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 0,
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    uwvAangevraagd: false,
  },
  {
    userName: 'Marlieke',
    childNumber: 1,
    kindNaam: 'Luuk',
    kindGeboorteDatum: new Date('2025-06-13'),
    zwangerschapsverlofStart: new Date('2025-05-30'),
    zwangerschapsverlofStatus: 'WAZO 16 weken ontvangen - 30 mei t/m 13 juni: zwangerschapsverlof - 16 juni t/m 18 september: bevallingsverlof',
    betaaldTotaalUren: 324,
    betaaldOpgenomenUren: 79.2, // 11 dagen = ca 79.2 uur
    betaaldVerlofDetails: '19 september t/m 3 oktober: betaald ouderschapsverlof (11). Vanaf 6 oktober: elke vrijdag betaald ouderschapsverlof. Laatste dag betaald ouderschapsverlof: 24 april 2026',
    betaaldVerlofEinddatum: new Date('2026-04-24'),
    onbetaaldTotaalDagen: 85,
    onbetaaldOpgenomenDagen: 0,
    uwvAangevraagd: true,
    uwvDetails: 'WAZO, 6 weken betaald ouderschapsverlof. MOET NOG 3 weken aanvragen!',
  },
]

async function main() {
  console.log('Start seeding parental leave data...')

  // First, delete all existing parental leave records
  await prisma.parentalLeave.deleteMany({})
  console.log('Deleted existing parental leave records')

  // Get all users to match names
  const users = await prisma.user.findMany({
    select: { id: true, name: true }
  })

  console.log('Found users:', users.map(u => u.name).join(', '))

  for (const data of parentalLeaveData) {
    // Find user by first name (case insensitive)
    const user = users.find(u =>
      u.name?.toLowerCase().startsWith(data.userName.toLowerCase())
    )

    if (!user) {
      console.log(`Warning: User "${data.userName}" not found, skipping...`)
      continue
    }

    const { userName, ...leaveData } = data

    try {
      await prisma.parentalLeave.create({
        data: {
          userId: user.id,
          ...leaveData,
        }
      })
      console.log(`Created parental leave for ${user.name} (child ${data.childNumber})`)
    } catch (error) {
      console.error(`Error creating parental leave for ${user.name}:`, error)
    }
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
