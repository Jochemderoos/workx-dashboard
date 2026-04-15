-- Voer dit handmatig uit op de productie database (gedeeld met study-hub).
-- npx prisma db push is geblokkeerd via prisma/guard.js.
--
-- Aanmaken tabel voor "Mededelingen toevoegen" feature.

CREATE TABLE IF NOT EXISTS "TeamAnnouncement" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TeamAnnouncement_createdAt_idx"
    ON "TeamAnnouncement"("createdAt");

ALTER TABLE "TeamAnnouncement"
    ADD CONSTRAINT "TeamAnnouncement_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Extra kolommen voor icoon-picker, custom titel en bewerken (mag los gedraaid worden):
ALTER TABLE "TeamAnnouncement"
    ADD COLUMN IF NOT EXISTS "icon" TEXT;

ALTER TABLE "TeamAnnouncement"
    ADD COLUMN IF NOT EXISTS "title" TEXT;

ALTER TABLE "TeamAnnouncement"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
