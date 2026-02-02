import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // First, get all users to find the right IDs
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  })

  console.log('Found users:')
  users.forEach(u => console.log(`  ${u.name}: ${u.id}`))

  // Find users by first name
  const findUser = (firstName: string) => {
    const user = users.find(u => u.name.toLowerCase().startsWith(firstName.toLowerCase()))
    if (!user) {
      console.log(`WARNING: User "${firstName}" not found!`)
      return null
    }
    return user
  }

  const wies = findUser('Wies')
  const alain = findUser('Alain')
  const emma = findUser('Emma')
  const justine = findUser('Justine')
  const marlieke = findUser('Marlieke')

  // Delete existing parental leaves to avoid duplicates
  console.log('\nDeleting existing parental leaves...')
  await prisma.parentalLeave.deleteMany({})

  console.log('\nImporting parental leave data...\n')

  // Wies - Kind 1 (Olaf)
  if (wies) {
    await prisma.parentalLeave.create({
      data: {
        userId: wies.id,
        childNumber: 1,
        kindNaam: 'Olaf',
        kindGeboorteDatum: new Date('2024-01-20'),
        zwangerschapsverlofStatus: 'WAZO 16 weken ontvangen',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 324,
        betaaldVerlofDetails: '1 augustus 2024 ingegaan. 9 weken opgenomen.',
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 21,
        onbetaaldVerlofDetails: '3-16 okt (10 dagen), 1-15 nov (11 dagen). Vanaf 16 nov elke maandag. 64 dagen over.',
        uwvAangevraagd: true,
        uwvDetails: 'Goedgekeurd. WAZO en 9 weken betaald O.V. ontvangen.',
        note: 'WAZO en 9 weken betaald O.V. ontvangen van UWV'
      }
    })
    console.log('✓ Wies - Kind 1 (Olaf) toegevoegd')

    // Wies - Kind 2 (uitgerekend 17 april 2026)
    await prisma.parentalLeave.create({
      data: {
        userId: wies.id,
        childNumber: 2,
        uitgerekendeDatum: new Date('2026-04-17'),
        zwangerschapsverlofStart: new Date('2026-03-06'),
        zwangerschapsverlofStatus: 'Verlof vanaf 6 maart 2026',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 0,
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 0,
        uwvAangevraagd: false,
        note: 'Uitgerekend 17 april 2026'
      }
    })
    console.log('✓ Wies - Kind 2 (uitgerekend) toegevoegd')
  }

  // Alain - Kind (Jibbi)
  if (alain) {
    await prisma.parentalLeave.create({
      data: {
        userId: alain.id,
        childNumber: 1,
        kindNaam: 'Jibbi',
        kindGeboorteDatum: new Date('2025-07-06'),
        geboorteverlofPartner: '1 week geboorteverlof opgenomen',
        aanvullendVerlofPartner: '5 weken aanvullend verlof opgenomen',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 138.66,
        betaaldVerlofDetails: '138.66 van 324 uur opgenomen. 185.34 uur (23 dagen) over. Vanaf februari, na 6 feb nog 19 dagen over.',
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 0,
        uwvAangevraagd: true,
        uwvDetails: 'Goedgekeurd. Aanvullend partnerverlof en 9 weken betaald O.V. ontvangen.',
        note: 'Aanvullend partnerverlof en 9 weken betaald O.V. ontvangen van UWV'
      }
    })
    console.log('✓ Alain - Kind (Jibbi) toegevoegd')
  }

  // Emma - Kind (uitgerekend 22 feb 2026)
  if (emma) {
    await prisma.parentalLeave.create({
      data: {
        userId: emma.id,
        childNumber: 1,
        uitgerekendeDatum: new Date('2026-02-22'),
        zwangerschapsverlofStart: new Date('2026-01-12'),
        zwangerschapsverlofStatus: 'Verlof vanaf 12 jan, gepland retour 18 mei 2026',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 72,
        betaaldVerlofDetails: '4-15 mei (2 weken) betaald opgenomen. Vanaf 21 mei elke donderdag. 30 dagen over. Laatste dag betaald O.V.: 10 december 2026.',
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 0,
        onbetaaldVerlofDetails: 'Vanaf 17 december elke donderdag onbetaald verlof.',
        uwvAangevraagd: false,
        note: 'Uitgerekend 22 februari 2026. Verwerken in mei!'
      }
    })
    console.log('✓ Emma - Kind toegevoegd')
  }

  // Justine - Kind 1 (Emma)
  if (justine) {
    await prisma.parentalLeave.create({
      data: {
        userId: justine.id,
        childNumber: 1,
        kindNaam: 'Emma',
        kindGeboorteDatum: new Date('2024-07-03'),
        zwangerschapsverlofStatus: 'WAZO 16 weken ontvangen',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 324,
        betaaldVerlofDetails: '9 weken opgenomen, 23 april laatste dag betaald verlof.',
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 52,
        onbetaaldVerlofDetails: 'Vanaf 30 april elke woensdag. Tot baby 2: 52 dagen opgenomen.',
        uwvAangevraagd: true,
        uwvDetails: 'Goedgekeurd. WAZO en 9 weken betaald O.V. ontvangen.',
        note: 'WAZO en 9 weken betaald O.V. ontvangen van UWV'
      }
    })
    console.log('✓ Justine - Kind 1 (Emma) toegevoegd')

    // Justine - Kind 2
    await prisma.parentalLeave.create({
      data: {
        userId: justine.id,
        childNumber: 2,
        zwangerschapsverlofStart: new Date('2026-04-25'),
        zwangerschapsverlofStatus: 'Verlof vanaf 25 april (6 weken voor uitgerekende datum)',
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 0,
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 0,
        uwvAangevraagd: false,
        note: 'Gaat 25 april met verlof (6 weken voor uitgerekende datum)'
      }
    })
    console.log('✓ Justine - Kind 2 toegevoegd')
  }

  // Marlieke - Kind (Luuk)
  if (marlieke) {
    await prisma.parentalLeave.create({
      data: {
        userId: marlieke.id,
        childNumber: 1,
        kindNaam: 'Luuk',
        kindGeboorteDatum: new Date('2025-06-13'),
        // Zwangerschapsverlof was in 2025, niet meer tonen
        betaaldTotaalUren: 324,
        betaaldOpgenomenUren: 216,
        betaaldVerlofDetails: '19 sept - 3 okt (11 dagen). Vanaf 6 okt elke vrijdag. Laatste dag betaald O.V.: 24 april 2026.',
        onbetaaldTotaalDagen: 85,
        onbetaaldOpgenomenDagen: 0,
        uwvAangevraagd: true,
        uwvDetails: 'Goedgekeurd voor WAZO en 6 weken betaald O.V. MOET NOG 3 WEKEN AANVRAGEN!',
        note: 'WAZO en 6 weken betaald O.V. ontvangen. MOET NOG 3 WEKEN AANVRAGEN BIJ UWV!'
      }
    })
    console.log('✓ Marlieke - Kind (Luuk) toegevoegd')
  }

  console.log('\n✅ Import voltooid!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
