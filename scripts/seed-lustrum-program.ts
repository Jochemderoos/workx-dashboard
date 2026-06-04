// Idempotente seed van het lustrum-dagprogramma (Mallorca, 30 sep – 4 okt 2026).
// Matcht op date + title — bestaande items worden niet overschreven of dubbel
// aangemaakt. Verwijderde items (door partners via UI) blijven verwijderd.

import { PrismaClient } from '@prisma/client'

interface ProgramSeed {
  date: string
  time: string | null
  title: string
  description: string | null
  responsible: string[]
}

const PROGRAM: ProgramSeed[] = [
  // Woensdag 30 september — aankomstdag
  { date: '2026-09-30', time: '12:15', title: 'Vertrek vlucht', description: 'Aankomst Mallorca rond 14:40', responsible: [] },
  { date: '2026-09-30', time: '19:00', title: 'Themafeest & poolparty', description: 'Diner in huis', responsible: [] },

  // Donderdag 1 oktober
  { date: '2026-10-01', time: '09:00', title: 'Ontbijt in huis', description: null, responsible: [] },
  { date: '2026-10-01', time: '13:00', title: 'Wandelen Port de Sóller – Deià', description: 'Lunch op andere locatie', responsible: [] },
  { date: '2026-10-01', time: '19:00', title: 'Diner in Palma & rooftopbar', description: null, responsible: [] },

  // Vrijdag 2 oktober
  { date: '2026-10-02', time: '09:00', title: 'Ontbijt in huis', description: null, responsible: [] },
  { date: '2026-10-02', time: '13:00', title: 'Zelf in te vullen vrije dag', description: 'denk aan:', responsible: [] },
  { date: '2026-10-02', time: '21:00', title: 'Club in Palma', description: null, responsible: ['Hanna Blaauboer'] },

  // Zaterdag 3 oktober
  { date: '2026-10-03', time: '09:00', title: 'Ontbijt in huis', description: null, responsible: [] },
  { date: '2026-10-03', time: '13:00', title: 'Boot varen & snorkelen', description: 'Lunch op het strand', responsible: [] },
  { date: '2026-10-03', time: '20:00', title: 'Workx Awards & Movie Night', description: 'Diner in huis — sterren, statuettes en stiekem een traan', responsible: [] },

  // Zondag 4 oktober — vertrekdag
  { date: '2026-10-04', time: '10:25', title: 'Vertrek vlucht', description: 'Tot volgende keer, Mallorca!', responsible: [] },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-lustrum-program] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // Eenmalige rename: Spelletjes-avond → Workx Awards & Movie Night
    await prisma.lustrumProgram.updateMany({
      where: { date: '2026-10-03', title: 'Spelletjes-avond' },
      data: {
        title: 'Workx Awards & Movie Night',
        time: '20:00',
        description: 'Diner in huis — sterren, statuettes en stiekem een traan',
      },
    })
    // Eenmalige rename: Vrije middag €50 → Zelf in te vullen vrije dag
    await prisma.lustrumProgram.updateMany({
      where: { date: '2026-10-02', title: 'Vrije middag — €50 vrije besteding' },
      data: {
        title: 'Zelf in te vullen vrije dag',
        description: 'denk aan:',
      },
    })

    const existing = await prisma.lustrumProgram.findMany({
      select: { date: true, title: true },
    })
    const existingSet = new Set(existing.map(e => `${e.date}|${e.title}`))

    let created = 0
    for (const item of PROGRAM) {
      const key = `${item.date}|${item.title}`
      if (existingSet.has(key)) continue
      await prisma.lustrumProgram.create({
        data: {
          date: item.date,
          time: item.time,
          title: item.title,
          description: item.description,
          responsible: JSON.stringify(item.responsible),
        },
      })
      created++
    }
    console.log(`[seed-lustrum-program] ${created} nieuwe items toegevoegd (${PROGRAM.length - created} bestonden al)`)
  } catch (err) {
    console.error('[seed-lustrum-program] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect()
  }
}

if (require.main === module) main()