// Fix WorkloadDetail: correcte aggregatie, met retry bij connectie-verlies
const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')

const NAME_CORRECTIONS = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
  'Lodewijk van': 'Lodewijk van Thiel',
}
function applyNameCorrection(name) {
  for (const [inc, cor] of Object.entries(NAME_CORRECTIONS)) {
    if (name === inc || name.startsWith(inc + ' ')) return cor
  }
  return name
}
function parseDutchNumber(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.trim().replace(',', '.')) || 0
  return 0
}

function parseAndAggregate(filePath) {
  const wb = XLSX.readFile(filePath)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['GegevensOverzicht'], { header: 1, defval: '' })
  const map = new Map()

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length < 6) continue
    let name = String(r[1] || '').trim()
    if (!name || name.toLowerCase().includes('totaal')) continue
    name = applyNameCorrection(name)

    const rawDate = r[3]; let d = null
    if (typeof rawDate === 'number') { const p = XLSX.SSF.parse_date_code(rawDate); if (p) d = `${p.y}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}` }
    else if (typeof rawDate === 'string') { const m = rawDate.trim().match(/^(\d+)-(\d+)-(\d+)$/); if (m) d = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` }
    if (!d) continue

    const billable = parseDutchNumber(r[4])
    const worked = parseDutchNumber(r[5])
    if (billable === 0 && worked === 0) continue
    const project = String(r[8] || '').trim()
    if (!project) continue
    const activity = String(r[9] || '').trim()
    const desc = String(r[10] || '').trim() || null

    const key = `${name}|${d}|${project}|${activity}`
    const ex = map.get(key)
    if (ex) {
      ex.billableHours += billable
      ex.workedHours += worked
      if (desc && (!ex.description || desc.length > ex.description.length)) ex.description = desc
    } else {
      map.set(key, { personName: name, date: d, projectName: project, activityType: activity, description: desc, billableHours: billable, workedHours: worked })
    }
  }
  return map
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function upsertWithRetry(entry, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const prisma = new PrismaClient()
    try {
      await prisma.workloadDetail.upsert({
        where: {
          personName_date_projectName_activityType: {
            personName: entry.personName, date: entry.date,
            projectName: entry.projectName, activityType: entry.activityType,
          }
        },
        update: {
          description: entry.description,
          billableHours: Math.round(entry.billableHours * 100) / 100,
          workedHours: Math.round(entry.workedHours * 100) / 100,
        },
        create: {
          ...entry,
          billableHours: Math.round(entry.billableHours * 100) / 100,
          workedHours: Math.round(entry.workedHours * 100) / 100,
        },
      })
      await prisma.$disconnect()
      return true
    } catch (e) {
      await prisma.$disconnect()
      if (attempt < maxRetries - 1) {
        await sleep(1000 * (attempt + 1))
      } else {
        throw e
      }
    }
  }
}

async function main() {
  const files = [
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls',
  ]

  // Parse all files and aggregate
  const allMap = new Map()
  for (const f of files) {
    const fileMap = parseAndAggregate(f)
    for (const [key, val] of fileMap) {
      const ex = allMap.get(key)
      if (ex) {
        ex.billableHours += val.billableHours
        ex.workedHours += val.workedHours
      } else {
        allMap.set(key, { ...val })
      }
    }
    console.log(`${f.split('/').pop()}: ${fileMap.size} unieke sleutels`)
  }

  const entries = Array.from(allMap.values())
  console.log(`\nTotaal: ${entries.length} records te updaten`)

  let count = 0, errors = 0
  for (const entry of entries) {
    try {
      await upsertWithRetry(entry)
      count++
      if (count % 500 === 0) console.log(`  ${count}/${entries.length}`)
    } catch (e) {
      errors++
      if (errors <= 3) console.error(`  Fout bij ${entry.personName} ${entry.date}: ${e.message}`)
      if (errors > 10) { console.error('Te veel fouten, gestopt.'); break }
    }
  }
  console.log(`\nWorkloadDetail: ${count} bijgewerkt, ${errors} fouten`)

  // Verify
  const prisma = new PrismaClient()
  try {
    for (const month of [1, 2, 3]) {
      const start = `2026-${String(month).padStart(2, '0')}-01`
      const end = month < 12 ? `2026-${String(month + 1).padStart(2, '0')}-01` : '2027-01-01'
      const sum = await prisma.workloadDetail.aggregate({
        where: { date: { gte: start, lt: end } },
        _sum: { billableHours: true },
      })
      console.log(`  2026-${String(month).padStart(2, '0')} detail billable: ${Math.round((sum._sum.billableHours || 0) * 100) / 100}`)
    }
  } finally {
    await prisma.$disconnect()
  }
  console.log('Klaar!')
}

main().catch(e => { console.error(e); process.exit(1) })
