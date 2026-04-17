CREATE TABLE IF NOT EXISTS "SharedCredential" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Overig',
    "username" TEXT,
    "password" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SharedCredential_category_idx"
    ON "SharedCredential"("category");

DO $$ BEGIN
    ALTER TABLE "SharedCredential"
        ADD CONSTRAINT "SharedCredential_addedById_fkey"
        FOREIGN KEY ("addedById") REFERENCES "User"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
