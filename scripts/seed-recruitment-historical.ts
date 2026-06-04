// Seedt de historische kandidaten-lijst (BaseNet-letter, vorige ronde)
// in het normale recruitment-overzicht — onder een verborgen
// pseudo-user 'Eerdere ronde' (isActive: false zodat 'ie niet in
// teams/werkverdeling opdoemt). Idempotent: kandidaten worden
// gematcht op (entry, name) en bijgewerkt/aangemaakt.
//
// Alexander Collot d'Escury staat NIET in de lijst — werkt al bij Workx.

import { PrismaClient } from '@prisma/client'

const HISTORICAL_EMAIL = '_historical@workx.internal'
const HISTORICAL_NAME = 'Eerdere ronde'

interface HC {
  name: string
  office: string
  years: number
  status: 'niet_benaderd' | 'benaderd' | 'in_gesprek' | 'afgewezen' | 'aangenomen'
  notes: string
}

const HISTORICAL_CANDIDATES: HC[] = [
  { name: 'Juliette van der Beek', office: 'DLA', years: 7, status: 'in_gesprek', notes: 'Komt langs voor koffie.' },
  { name: 'Emma Boellaard', office: 'DLA', years: 3, status: 'in_gesprek', notes: 'Komt langs voor koffie.' },
  { name: 'Marije Ozinga', office: 'Dentons', years: 8, status: 'benaderd', notes: 'Eerder gesproken. Toen bal bij haar laten liggen omdat ze nog zoekende was.' },
  { name: 'Caspar Bosma', office: 'Lexence (eerder Barents Krantz)', years: 6, status: 'benaderd', notes: 'Eerder gesproken. Justine contact gehad. Zit nog op zijn plek bij Lexence.' },
  { name: 'Sanne Wouters', office: 'De Koning Vergouwen', years: 6, status: 'benaderd', notes: 'Eerder gesproken. Atypische achtergrond. Positief over persoon, maar geen plek voor haar profiel destijds.' },
  { name: 'Eva Bokslag', office: 'ACT', years: 7, status: 'benaderd', notes: 'Eerder gesproken. Leuk gesprek. Vermoedelijk geen corporate-ervaring + andere betere profielen destijds.' },
  { name: 'Puck Keurentjes', office: 'Vestius', years: 5, status: 'afgewezen', notes: 'Wies heeft bericht. Staat niet open voor overstap.' },
  { name: 'Erik Steenis', office: 'Liberdock (voorheen Lexence)', years: 7, status: 'niet_benaderd', notes: 'Waarschijnlijk korte-termijn partnerambities. Geen direct contact via medewerkers.' },
  { name: 'Claire Vogel', office: 'Van Doorne', years: 10, status: 'niet_benaderd', notes: 'Recent overgestapt van Bronsgeest Deur naar Lexence. Partnerambities onbekend.' },
  { name: 'Pieter de Ruiter', office: 'Pallas', years: 9, status: 'niet_benaderd', notes: 'Waarschijnlijk korte-termijn partnerambities. Veel medezeggenschap.' },
  { name: 'Fanny Sax', office: 'Bergh Stoop & Sanders', years: 9, status: 'niet_benaderd', notes: 'Ruime ervaring. Corporate-ervaring + partnerambities onbekend.' },
  { name: 'Renske van Herpen', office: 'Bronsgeest Deur', years: 5, status: 'niet_benaderd', notes: 'Niet bekend bij medewerkers.' },
  { name: 'Thomas van der Toorn', office: 'Bronsgeest Deur', years: 5, status: 'niet_benaderd', notes: 'Niet bekend bij medewerkers.' },
  { name: 'Maikel Doting', office: 'AKD', years: 3, status: 'niet_benaderd', notes: 'Erika kent hem.' },
  { name: 'Guido Brandt', office: 'Wieringa', years: 3, status: 'niet_benaderd', notes: 'Erika kent hem.' },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-recruitment-historical] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // Pseudo-user — isActive:false zodat 'ie nergens anders opduikt
    const user = await prisma.user.upsert({
      where: { email: HISTORICAL_EMAIL },
      create: {
        email: HISTORICAL_EMAIL,
        name: HISTORICAL_NAME,
        password: 'no-login-historical-pseudo-user',
        role: 'EMPLOYEE',
        isActive: false,
      },
      update: { isActive: false, name: HISTORICAL_NAME },
    })

    // Entry
    const entry = await prisma.recruitmentEntry.upsert({
      where: { userId: user.id },
      create: { userId: user.id, submittedAt: new Date() },
      update: {},
    })

    // Kandidaten — upsert per (entry, name)
    const existing = await prisma.recruitmentCandidate.findMany({
      where: { entryId: entry.id, type: 'candidate' },
    })
    const existingByName = new Map(existing.map(c => [c.name.trim().toLowerCase(), c]))

    let created = 0
    let updated = 0
    for (const c of HISTORICAL_CANDIDATES) {
      const key = c.name.trim().toLowerCase()
      const ex = existingByName.get(key)
      if (ex) {
        await prisma.recruitmentCandidate.update({
          where: { id: ex.id },
          data: {
            experienceYear: c.years,
            currentOffice: c.office,
            notes: c.notes,
            approachStatus: c.status,
          },
        })
        updated++
      } else {
        await prisma.recruitmentCandidate.create({
          data: {
            entryId: entry.id,
            type: 'candidate',
            name: c.name,
            experienceYear: c.years,
            currentOffice: c.office,
            inNetwork: false,
            notes: c.notes,
            approachStatus: c.status,
            sortOrder: 0,
          },
        })
        created++
      }
    }
    console.log(`[seed-recruitment-historical] ${created} aangemaakt, ${updated} bijgewerkt`)
  } catch (err) {
    console.error('[seed-recruitment-historical] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
