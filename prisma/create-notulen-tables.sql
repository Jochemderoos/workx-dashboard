-- Notulen tabellen aanmaken (veilig: IF NOT EXISTS)
-- Raakt GEEN bestaande tabellen aan

-- MeetingMonth - maandcontainer
CREATE TABLE IF NOT EXISTS "MeetingMonth" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "isLustrum" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingMonth_year_month_isLustrum_key" ON "MeetingMonth"("year", "month", "isLustrum");
CREATE INDEX IF NOT EXISTS "MeetingMonth_year_month_idx" ON "MeetingMonth"("year", "month");

-- MeetingWeek - wekelijkse vergadering
CREATE TABLE IF NOT EXISTS "MeetingWeek" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "monthId" TEXT NOT NULL,
  "meetingDate" TIMESTAMP(3) NOT NULL,
  "dateLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingWeek_monthId_fkey" FOREIGN KEY ("monthId") REFERENCES "MeetingMonth"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MeetingWeek_monthId_idx" ON "MeetingWeek"("monthId");
CREATE INDEX IF NOT EXISTS "MeetingWeek_meetingDate_idx" ON "MeetingWeek"("meetingDate");

-- MeetingTopic - agendapunt
CREATE TABLE IF NOT EXISTS "MeetingTopic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "remarks" TEXT,
  "isStandard" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingTopic_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "MeetingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MeetingTopic_weekId_sortOrder_idx" ON "MeetingTopic"("weekId", "sortOrder");

-- MeetingAction - actiepunt
CREATE TABLE IF NOT EXISTS "MeetingAction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "responsibleName" TEXT NOT NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingAction_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "MeetingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MeetingAction_weekId_idx" ON "MeetingAction"("weekId");
CREATE INDEX IF NOT EXISTS "MeetingAction_isCompleted_idx" ON "MeetingAction"("isCompleted");
CREATE INDEX IF NOT EXISTS "MeetingAction_responsibleName_idx" ON "MeetingAction"("responsibleName");

-- WorkDistribution - werkverdelingsgesprek
CREATE TABLE IF NOT EXISTS "WorkDistribution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "weekId" TEXT NOT NULL,
  "partnerName" TEXT NOT NULL,
  "employeeName" TEXT,
  "employeeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkDistribution_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "MeetingWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkDistribution_weekId_partnerName_key" ON "WorkDistribution"("weekId", "partnerName");
CREATE INDEX IF NOT EXISTS "WorkDistribution_weekId_idx" ON "WorkDistribution"("weekId");
CREATE INDEX IF NOT EXISTS "WorkDistribution_employeeId_idx" ON "WorkDistribution"("employeeId");
