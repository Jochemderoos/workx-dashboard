// Eenmalig: zet het VAAN AR-updaterooster (sep 2026 – aug 2027) in de
// rooster-tabel, en maakt presentielijsten aan voor zowel die VAAN-updates
// als de laatste zes JAR-bijeenkomsten van 2026.
//
// Draaien:
//   npx tsx scripts/seed-vaan-rooster.ts            → dry-run, schrijft niets
//   npx tsx scripts/seed-vaan-rooster.ts --commit   → voert het echt uit
//
// Idempotent: bestaande rijen worden overgeslagen, dus twee keer draaien
// levert geen dubbele bijeenkomsten op.
import { PrismaClient } from '@prisma/client'

const DRY_RUN = !process.argv.includes('--commit')

// Rooster (VAAN) AR-updates — elke drie weken op dinsdag, 12:00–13:00
const VAAN_ROOSTER: Array<{ date: string; name: string }> = [
  { date: '2026-09-01', name: 'Marnix Ritmeester' },
  { date: '2026-09-22', name: 'Barbara Rip' },
  { date: '2026-10-13', name: 'Bas den Ridder' },
  { date: '2026-11-03', name: 'Diyar Wakkas' },
  { date: '2026-11-24', name: 'Emma van der Vos' },
  { date: '2026-12-15', name: 'Erika van Zadelhof' },
  { date: '2027-01-05', name: 'Heleen Pesser' },
  { date: '2027-01-26', name: 'Jochem de Roos' },
  { date: '2027-02-16', name: 'Julia Groen' },
  { date: '2027-03-09', name: 'Juliette Niersman' },
  { date: '2027-03-30', name: 'Justine Schellekens' },
  { date: '2027-04-20', name: 'Kay Maes' },
  { date: '2027-05-11', name: 'Laetitia Wezenbeek' },
  { date: '2027-06-01', name: 'Maaike de Jong' },
  { date: '2027-06-22', name: 'Marlieke Schipper' },
  { date: '2027-07-13', name: "Alexander Collot d'Escury" },
  { date: '2027-08-03', name: 'Wies van Pesch' },
  { date: '2027-08-24', name: 'Marnix Ritmeester' },
]

// De laatste zes JAR-bijeenkomsten van 2026 — 16:00–17:00, vergaderruimte.
// Datums komen uit het bestaande JAR-rooster (scripts/../seed-jar).
const JAR_RESTEREND_2026: Array<{ date: string; name: string }> = [
  { date: '2026-09-10', name: 'Barbara Rip' },
  { date: '2026-10-01', name: 'Erika van Zadelhof' },
  { date: '2026-10-22', name: 'Justine Schellekens' },
  { date: '2026-11-12', name: 'Bas den Ridder' },
  { date: '2026-12-03', name: 'Juliette Niersman' },
  { date: '2026-12-24', name: 'Wies van Pesch' },
]

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']

