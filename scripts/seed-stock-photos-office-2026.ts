// Seedt de professionele kantoorfoto's (kleur + zwart-wit) in public/stock-fotos/
// (bestanden color-*.jpg en bw-*.jpg). Idempotent: bestaande url's worden
// overgeslagen. Categorie volgt uit de bestandsnaam.

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-stock-photos-office-2026] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    const dir = path.join(process.cwd(), 'public', 'stock-fotos')
    if (!fs.existsSync(dir)) { console.log('[seed-stock-photos-office-2026] map ontbreekt — overslaan'); return }
    const files = fs.readdirSync(dir).filter(f => /^(color|bw)-.*\.jpg$/i.test(f)).sort()
    if (files.length === 0) { console.log('[seed-stock-photos-office-2026] geen bestanden'); return }

    let uploader = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } })
    if (!uploader) uploader = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'PARTNER'] } }, select: { id: true } })
    if (!uploader) { console.log('[seed-stock-photos-office-2026] geen uploader'); return }

    const maxRow = await prisma.stockPhoto.aggregate({ _max: { sortOrder: true } })
    let sort = (maxRow._max.sortOrder || 0) + 1

    let created = 0
    for (const f of files) {
      const url = `/stock-fotos/${f}`
      const exists = await prisma.stockPhoto.findFirst({ where: { url }, select: { id: true } })
      if (exists) continue
      const category = /^bw-/i.test(f) ? 'Zwart-wit' : 'Kleur'
      await prisma.stockPhoto.create({ data: { url, category, sortOrder: sort++, uploadedById: uploader.id } })
      created++
    }
    console.log(`[seed-stock-photos-office-2026] klaar — ${created} nieuw (van ${files.length})`)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()
