// Idempotent: maakt OfficeTask + OfficeTaskCompletion aan, en seed default tasks
// uit Hanna's lijst als er nog geen taken staan.

import { PrismaClient } from '@prisma/client'

const DEFAULT_TASKS: Array<{ category: string; title: string; frequency: string }> = [
  // Administratie en facturatie
  { category: 'administratie', title: 'Salaris + management fee overmaken', frequency: 'monthly' },
  { category: 'administratie', title: 'Betalen facturen', frequency: 'weekly' },
  { category: 'administratie', title: 'Belastingfacturen betalen', frequency: 'monthly' },
  { category: 'administratie', title: 'Bankafschriften afvinken in Basenet', frequency: 'weekly' },
  { category: 'administratie', title: 'Bankafschriften: kostenoverzicht per maand bijhouden', frequency: 'monthly' },
  { category: 'administratie', title: 'Herinneringen sturen (open posten)', frequency: 'weekly' },
  { category: 'administratie', title: 'Versturen van facturen (declaraties) + aanmaken en verzenden', frequency: 'monthly' },
  { category: 'administratie', title: 'Tenaamstelling facturen + vragen mails hierover beantwoorden', frequency: 'weekly' },
  { category: 'administratie', title: 'Declaratieformulieren uit dashboard halen en betalen', frequency: 'monthly' },
  { category: 'administratie', title: 'Uren / declaraties checken voor advocaten', frequency: 'monthly' },

  // Documenten & verwerking
  { category: 'documenten', title: 'Documenten inscannen (algemeen)', frequency: 'daily' },
  { category: 'documenten', title: 'Post ontvangen + inscannen', frequency: 'daily' },
  { category: 'documenten', title: 'Facturen en bonnen inscannen → inladen in Trifact + verwerken', frequency: 'weekly' },
  { category: 'documenten', title: 'Exact (en contact met Norm finance)', frequency: 'monthly' },
  { category: 'documenten', title: 'Nota\'s inscannen + dossier zetten en betalen', frequency: 'weekly' },

  // Juridische ondersteuning
  { category: 'juridisch', title: 'Stukken printen voor advocaten', frequency: 'daily' },
  { category: 'juridisch', title: 'Inbinden', frequency: 'weekly' },
  { category: 'juridisch', title: 'Doxflow (producties regelen)', frequency: 'weekly' },
  { category: 'juridisch', title: 'Printopdrachten', frequency: 'daily' },

  // Kantoorbeheer & bestellingen
  { category: 'kantoorbeheer', title: 'Kantoorspullen bestellen', frequency: 'monthly' },
  { category: 'kantoorbeheer', title: 'Kantoorspullen kopen (Hema oid)', frequency: 'monthly' },
  { category: 'kantoorbeheer', title: 'Papier bestellen (Joeri)', frequency: 'monthly' },
  { category: 'kantoorbeheer', title: 'Cadeaus bestellen voor medewerkers', frequency: 'monthly' },
  { category: 'kantoorbeheer', title: 'Koffie bestellen (evt. abonnement BoonChance)', frequency: 'monthly' },

  // Facilitair dagelijks
  { category: 'facilitair', title: 'Lunch maken', frequency: 'daily' },
  { category: 'facilitair', title: 'Brood halen (Vlaams broodhuys)', frequency: 'daily' },
  { category: 'facilitair', title: 'Snacks bijvullen', frequency: 'weekly' },
  { category: 'facilitair', title: 'Albert Heijn bestellingen', frequency: 'weekly' },
  { category: 'facilitair', title: 'Koffiemachines ontkalken + filter vervangen', frequency: 'monthly' },
  { category: 'facilitair', title: 'Planten water geven (boven en beneden)', frequency: 'weekly' },
  { category: 'facilitair', title: 'Bel + deur', frequency: 'daily' },
  { category: 'facilitair', title: 'Intern + borrels / JAR / Cursus / Intervisie klaarzetten boven', frequency: 'monthly' },
  { category: 'facilitair', title: 'Klanten aannemen beneden (koffie aanbieden + broodjes zerozero)', frequency: 'daily' },
  { category: 'facilitair', title: 'JAR certificaten + deelnemerslijst', frequency: 'monthly' },
  { category: 'facilitair', title: 'Certificaten maken intervisie + facturen uitsturen', frequency: 'monthly' },
  { category: 'facilitair', title: 'JAR data overzicht maken', frequency: 'monthly' },
  { category: 'facilitair', title: 'Borrels voorbereiden + extra AH boodschappen halen', frequency: 'monthly' },

  // Communicatie
  { category: 'communicatie', title: 'Telefoon opnemen', frequency: 'daily' },
  { category: 'communicatie', title: 'Mail administratie / officemanagement / info beantwoorden', frequency: 'daily' },

  // Post & logistiek
  { category: 'post', title: 'Post ontvangen (pakketten)', frequency: 'daily' },
  { category: 'post', title: 'Post inscannen (rechtbank)', frequency: 'daily' },
  { category: 'post', title: 'Koerierdienst contact', frequency: 'weekly' },
  { category: 'post', title: 'Karton / glas wegbrengen', frequency: 'weekly' },

  // Overig
  { category: 'overig', title: 'Hand- en theedoeken wassen', frequency: 'weekly' },
  { category: 'overig', title: 'Opruimen kantoor / schoon houden / schermen / laptops leeghalen', frequency: 'daily' },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-office-tasks-tables] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficeTask" (
        "id" TEXT PRIMARY KEY,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "assigneeId" TEXT,
        "assigneeName" TEXT,
        "frequency" TEXT NOT NULL DEFAULT 'once',
        "isArchived" BOOLEAN NOT NULL DEFAULT false,
        "position" INTEGER NOT NULL DEFAULT 0,
        "lastCompletedAt" TIMESTAMP(3),
        "lastCompletedById" TEXT,
        "lastCompletedByName" TEXT,
        "completedAt" TIMESTAMP(3),
        "completedById" TEXT,
        "completedByName" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeTask_category_idx" ON "OfficeTask"("category")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeTask_assigneeId_idx" ON "OfficeTask"("assigneeId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeTask_frequency_idx" ON "OfficeTask"("frequency")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OfficeTaskCompletion" (
        "id" TEXT PRIMARY KEY,
        "taskId" TEXT NOT NULL REFERENCES "OfficeTask"("id") ON DELETE CASCADE,
        "completedById" TEXT NOT NULL,
        "completedByName" TEXT NOT NULL,
        "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "note" TEXT
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeTaskCompletion_taskId_idx" ON "OfficeTaskCompletion"("taskId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "OfficeTaskCompletion_completedAt_idx" ON "OfficeTaskCompletion"("completedAt")
    `)

    // Seed default tasks alleen als de tabel leeg is
    const count = await prisma.officeTask.count()
    if (count === 0) {
      for (let i = 0; i < DEFAULT_TASKS.length; i++) {
        const t = DEFAULT_TASKS[i]
        await prisma.officeTask.create({
          data: { ...t, position: i },
        })
      }
      console.log(`[add-office-tasks-tables] ${DEFAULT_TASKS.length} default tasks geseed`)
    } else {
      console.log(`[add-office-tasks-tables] tabel niet leeg (${count} taken) — seed overgeslagen`)
    }
  } catch (err) {
    console.error('[add-office-tasks-tables] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
