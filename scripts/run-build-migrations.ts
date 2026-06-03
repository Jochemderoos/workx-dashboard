// Eén tsx-proces voor alle build-time migraties + seeds.
// Voorheen: 40 losse `tsx scripts/X.ts && ...` (~3-5s opstart-overhead per script).
// Nu: één opstart, alles sequentieel in hetzelfde Node-proces.
//
// Volgorde MOET hetzelfde zijn als hoe build:vercel het deed,
// want sommige seeds hebben tabellen nodig die door eerdere DDL-scripts
// worden aangemaakt.

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
// Data-migraties en seeds
import { main as migrateHeleenReceipts } from './migrate-heleen-receipts'
import { main as migrateZzpToExtern } from './migrate-zzp-to-extern'
import { main as importMarnixHandover } from './import-marnix-handover-may-2026'
import { main as seedPartnerTasks } from './seed-partner-tasks'
import { main as seedMonthlyCosts2026 } from './seed-monthly-costs-2026'
import { main as migrateRemove2025Dividend } from './migrate-remove-2025-dividend'
import { main as migrateCleanupMt940 } from './migrate-cleanup-mt940-all-years'
import { main as seedMonthlyCosts2025 } from './seed-monthly-costs-2025'
import { main as seedMonthlyCosts2026Mt940 } from './seed-monthly-costs-2026-mt940'
import { main as seedUwvAsrHistoric } from './seed-uwv-asr-historic'
import { main as migrateZzpCategory } from './migrate-zzp-category'
import { main as migrateFixCategories } from './migrate-fix-categories'
import { main as migrateNectaroExBtw } from './migrate-nectaro-ex-btw'
import { main as seedOpenInvoiceDates } from './seed-open-invoice-dates'
import { main as migratePartnerTaskAssignments } from './migrate-partner-task-assignments'
import { main as seedBevriendeKantoren } from './seed-bevriende-kantoren'
import { main as seedEditablePolicies } from './seed-editable-policies'
import { main as seedOnboardingTemplates } from './seed-onboarding-templates'
import { main as seedJarRooster2026 } from './seed-jar-rooster-2026'
import { main as migratePitchAlainToAlexander } from './migrate-pitch-alain-to-alexander'
import { main as seedLustrumProgram } from './seed-lustrum-program'

const TASKS: { name: string; run: () => Promise<void> }[] = [
  // Schema-migraties (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
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
  // Data-migraties + seeds (volgorde gehandhaafd)
  { name: 'migrate-heleen-receipts', run: migrateHeleenReceipts },
  { name: 'migrate-zzp-to-extern', run: migrateZzpToExtern },
  { name: 'import-marnix-handover-may-2026', run: importMarnixHandover },
  { name: 'seed-partner-tasks', run: seedPartnerTasks },
  { name: 'seed-monthly-costs-2026', run: seedMonthlyCosts2026 },
  { name: 'migrate-remove-2025-dividend', run: migrateRemove2025Dividend },
  { name: 'migrate-cleanup-mt940-all-years', run: migrateCleanupMt940 },
  { name: 'seed-monthly-costs-2025', run: seedMonthlyCosts2025 },
  { name: 'seed-monthly-costs-2026-mt940', run: seedMonthlyCosts2026Mt940 },
  { name: 'seed-uwv-asr-historic', run: seedUwvAsrHistoric },
  { name: 'migrate-zzp-category', run: migrateZzpCategory },
  { name: 'migrate-fix-categories', run: migrateFixCategories },
  { name: 'migrate-nectaro-ex-btw', run: migrateNectaroExBtw },
  { name: 'seed-open-invoice-dates', run: seedOpenInvoiceDates },
  { name: 'migrate-partner-task-assignments', run: migratePartnerTaskAssignments },
  { name: 'seed-bevriende-kantoren', run: seedBevriendeKantoren },
  { name: 'seed-editable-policies', run: seedEditablePolicies },
  { name: 'seed-onboarding-templates', run: seedOnboardingTemplates },
  { name: 'seed-jar-rooster-2026', run: seedJarRooster2026 },
  { name: 'migrate-pitch-alain-to-alexander', run: migratePitchAlainToAlexander },
  { name: 'seed-lustrum-program', run: seedLustrumProgram },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[run-build-migrations] geen DATABASE_URL — overslaan')
    return
  }

  const t0 = Date.now()
  console.log(`[run-build-migrations] start (${TASKS.length} taken)`)

  for (const task of TASKS) {
    const start = Date.now()
    try {
      await task.run()
      const dur = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`  ✓ ${task.name} (${dur}s)`)
    } catch (err) {
      console.error(`  ✗ ${task.name} mislukt (build gaat door):`, err)
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[run-build-migrations] klaar in ${total}s`)
}

main()
