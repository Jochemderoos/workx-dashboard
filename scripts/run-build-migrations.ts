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
import { main as addDashboardPinsTable } from './add-dashboard-pins-table'
import { main as addContractTypeColumns } from './add-contract-type-columns'
import { main as addBevriendeKantorenTable } from './add-bevriende-kantoren-table'
import { main as addEditablePolicyTable } from './add-editable-policy-table'
import { main as addOnboardingTables } from './add-onboarding-tables'
import { main as addJarTable } from './add-jar-table'
import { main as addJarSessionType } from './add-jar-session-type'
import { main as addCoachingBudgetTable } from './add-coaching-budget-table'
import { main as addPerformanceNotesTable } from './add-performance-notes-table'
import { main as addOfficeAttendanceTables } from './add-office-attendance-tables'
import { main as addWeekIntakeTable } from './add-week-intake-table'
import { main as addImportEventTable } from './add-import-event-table'
import { main as addRecruitmentTables } from './add-recruitment-tables'
import { main as addWorkxflowCoverFields } from './add-workxflow-cover-fields'
import { main as addTransitieNotes } from './add-transitie-notes'
import { main as addYearPlanTables } from './add-year-plan-tables'
import { main as addOfficeTasksTables } from './add-office-tasks-tables'
import { main as addCandidateConnectionsTable } from './add-candidate-connections-table'
import { main as addDevelopmentPlanItemsTable } from './add-development-plan-items-table'
import { main as addDevelopmentPlanReviewColumns } from './add-development-plan-review-columns'
import { main as addDevelopmentPlanAiSummaryColumns } from './add-development-plan-ai-summary-columns'
import { main as addTrainingCategoryColumns } from './add-training-category-columns'
import { main as addYearAgendaTable } from './add-year-agenda-table'
import { main as addWorkxOutingsTables } from './add-workx-outings-tables'
import { main as addWorkxSfeerPhotosTable } from './add-workx-sfeer-photos-table'
import { main as addWorkDistributionUpdatesTable } from './add-work-distribution-updates-table'
import { main as addAgendaAttachmentsColumns } from './add-agenda-attachments-columns'
import { main as addMonthlyCostExternalRefUnique } from './add-monthly-cost-externalref-unique'
import { main as addUserLoginTracking } from './add-user-login-tracking'
import { main as addStockPhotosTable } from './add-stock-photos-table'
import { main as addLustrumProgramPreferences } from './add-lustrum-program-preferences'
import { main as addPageViewsTable } from './add-page-views-table'
import { main as addInfoboxWeekTable } from './add-infobox-week-table'
import { main as addLustrumExtraTasksTable } from './add-lustrum-extra-tasks-table'
import { main as addMeetingRoomTable } from './add-meeting-room-table'
import { main as addFilmFeedbackTable } from './add-film-feedback-table'
import { main as addPartnerTaskExecutorsTable } from './add-partner-task-executors-table'
import { main as addOfficePhoneInfobox } from './add-office-phone-infobox'
import { main as addOfficeRequestsTable } from './add-office-requests-table'
import { main as claimLegacyTransitie } from './claim-legacy-transitie'
import { main as addDdGrandfatheredColumn } from './add-dd-grandfathered-column'
import { main as addVacationTypeOverrideColumns } from './add-vacation-type-override-columns'
import { main as addMailchimpContactsTable } from './add-mailchimp-contacts-table'
import { main as addMailchimpContactColumns } from './add-mailchimp-contact-columns'
import { main as addRecurringLeave } from './add-recurring-leave'
import { main as addUserAdresColumn } from './add-user-adres-column'

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
import { main as seedStockPhotos } from './seed-stock-photos'
import { main as seedStockPhotosOffice2026 } from './seed-stock-photos-office-2026'
import { main as seedDdGrandfathered } from './seed-dd-grandfathered'

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
  { name: 'add-dashboard-pins-table', run: addDashboardPinsTable },
  { name: 'add-contract-type-columns', run: addContractTypeColumns },
  { name: 'add-editable-policy-table', run: addEditablePolicyTable },
  { name: 'add-onboarding-tables', run: addOnboardingTables },
  { name: 'add-jar-table', run: addJarTable },
  { name: 'add-jar-session-type', run: addJarSessionType },
  { name: 'add-coaching-budget-table', run: addCoachingBudgetTable },
  { name: 'add-performance-notes-table', run: addPerformanceNotesTable },
  { name: 'add-office-attendance-tables', run: addOfficeAttendanceTables },
  { name: 'add-week-intake-table', run: addWeekIntakeTable },
  { name: 'add-import-event-table', run: addImportEventTable },
  { name: 'add-recruitment-tables', run: addRecruitmentTables },
  { name: 'add-workxflow-cover-fields', run: addWorkxflowCoverFields },
  { name: 'add-transitie-notes', run: addTransitieNotes },
  { name: 'add-year-plan-tables', run: addYearPlanTables },
  { name: 'add-office-tasks-tables', run: addOfficeTasksTables },
  { name: 'add-candidate-connections-table', run: addCandidateConnectionsTable },
  { name: 'add-development-plan-items-table', run: addDevelopmentPlanItemsTable },
  { name: 'add-development-plan-review-columns', run: addDevelopmentPlanReviewColumns },
  { name: 'add-development-plan-ai-summary-columns', run: addDevelopmentPlanAiSummaryColumns },
  { name: 'add-training-category-columns', run: addTrainingCategoryColumns },
  { name: 'add-year-agenda-table', run: addYearAgendaTable },
  { name: 'add-workx-outings-tables', run: addWorkxOutingsTables },
  { name: 'add-workx-sfeer-photos-table', run: addWorkxSfeerPhotosTable },
  { name: 'add-work-distribution-updates-table', run: addWorkDistributionUpdatesTable },
  { name: 'add-agenda-attachments-columns', run: addAgendaAttachmentsColumns },
  { name: 'add-monthly-cost-externalref-unique', run: addMonthlyCostExternalRefUnique },
  { name: 'add-user-login-tracking', run: addUserLoginTracking },
  { name: 'add-stock-photos-table', run: addStockPhotosTable },
  { name: 'add-lustrum-program-preferences', run: addLustrumProgramPreferences },
  { name: 'add-page-views-table', run: addPageViewsTable },
  { name: 'add-infobox-week-table', run: addInfoboxWeekTable },
  { name: 'add-lustrum-extra-tasks-table', run: addLustrumExtraTasksTable },
  { name: 'add-meeting-room-table', run: addMeetingRoomTable },
  { name: 'add-film-feedback-table', run: addFilmFeedbackTable },
  { name: 'add-partner-task-executors-table', run: addPartnerTaskExecutorsTable },
  { name: 'add-office-phone-infobox', run: addOfficePhoneInfobox },
  { name: 'add-office-requests-table', run: addOfficeRequestsTable },
  { name: 'claim-legacy-transitie', run: claimLegacyTransitie },
  { name: 'add-dd-grandfathered-column', run: addDdGrandfatheredColumn },
  { name: 'add-vacation-type-override-columns', run: addVacationTypeOverrideColumns },
  { name: 'add-mailchimp-contacts-table', run: addMailchimpContactsTable },
  { name: 'add-mailchimp-contact-columns', run: addMailchimpContactColumns },
  { name: 'add-recurring-leave', run: addRecurringLeave },
  { name: 'add-user-adres-column', run: addUserAdresColumn },
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
  { name: 'seed-stock-photos', run: seedStockPhotos },
  { name: 'seed-stock-photos-office-2026', run: seedStockPhotosOffice2026 },
  { name: 'seed-dd-grandfathered', run: seedDdGrandfathered },
]

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[run-build-migrations] geen DATABASE_URL — overslaan')
    return
  }

  const t0 = Date.now()
  console.log(`[run-build-migrations] start (${TASKS.length} taken, gedeelde Prisma-client)`)

  const prisma = new PrismaClient()
  const failures: string[] = []
  try {
    for (const task of TASKS) {
      const start = Date.now()
      try {
        await task.run(prisma)
        const dur = ((Date.now() - start) / 1000).toFixed(1)
        console.log(`  ✓ ${task.name} (${dur}s)`)
      } catch (err) {
        console.error(`  ✗ ${task.name} MISLUKT:`, err)
        failures.push(task.name)
      }
    }
  } finally {
    await prisma.$disconnect().catch(() => {})
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`[run-build-migrations] klaar in ${total}s`)

  // Faal de build expliciet als een migratie/seed mislukt is, zodat
  // schema-problemen niet pas in productie zichtbaar worden.
  if (failures.length > 0) {
    console.error(`[run-build-migrations] ${failures.length} taak/taken mislukt: ${failures.join(', ')} — build wordt afgebroken.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[run-build-migrations] fataal:', err)
  process.exit(1)
})
