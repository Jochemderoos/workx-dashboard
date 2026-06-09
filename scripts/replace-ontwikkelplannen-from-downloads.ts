// Vervangt ontwikkelplannen voor opgegeven medewerkers met de DOCX-bestanden
// in C:/Users/quiri/Downloads. Hard-replace: alle bestaande plannen +
// items + evaluations worden eerst gewist. Voor namen in REMOVE_ONLY worden
// de plannen verwijderd zonder iets terug te importeren (bv. Alain — uit dienst).
//
// Eenmalig draaien: `npx tsx scripts/replace-ontwikkelplannen-from-downloads.ts`

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const DOWNLOADS = 'C:/Users/quiri/Downloads'

// Medewerkers die geheel verwijderd moeten worden (geen nieuwe import).
const REMOVE_ONLY = ['Alain']

// Volledige namen voor display + user-match.
const NAME_MAP: Record<string, string> = {
  Marlieke: 'Marlieke Schipper',
  Kay: 'Kay Maes',
  Erika: 'Erika van Zadelhof',
  Heleen: 'Heleen Pesser',
  Justine: 'Justine Schellekens',
  Emma: 'Emma van der Vos',
  Wies: 'Wies van Pesch',
  Barbara: 'Barbara Rip',
  Hanna: 'Hanna Blaauboer',
  Alain: 'Alain Heunen',
}

const IMPORT_NAMES = Object.keys(NAME_MAP).filter(n => !REMOVE_ONLY.includes(n))

// .env loader (geen dotenv-dependency).
async function loadDotEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
}

interface ParsedSection {
  number: number
  title: string
  goals: string
  evaluation: string
}

function extractDocx(xml: string): { name: string; period: string; sections: ParsedSection[] } {
  const processed = xml
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '|||CELL|||')
    .replace(/<\/w:tr>/g, '|||ROW|||')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))

  let name = ''
  const nameMatch = processed.match(/Naam:\s*(.+?)(?:\n|$)/)
  if (nameMatch) name = nameMatch[1].trim()

  let period = ''
  const periodMatch = processed.match(/Periode:\s*(.+?)(?:\n|$)/)
  if (periodMatch) period = periodMatch[1].trim()

  const sections: ParsedSection[] = []
  const rows = processed.split('|||ROW|||').filter(r => r.includes('|||CELL|||'))
  for (const row of rows) {
    const cells = row.split('|||CELL|||').map(c => c.replace(/\n+/g, '\n').trim())
    if (cells.some(c => c.includes('Onderdeel') && c.includes('Doelen'))) continue
    if (cells.join('').replace(/\s/g, '').length === 0) continue
    const numMatch = cells[0]?.match(/(\d+)/)
    if (!numMatch) continue
    const number = parseInt(numMatch[1])
    const title = cells[1]?.trim() || ''
    const goals = cells[2]?.trim() || ''
    const evaluation = cells[3]?.trim() || ''
    if (title || goals) sections.push({ number, title, goals, evaluation })
  }
  return { name, period, sections }
}

function deriveCategory(title: string | undefined, number: number | undefined): string {
  const t = (title || '').toLowerCase()
  if (t.includes('theor')) return 'inhoud-theorie'
  if (t.includes('eigen')) return 'eigen-praktijk'
  if (t.includes('acquisitie')) return 'eigen-praktijk'
  if (t.includes('intern')) return 'intern'
  if (t.includes('praktijk')) return 'inhoud-praktijk'
  switch (number || 0) {
    case 1: return 'inhoud-theorie'
    case 2: return 'inhoud-praktijk'
    case 3: return 'eigen-praktijk'
    case 4: return 'intern'
    default: return 'inhoud-theorie'
  }
}

function extractYearFromFilename(filename: string, period: string): number {
  const periodYear = period.match(/20\d{2}/)
  if (periodYear) return parseInt(periodYear[0])
  const fileYear = filename.match(/20\d{2}/)
  if (fileYear) return parseInt(fileYear[0])
  return new Date().getFullYear()
}

function extractFirstNameFromFilename(filename: string): string {
  const cleaned = filename.replace(/\.docx$/i, '')
  let m = cleaned.match(/Ontwikkelplan\s*-\s*(\w+)/)
  if (m) return m[1]
  m = cleaned.match(/Ontwikkelplan\s+(\w+)/)
  if (m) return m[1]
  return ''
}

