// Eén tsx-proces, één gedeelde Prisma-client voor alle build-time
// migraties + seeds. Eenmalige scripts (afgeronde data-imports of
// historische seeds) zijn eruit gehaald — ze staan nog in scripts/
// voor standalone gebruik mocht een fresh-DB ooit nodig zijn.
//
// Bespaart t.o.v. de losse keten:
//   • ~40× tsx-opstart  (~2 min)
//   • ~40× Prisma client init + connect/disconnect (~30-60s)
//   • ~10 eenmalige scripts overgeslagen (~30-60s)

import { PrismaClient } from '@prisma/client'

// Schema-migraties — CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
// altijd safe om uit te voeren.
import { main as addPasswordAuditColumns } from './add-password-audit-columns'
import { main as addPartnerTaskTables } from './add-partner-task-tables'
import { main as addPartnerTaskAssignmentsTable } from './add-partner-task-assignments-table'
import { main as addMonthlyCostsTable } from './add-monthly-costs-table'
import { main as addMonthlyCostExternalRef } from './add-monthly-cost-external-ref'
import { main as addMonthlyCostCategory } from './add-monthly-cost-category'
import { main as addVendorAliasLearning } from './add-vendor-alias-learning'
import { main as addPersonalTasksTable } from './add-personal-tasks-table'
import { main as addOpenInvoicesTables } from './add-open-invoices-tables'
import { main as addOpenInvoiceDates } from './add-open-invoice-dates'
import { main as addBevriendeKantorenTable } from './add-bevriende-kantoren-table'
import { main as addEditablePolicyTable } from './add-editable-policy-table'
import { main as addOnboardingTables } from './add-onboarding-tables'
import { main as addJarTable } from './add-jar-table'
import { main as addCoachingBudgetTable } from './add-coaching-budget-table'
import { main as addPerformanceNotesTable } from './add-performance-notes-table'
import { main as addOfficeAttendanceTables } from './add-office-attendance-tables'
import { main as addWeekIntakeTable } from './add-week-intake-table'
import { main as addImportEventTable } from './add-import-event-table'
import { main as addRecruitmentTables } from './add-recruitment-tables'
import { main as addWorkxflowCoverFields } from './add-workxflow-cover-fields'

// Recurring seeds — idempotent en mogelijk nog uitbreidbaar.
import { main as seedPartnerTasks } from './seed-partner-tasks'
import { main as seedMonthlyCosts2026 } from './seed-monthly-costs-2026'
import { main as seedMonthlyCosts2026Mt940 } from './seed-monthly-costs-2026-mt940'
import { main as seedOpenInvoiceDates } from './seed-open-invoice-dates'
import { main as seedBevriendeKantoren } from './seed-bevriende-kantoren'
import { main as seedEditablePolicies } from './seed-editable-policies'
import { main as seedOnboardingTemplates } from './seed-onboarding-templates'
import { main as seedJarRooster2026 } from './seed-jar-rooster-2026'
import { main as seedLustrumProgram } from './seed-lustrum-program'
import { main as seedRecruitmentHistorical } from './seed-recruitment-historical'
import { main as seedLaetitia } from './seed-laetitia'

// Eenmalige migrations + dated seeds zijn bewust niet meer geïmporteerd.
// Indien een fresh-DB nodig is, draai ze handmatig (`npx tsx scripts/X.ts`):
//   - migrate-heleen-receipts
//   - migrate-zzp-to-extern
//   - migrate-remove-2025-dividend
//   - migrate-cleanup-mt940-all-years
//   - migrate-zzp-category
//   - migrate-fix-categories
//   - migrate-nectaro-ex-btw
//   - migrate-partner-task-assignments
//   - migrate-pitch-alain-to-alexander  (al gedraaid)
//   - import-marnix-handover-may-2026
//   - seed-monthly-costs-2025
//   - seed-uwv-asr-historic

const TASKS: { name: string; run: (p: PrismaClient) => Promise<void> }[] = [
  { name: 'add-password-audit-columns', run: addPasswordAuditColumns },
  { name: 'add-partner-task-tables', run: addPartnerTaskTables },
  { name: 'add-partner-task-assignments-table', run: addPartnerTaskAssignmentsTable },
  { name: 'add-monthly-costs-table', run: addMonthlyCostsTable },
  { name: 'add-monthly-cost-external-ref', run: addMonthlyCostExternalRef },
  { name: 'add-monthly-cost-category', run: addMonthlyCostCategory },
  { name: 'add-vendor-alias-learning', run: addVendorAliasLearning },
  { name: 'add-personal-tasks-table', run: addPersonalTasksTable },
  { name: 'add-open-invoices-tables', run: addOpenInvoicesTables },
  { name: 'add-open-invoice-dates', run: addOpenInvoiceDates },
  { name: 'add-bevriende-kantoren-table', run: addBevriendeKantorenTable },
  { name: 'add-editable-policy-table', run: addEditablePolicyTable },
  { name: 'add-onboarding-tables', run: addOnboardingTables },
  { name: 'add-jar-table', run: addJarTable },
  { name: 'add-coaching-budget-table', run: addCoachingBudgetTable },
  { name: 'add-performance-notes-table', run: addPerformanceNotesTable },
  { name: 'add-office-attendance-tables', run: addOfficeAttendanceTables },
  { name: 'add-week-intake-table', run: addWeekIntakeTable },
  { name: 'add-import-event-table', run: addImportEventTable },
  { name: 'add-recruitment-tables', run: addRecruitmentTables },
  { name: 'add-workxflow-cover-fields', run: addWorkxflowCoverFields },
  { name: 'seed-partner-tasks', run: seedPartnerTasks },
  { name: 'seed-monthly-costs-2026', run: seedMonthlyCosts2026 },
  { name: 'seed-monthly-costs-2026-mt940', run: seedMonthlyCosts2026Mt940 },
  { name: 'seed-open-invoice-dates', run: seedOpenInvoiceDates },
  { name: 'seed-bevriende-kantoren', run: seedBevriendeKantoren },
  { name: 'seed-editable-policies', run: seedEditablePolicies },
  { name: 'seed-onboarding-templates', run: seedOnboardingTemplates },
  { name: 'seed-jar-rooster-2026', run: seedJarRooster2026 },
  { name: 'seed-lustrum-program', run: seedLustrumProgram },
  { name: 'seed-recruitment-historical', run: seedRecruitmentHistorical },
  { name: 'seed-laetitia', run: seedLaetitia },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[run-build-migrations] geen DATABASE_URL — overslaan')
    return
  }

  const t0 = Date.now()
  console.log(`[run-build-migrations] start (${TASKS.length} taken, gedeelde Prisma-client)`)

  const prisma = new PrismaClient()
  try {
    for (const task of TASKS) {
      const start = Date.now()
      try {
        await task.run(prisma)
        const dur = ((Date.now() - start) / 1000).toFixed(1)
        console.log(`  ✓ ${task.name} (${dur}s)`)
      } catch (err) {
        console.error(`  ✗ ${task.name} mislukt (build gaat door):`, err)
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[run-build-migrations] klaar in ${total}s`)
}

main()
