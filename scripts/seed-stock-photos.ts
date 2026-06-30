// Seedt de Workx stock-foto's (38 kantoorfoto's in public/stock-fotos/).
// Idempotent: bestaande rijen met hetzelfde url worden overgeslagen.

import { PrismaClient } from '@prisma/client'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'
const COUNT = 38

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-stock-photos] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // Uploader: Jochem, anders een willekeurige PARTNER/ADMIN.
    let uploader = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } })
    if (!uploader) {
      uploader = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'PARTNER'] } }, select: { id: true } })
    }
    if (!uploader) {
      console.log('[seed-stock-photos] geen uploader gevonden — overslaan')
      return
    }

    let created = 0
    for (let i = 1; i <= COUNT; i++) {
      const nn = String(i).padStart(2, '0')
      const url = `/stock-fotos/WORKX_OFFICE_${nn}.jpg`
      const exists = await prisma.stockPhoto.findFirst({ where: { url }, select: { id: true } })
      if (exists) continue
      await prisma.stockPhoto.create({
        data: { url, category: 'Kantoor', sortOrder: i, uploadedById: uploader.id },
      })
      created++
    }
    console.log(`[seed-stock-photos] klaar — ${created} nieuw toegevoegd (van ${COUNT})`)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
