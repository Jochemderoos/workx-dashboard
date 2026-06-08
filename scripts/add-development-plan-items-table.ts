// Idempotent: maakt DevelopmentPlanItem + DevelopmentPlanEvaluation aan
// en migreert bestaande DevelopmentPlan.sections JSON naar item-rijen.
// Migreert ook eventuele YearPlan(+items) records naar DevelopmentPlan(+items)
// zodat Mijn Jaarplan en Ontwikkelplannen samenkomen.

import { PrismaClient } from '@prisma/client'

type LegacySection = { number?: number; title?: string; goals?: string; evaluation?: string }

function deriveCategory(title: string | undefined, number: number | undefined): string {
  const t = (title || '').toLowerCase()
  if (t.includes('theor')) return 'inhoud-theorie'
  if (t.includes('eigen')) return 'eigen-praktijk'
  if (t.includes('acquisitie')) return 'eigen-praktijk'
  if (t.includes('intern')) return 'intern'
  if (t.includes('praktijk')) return 'inhoud-praktijk'
  // Fallback op positie 1..4
  switch (number || 0) {
    case 1: return 'inhoud-theorie'
    case 2: return 'inhoud-praktijk'
    case 3: return 'eigen-praktijk'
    case 4: return 'intern'
    default: return 'inhoud-theorie'
  }
}

function mapYearPlanCategory(c: string): string {
  switch (c) {
    case 'theorie': return 'inhoud-theorie'
    case 'praktijk': return 'inhoud-praktijk'
    case 'acquisitie': return 'eigen-praktijk'
    case 'intern': return 'intern'
    default: return 'inhoud-theorie'
  }
}

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[add-development-plan-items-table] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // ── Tabellen aanmaken ──────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DevelopmentPlanItem" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE,
        "category" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "goals" TEXT,
        "evaluation" TEXT,
        "status" TEXT NOT NULL DEFAULT 'todo',
        "progress" INTEGER NOT NULL DEFAULT 0,
        "targetDate" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "position" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DevelopmentPlanItem_planId_idx" ON "DevelopmentPlanItem"("planId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DevelopmentPlanItem_category_idx" ON "DevelopmentPlanItem"("category")
    `)

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DevelopmentPlanEvaluation" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE,
        "evaluatorId" TEXT NOT NULL,
        "evaluatorName" TEXT NOT NULL,
        "notes" TEXT NOT NULL,
        "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DevelopmentPlanEvaluation_planId_idx" ON "DevelopmentPlanEvaluation"("planId")
    `)
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "DevelopmentPlanEvaluation_evaluatorId_idx" ON "DevelopmentPlanEvaluation"("evaluatorId")
    `)

    // ── Migreer DevelopmentPlan.sections → items ────────────────────────
    const plans = await prisma.developmentPlan.findMany({
      select: { id: true, sections: true, generalNotes: true, evaluationDate: true, userId: true, employeeName: true },
    })

    let createdItems = 0
    let createdEvals = 0
    for (const plan of plans) {
      // Skip als plan al items heeft
      const existingItemCount = await prisma.developmentPlanItem.count({ where: { planId: plan.id } })
      if (existingItemCount > 0) continue

      let sections: LegacySection[] = []
      try {
        const parsed = JSON.parse(plan.sections || '[]')
        if (Array.isArray(parsed)) sections = parsed
      } catch {
        sections = []
      }

      for (let i = 0; i < sections.length; i++) {
        const s = sections[i]
        const category = deriveCategory(s.title, s.number)
        await prisma.developmentPlanItem.create({
          data: {
            planId: plan.id,
            category,
            title: (s.title || '').trim() || 'Onderdeel',
            goals: s.goals?.trim() || null,
            evaluation: s.evaluation?.trim() || null,
            status: 'todo',
            progress: 0,
            position: i,
          },
        })
        createdItems++
      }

      // Migreer eenmalige generalNotes/evaluationDate → één DevelopmentPlanEvaluation
      if (plan.generalNotes?.trim()) {
        const existingEval = await prisma.developmentPlanEvaluation.count({ where: { planId: plan.id } })
        if (existingEval === 0) {
          await prisma.developmentPlanEvaluation.create({
            data: {
              planId: plan.id,
              evaluatorId: plan.userId || 'legacy',
              evaluatorName: 'Legacy (algemene opmerkingen)',
              notes: plan.generalNotes.trim(),
              evaluatedAt: plan.evaluationDate || new Date(),
            },
          })
          createdEvals++
        }
      }
    }

    // ── Migreer YearPlan(+items/evals) → DevelopmentPlan(+items/evals) ──
    // YearPlan tabel kan ontbreken op een fresh DB — daarom dynamisch checken.
    const yearPlanTableExists = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'YearPlan') AS exists`
    )
    const hasYearPlan = Array.isArray(yearPlanTableExists) && (yearPlanTableExists[0] as any)?.exists === true

    let migratedYearPlans = 0
    if (hasYearPlan) {
      const yearPlans = await prisma.yearPlan.findMany({
        include: {
          items: true,
          evaluations: true,
        },
      })

      for (const yp of yearPlans) {
        const user = await prisma.user.findUnique({ where: { id: yp.userId }, select: { id: true, name: true } })
        if (!user) continue

        // Zoek bestaand DevelopmentPlan voor zelfde user+year
        let dp = await prisma.developmentPlan.findFirst({
          where: { userId: user.id, year: yp.year },
        })

        // Skip als items al gemigreerd zijn voor dit plan
        if (dp) {
          const existingItemCount = await prisma.developmentPlanItem.count({ where: { planId: dp.id } })
          if (existingItemCount > 0 && yp.items.length === 0) continue
          // Als er al items zijn én YearPlan items, dan was deze migratie al gedaan — skip
          if (existingItemCount >= yp.items.length && yp.items.length > 0) continue
        }

        // Maak DevelopmentPlan aan als die nog niet bestaat
        if (!dp) {
          dp = await prisma.developmentPlan.create({
            data: {
              userId: user.id,
              employeeName: user.name,
              period: `${yp.year}`,
              year: yp.year,
              sections: '[]',
              status: 'actief',
            },
          })
        }

        // Items overzetten
        for (const it of yp.items) {
          await prisma.developmentPlanItem.create({
            data: {
              planId: dp.id,
              category: mapYearPlanCategory(it.category),
              title: it.title,
              goals: it.description || null,
              evaluation: null,
              status: it.status,
              progress: it.progress,
              targetDate: it.targetDate,
              completedAt: it.completedAt,
              position: it.position,
              createdAt: it.createdAt,
              updatedAt: it.updatedAt,
            },
          })
          createdItems++
        }

        // Evaluaties overzetten
        for (const ev of yp.evaluations) {
          await prisma.developmentPlanEvaluation.create({
            data: {
              planId: dp.id,
              evaluatorId: ev.evaluatorId,
              evaluatorName: ev.evaluatorName,
              notes: ev.notes,
              evaluatedAt: ev.evaluatedAt,
            },
          })
          createdEvals++
        }

        migratedYearPlans++
      }
    }

    console.log(
      `[add-development-plan-items-table] klaar — ${createdItems} items, ${createdEvals} evaluaties, ${migratedYearPlans} YearPlans gemigreerd`
    )
  } catch (err) {
    console.error('[add-development-plan-items-table] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
