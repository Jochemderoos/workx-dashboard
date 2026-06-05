// Eenmalige migratie: oude variant-records sloegen amount = base × multiplier op.
// Nieuwe semantiek: amount = base (wettelijke TV), effectief = amount × multiplier.
// Dit script deelt amount door multiplier voor records waar multiplier ≠ 1 en
// het bedrag duidelijk de vermenigvuldigde waarde lijkt.

import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  try {
    const all = await prisma.transitieCalculation.findMany({
      select: { id: true, employeeName: true, amount: true, amountBeforeMax: true, multiplier: true },
    })
    let fixed = 0
    for (const c of all) {
      const m = c.multiplier ?? 1
      if (m === 1 || m === null) continue
      // Heuristiek: als amount > amountBeforeMax × m × 0.99 (within rounding), het is
      // al pre-multiplied (oude opslag-semantiek). Anders niets doen.
      const base = c.amountBeforeMax
      if (!base) continue
      const expectedMultiplied = base * m
      if (Math.abs(c.amount - expectedMultiplied) < Math.max(1, expectedMultiplied * 0.005)) {
        // amount = base × multiplier (oude opslag) → reset naar base
        await prisma.transitieCalculation.update({
          where: { id: c.id },
          data: { amount: base },
        })
        console.log(`✓ ${c.employeeName || c.id}: amount ${c.amount.toFixed(2)} → ${base.toFixed(2)} (× ${m})`)
        fixed++
      } else {
        console.log(`- ${c.employeeName || c.id}: geen aanpassing (amount ${c.amount.toFixed(2)}, base ${base.toFixed(2)}, m ${m})`)
      }
    }
    console.log(`\n${fixed} records aangepast.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
