// Fix WorkloadDetail: herimporteer met correcte aggregatie (optellen ipv overschrijven)
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

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const files = [
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls',
  ]

  // Parse en aggregeer per unieke sleutel
  const aggMap = new Map()
  for (const f of files) {
    const wb = XLSX.readFile(f)
    const rows = XLSX.utils.sheet_to_json(wb.Sheets['GegevensOverzicht'], { header: 1, defval: '' })

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
      const ex = aggMap.get(key)
      if (ex) {
        ex.billableHours += billable
        ex.workedHours += worked
        if (desc && (!ex.description || desc.length > ex.description.length)) ex.description = desc
      } else {
        aggMap.set(key, { personName: name, date: d, projectName: project, activityType: activity, description: desc, billableHours: billable, workedHours: worked })
      }
    }
  }

  const entries = Array.from(aggMap.values()).map(e => ({
    ...e,
    billableHours: Math.round(e.billableHours * 100) / 100,
    workedHours: Math.round(e.workedHours * 100) / 100,
  }))

  console.log(`${entries.length} geaggregeerde WorkloadDetail records`)

  // Upsert één voor één (betrouwbaar, geen connectie-issues)
  let count = 0
  for (const e of entries) {
    const prisma = new PrismaClient()
    try {
      await prisma.workloadDetail.upsert({
        where: {
          personName_date_projectName_activityType: {
            personName: e.personName, date: e.date, projectName: e.projectName, activityType: e.activityType,
          }
        },
        update: { description: e.description, billableHours: e.billableHours, workedHours: e.workedHours },
        create: e,
      })
      count++
      if (count % 200 === 0) console.log(`  ${count}/${entries.length}`)
    } finally {
      await prisma.$disconnect()
    }
  }
  console.log(`WorkloadDetail: ${count}/${entries.length} ✓`)

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
      console.log(`  2026-${String(month).padStart(2, '0')} WorkloadDetail billable: ${Math.round((sum._sum.billableHours || 0) * 100) / 100}`)
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('\nKlaar!')
}

main().catch(e => { console.error(e); process.exit(1) })
