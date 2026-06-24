// Idempotent: voegt 'attachments' (JSON-tekst) toe aan agendapunten van zowel
// de partner-notulen (MeetingTopic) als het werkoverleg (WerkoverlegAgendaItem).

import { PrismaClient } from '@prisma/client'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-agenda-attachments-columns] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "MeetingTopic" ADD COLUMN IF NOT EXISTS "attachments" TEXT`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "WerkoverlegAgendaItem" ADD COLUMN IF NOT EXISTS "attachments" TEXT`)
    console.log('[add-agenda-attachments-columns] klaar')
  } catch (err) {
    console.error('[add-agenda-attachments-columns] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
