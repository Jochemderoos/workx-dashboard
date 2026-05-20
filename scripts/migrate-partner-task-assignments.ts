// Eenmalig idempotent: zet bestaande PartnerTask.responsibleId-waardes ook
// om naar een PartnerTaskAssignment-record. Bij volgende builds: skip bestaande.

import { PrismaClient } from '@prisma/client'

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-partner-task-assignments] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    const tasks = await prisma.partnerTask.findMany({
      where: { responsibleId: { not: null } },
      select: { id: true, responsibleId: true },
    })
    let added = 0
    for (const task of tasks) {
      if (!task.responsibleId) continue
      const exists = await prisma.partnerTaskAssignment.findFirst({
        where: { taskId: task.id, userId: task.responsibleId },
        select: { id: true },
      })
      if (exists) continue
      try {
        await prisma.partnerTaskAssignment.create({
          data: { taskId: task.id, userId: task.responsibleId },
        })
        added++
      } catch {
        // Negeer race / dup
      }
    }
    console.log(`[migrate-partner-task-assignments] ${added} assignments aangemaakt`)
  } catch (err) {
    console.error('[migrate-partner-task-assignments] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
