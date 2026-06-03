// Eenmalige, idempotente migratie: zet Heleen's twee treinkaartjes (4 mei)
// — die in de oude Bonnetjes-tab stonden — over naar een DRAFT declaratie
// op haar naam. Draait bij Vercel build. Veilig om elke build opnieuw te
// draaien (skip als al uitgevoerd). Faalt nooit de build.
//
// Verwijder dit script + de buildCommand-regel in vercel.json zodra
// bevestigd dat Heleen de declaratie heeft gezien.

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-heleen] geen DATABASE_URL — overslaan')
    return
  }

  const prisma = externalPrisma ?? new PrismaClient()
  try {
    const heleen = await prisma.user.findFirst({
      where: { name: { startsWith: 'Heleen' } },
      select: { id: true, name: true, iban: true },
    })
    if (!heleen) {
      console.log('[migrate-heleen] Heleen niet gevonden — overslaan')
      return
    }

    const noteMarker = 'Overgezet uit Bonnetjes-tab (4 mei treinkaartjes)'
    const existing = await prisma.expenseDeclaration.findFirst({
      where: { userId: heleen.id, status: 'DRAFT', note: noteMarker },
      select: { id: true },
    })
    if (existing) {
      console.log(`[migrate-heleen] al uitgevoerd (${existing.id}) — overslaan`)
      return
    }

    const date = new Date('2026-05-04')
    const declaration = await prisma.expenseDeclaration.create({
      data: {
        userId: heleen.id,
        employeeName: heleen.name || 'Heleen',
        bankAccount: heleen.iban || '',
        totalAmount: 0,
        status: 'DRAFT',
        note: noteMarker,
        items: {
          create: [
            { description: 'Trein Amsterdam - Eindhoven', date, amount: 0, expenseType: 'overig' },
            { description: 'Trein Eindhoven - Amsterdam', date, amount: 0, expenseType: 'overig' },
          ],
        },
      },
      select: { id: true },
    })
    console.log(`[migrate-heleen] DRAFT aangemaakt: ${declaration.id}`)
  } catch (err) {
    console.error('[migrate-heleen] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()