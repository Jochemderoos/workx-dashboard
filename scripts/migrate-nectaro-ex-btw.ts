// Idempotent: zet de twee Nectaro (Lodewijk) facturen om naar excl. BTW
// bedragen. Externe-advocaat-kosten worden ex-BTW geadministreerd
// (afgetrokken in eigen aangifte), in tegenstelling tot reguliere
// kantoorkosten die incl. BTW staan zoals ze uit de bank komen.
//
// Verwijder dit script + buildchain-regel zodra geverifieerd is dat
// beide records de juiste bedragen hebben.

import { PrismaClient } from '@prisma/client'

interface Fix {
  year: number
  month: number
  oldAmount: number
  newAmount: number
}

const FIXES: Fix[] = [
  { year: 2026, month: 3, oldAmount: 2269.35, newAmount: 1875.08 },
  { year: 2026, month: 4, oldAmount: 9077.42, newAmount: 7501.17 },
]

const NEW_DESCRIPTION = 'Nectaro B.V. (Lodewijk) — excl. BTW'
const EPS = 0.01

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('[migrate-nectaro-ex-btw] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = new PrismaClient()
  try {
    let updated = 0
    let alreadyOk = 0
    for (const f of FIXES) {
      const candidates = await prisma.monthlyCost.findMany({
        where: {
          year: f.year,
          month: f.month,
          description: { contains: 'Nectaro' },
        },
      })
      let matched = false
      for (const c of candidates) {
        if (Math.abs(c.amount - f.newAmount) < EPS) {
          alreadyOk++
          matched = true
          break
        }
        if (Math.abs(c.amount - f.oldAmount) < EPS) {
          await prisma.monthlyCost.update({
            where: { id: c.id },
            data: {
              amount: f.newAmount,
              category: 'ZZP',
              description: NEW_DESCRIPTION,
            },
          })
          updated++
          matched = true
          break
        }
      }
      if (!matched) {
        console.log(`[migrate-nectaro-ex-btw] geen Nectaro-record gevonden voor ${f.year}-${String(f.month).padStart(2, '0')}`)
      }
    }
    console.log(`[migrate-nectaro-ex-btw] ${updated} aangepast naar excl. BTW, ${alreadyOk} stonden al goed`)
  } catch (err) {
    console.error('[migrate-nectaro-ex-btw] mislukt (build gaat door):', err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main()