async function main() {
  await loadDotEnv('C:/Users/quiri/workx-dashboard/.env')
  await loadDotEnv('C:/Users/quiri/workx-dashboard/.env.local')
  if (!process.env.DATABASE_URL) {
    console.error('Geen DATABASE_URL gevonden')
    process.exit(1)
  }
  const prisma = new PrismaClient()

  // @ts-expect-error adm-zip no types
  const AdmZip = (await import('adm-zip')).default

  // Stap 1 — verwijder bestaande plannen voor alle betrokken namen
  console.log('--- Bestaande plannen verwijderen ---')
  for (const first of [...IMPORT_NAMES, ...REMOVE_ONLY]) {
    const full = NAME_MAP[first]
    const existing = await prisma.developmentPlan.findMany({
      where: { OR: [{ employeeName: { contains: first } }, { employeeName: { contains: full } }] },
      select: { id: true },
    })
    if (existing.length === 0) {
      console.log(`  ${first.padEnd(10)} — geen bestaande plannen`)
      continue
    }
    const ids = existing.map(p => p.id)
    await prisma.developmentPlanItem.deleteMany({ where: { planId: { in: ids } } })
    await prisma.developmentPlanEvaluation.deleteMany({ where: { planId: { in: ids } } })
    await prisma.developmentPlan.deleteMany({ where: { id: { in: ids } } })
    console.log(`  ${first.padEnd(10)} — ${existing.length} plannen verwijderd`)
  }

  // Stap 2 — voor REMOVE_ONLY: klaar (geen import)
  for (const removed of REMOVE_ONLY) {
    console.log(`\n${removed}: ALLEEN VERWIJDERD (geen import)`)
  }

  // Stap 3 — importeer DOCX-bestanden uit Downloads voor IMPORT_NAMES
  console.log('\n--- DOCX imports vanuit Downloads ---')
  const allFiles = fs.readdirSync(DOWNLOADS).filter(f => /^Ontwikkelplan/i.test(f) && /\.docx$/i.test(f))

  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  const userByFirstName = new Map<string, string>()
  for (const u of users) {
    const first = u.name.split(' ')[0].toLowerCase()
    userByFirstName.set(first, u.id)
  }

  let imported = 0
  let itemsCreated = 0
  const perPerson: Record<string, number> = {}

  for (const file of allFiles) {
    const firstFromFile = extractFirstNameFromFilename(file)
    if (!IMPORT_NAMES.includes(firstFromFile)) continue

    const filePath = path.join(DOWNLOADS, file)
    try {
      const zip = new AdmZip(filePath)
      const docEntry = zip.getEntry('word/document.xml')
      if (!docEntry) {
        console.log(`  ⚠ ${file} — geen document.xml`)
        continue
      }
      const xml = docEntry.getData().toString('utf-8')
      const { name: docName, period, sections } = extractDocx(xml)

      const firstName = (docName && docName.split(' ')[0]) || firstFromFile
      const fullName = NAME_MAP[firstName] || (docName || firstFromFile)
      const userId = userByFirstName.get(firstName.toLowerCase()) || null
      const year = extractYearFromFilename(file, period)

      const finalPeriod = period || file.replace(/\.docx$/i, '').replace(/Ontwikkelplan\s*-?\s*/, '').replace(firstName, '').trim() || `${year}`

      // Plan + items
      const plan = await prisma.developmentPlan.create({
        data: {
          userId,
          employeeName: fullName,
          period: finalPeriod,
          year,
          sections: JSON.stringify(sections),
          status: 'afgerond',
          documentName: file,
        },
      })

      for (let i = 0; i < sections.length; i++) {
        const s = sections[i]
        await prisma.developmentPlanItem.create({
          data: {
            planId: plan.id,
            category: deriveCategory(s.title, s.number),
            title: s.title || 'Onderdeel',
            goals: s.goals?.trim() || null,
            evaluation: s.evaluation?.trim() || null,
            status: 'todo',
            progress: 0,
            position: i,
          },
        })
        itemsCreated++
      }

      perPerson[firstName] = (perPerson[firstName] || 0) + 1
      imported++
      console.log(`  ✓ ${file} → ${fullName} ${year} (${sections.length} items)`)
    } catch (err) {
      console.log(`  ✗ ${file} — ${err instanceof Error ? err.message : 'fout'}`)
    }
  }

  console.log('\n--- Samenvatting ---')
  console.log(`Geïmporteerd: ${imported} plannen, ${itemsCreated} items`)
  for (const [name, count] of Object.entries(perPerson)) {
    console.log(`  ${name}: ${count} plannen`)
  }
  for (const removed of REMOVE_ONLY) console.log(`  ${removed}: VERWIJDERD`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fout:', err)
  process.exit(1)
})