/** Datum op lokale middernacht, zodat er geen dag verschuift door UTC. */
function opDatum(iso: string, uur: number, minuut: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, uur, minuut, 0, 0)
}

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-vaan-rooster] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()

  const plan: string[] = []
  let nieuwRooster = 0
  let nieuwVaanLijst = 0
  let nieuwJarLijst = 0

  try {
    // Wie staat als aanmaker op de presentielijsten
    const maker =
      (await prisma.user.findUnique({ where: { email: 'jochem.deroos@workxadvocaten.nl' }, select: { id: true, name: true } })) ??
      (await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, select: { id: true, name: true } }))

    if (!maker) {
      console.error('[seed-vaan-rooster] geen gebruiker gevonden om als aanmaker te zetten — gestopt')
      return
    }
    console.log(`Aanmaker presentielijsten: ${maker.name}`)
    console.log('')

    // ── 1. Rooster-regels (VAAN) ──────────────────────────────────────────
    console.log('── VAAN-rooster ───────────────────────────────────────────')
    for (const regel of VAAN_ROOSTER) {
      const datum = opDatum(regel.date, 12, 0)
      const jaar = datum.getFullYear()
      const dag = DAGEN[datum.getDay()]
      const bestaat = await prisma.jarSession.findFirst({
        where: { date: datum, type: 'VAAN' },
      })
      const status = bestaat ? 'bestaat al' : 'NIEUW'
      if (!bestaat) nieuwRooster++
      plan.push(`  ${regel.date} (${dag.padEnd(9)}) ${regel.name.padEnd(28)} ${status}`)
      if (dag !== 'dinsdag') {
        plan.push(`      ⚠ let op: dit is een ${dag}, het rooster zegt dinsdag`)
      }
      if (!bestaat && !DRY_RUN) {
        await prisma.jarSession.create({
          data: { date: datum, name: regel.name, year: jaar, type: 'VAAN' },
        })
      }
    }
    console.log(plan.join('\n'))
    plan.length = 0

    // ── 2. Presentielijsten voor de VAAN-updates ──────────────────────────
    console.log('')
    console.log('── Presentielijsten VAAN-updates (12:00–13:00) ────────────')
    for (const regel of VAAN_ROOSTER) {
      const datum = opDatum(regel.date, 12, 0)
      const titel = `VAAN AR-update — ${regel.name}`
      const bestaat = await prisma.trainingSession.findFirst({
        where: { title: titel, date: datum },
      })
      if (!bestaat) nieuwVaanLijst++
      plan.push(`  ${regel.date} ${titel.padEnd(48)} ${bestaat ? 'bestaat al' : 'NIEUW'}`)
      if (!bestaat && !DRY_RUN) {
        await prisma.trainingSession.create({
          data: {
            title: titel,
            speaker: regel.name,
            date: datum,
            startTime: '12:00',
            endTime: '13:00',
            points: 0,
            category: null,
            description: 'VAAN arbeidsrecht-update tijdens de lunch.',
            createdById: maker.id,
          },
        })
      }
    }
    console.log(plan.join('\n'))
    plan.length = 0

    // ── 3. Presentielijsten voor de resterende JAR-bijeenkomsten ──────────
    console.log('')
    console.log('── Presentielijsten JAR 2026 (16:00–17:00, vergaderruimte) ─')
    for (const regel of JAR_RESTEREND_2026) {
      const datum = opDatum(regel.date, 16, 0)
      const titel = `JAR — ${regel.name}`
      const bestaat = await prisma.trainingSession.findFirst({
        where: { title: titel, date: datum },
      })
      if (!bestaat) nieuwJarLijst++
      plan.push(`  ${regel.date} ${titel.padEnd(48)} ${bestaat ? 'bestaat al' : 'NIEUW'}`)
      if (!bestaat && !DRY_RUN) {
        await prisma.trainingSession.create({
          data: {
            title: titel,
            speaker: regel.name,
            date: datum,
            startTime: '16:00',
            endTime: '17:00',
            location: 'Vergaderruimte',
            points: 0,
            category: null,
            description: 'Bespreking jurisprudentie arbeidsrecht.',
            createdById: maker.id,
          },
        })
      }
    }
    console.log(plan.join('\n'))

    console.log('')
    console.log('── Samenvatting ───────────────────────────────────────────')
    console.log(`  Rooster-regels VAAN     : ${nieuwRooster} nieuw`)
    console.log(`  Presentielijst VAAN     : ${nieuwVaanLijst} nieuw`)
    console.log(`  Presentielijst JAR      : ${nieuwJarLijst} nieuw`)
    console.log('')
    console.log(DRY_RUN
      ? '  DRY-RUN — er is niets weggeschreven. Draai met --commit om het echt te doen.'
      : '  Weggeschreven naar de database.')
  } catch (err) {
    console.error('[seed-vaan-rooster] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}
if (require.main === module) main()
