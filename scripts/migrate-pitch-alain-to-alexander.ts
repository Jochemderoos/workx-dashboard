// Idempotent: vervang Alain Heunen door Alexander Collot d'Escury in
// pitch-document records. Alain is uit dienst, Alexander zit nu op
// pagina 24 van de pitch-pdf.

import { PrismaClient } from '@prisma/client'

const OLD_NAME = 'Alain Heunen'
const NEW_NAME = "Alexander Collot d'Escury"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-pitch-alain-to-alexander] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const candidates = await prisma.pitchDocument.findMany({
      where: {
        OR: [
          { teamMemberName: OLD_NAME },
          { label: OLD_NAME },
        ],
      },
    })
    let updated = 0
    for (const doc of candidates) {
      await prisma.pitchDocument.update({
        where: { id: doc.id },
        data: {
          teamMemberName: doc.teamMemberName === OLD_NAME ? NEW_NAME : doc.teamMemberName,
          label: doc.label === OLD_NAME ? NEW_NAME : doc.label,
          name: doc.name?.includes('alain') ? doc.name.replace(/alain[-_]?heunen/i, 'alexander-collot') : doc.name,
        },
      })
      updated++
    }
    console.log(`[migrate-pitch-alain-to-alexander] ${updated} pitch-records bijgewerkt`)
  } catch (err) {
    console.error('[migrate-pitch-alain-to-alexander] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
