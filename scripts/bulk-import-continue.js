// Vervolg: alleen Workload + MonthlyHours (WorkloadDetail is al klaar)
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
  for (const [incorrect, correct] of Object.entries(NAME_CORRECTIONS)) {
    if (name === incorrect || name.startsWith(incorrect + ' ')) return correct
  }
  return name
}
function parseDutchNumber(val) {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.trim().replace(',', '.')) || 0
  return 0
}
function getWorkloadLevel(hours) {
  if (hours <= 3) return 'green'; if (hours <= 4) return 'yellow'; if (hours <= 5) return 'orange'; return 'red'
}
function parseFile(filePath) {
  const wb = XLSX.readFile(filePath)
  const sn = wb.SheetNames.find(n => n.toLowerCase().includes('gegevensoverzicht'))
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })
  const details = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]; if (!row || row.length < 6) continue
    const rawName = String(row[1] || '').trim()
    if (!rawName || rawName.toLowerCase().includes('totaal')) continue
    const personName = applyNameCorrection(rawName)
    const rawDate = row[3]; let isoDate = null
    if (typeof rawDate === 'number') { const d = XLSX.SSF.parse_date_code(rawDate); if (d) isoDate = `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` }
    else if (typeof rawDate === 'string' && rawDate.trim()) { const m = rawDate.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if (m) isoDate = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` }
    if (!isoDate) continue
    const billableHours = parseDutchNumber(row[4]), workedHours = parseDutchNumber(row[5])
    if (billableHours === 0 && workedHours === 0) continue
    const projectName = String(row[8] || '').trim(); if (!projectName) continue
    details.push({ personName, date: isoDate, workedHours, billableHours })
  }
  return details
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const files = [
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls',
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls',
  ]
  let allDetails = []
  for (const f of files) { allDetails.push(...parseFile(f)) }

  // Aggregeer per persoon+dag
  const aggMap = new Map()
  for (const d of allDetails) {
    const key = `${d.personName}|${d.date}`
    const ex = aggMap.get(key)
    if (ex) { ex.hours += d.workedHours } else { aggMap.set(key, { personName: d.personName, date: d.date, hours: d.workedHours }) }
  }
  const aggEntries = Array.from(aggMap.values()).map(e => ({ ...e, hours: Math.round(e.hours * 100) / 100 }))

  // Workload upserts - één voor één om connectie-issues te voorkomen
  console.log(`Workload: ${aggEntries.length} entries`)
  let count = 0
  for (const e of aggEntries) {
    const prisma = new PrismaClient()
    try {
      await prisma.workload.upsert({
        where: { personName_date: { personName: e.personName, date: e.date } },
        update: { level: getWorkloadLevel(e.hours), hours: e.hours },
        create: { personName: e.personName, date: e.date, level: getWorkloadLevel(e.hours), hours: e.hours },
      })
      count++
      if (count % 100 === 0) console.log(`  ${count}/${aggEntries.length}`)
    } finally {
      await prisma.$disconnect()
    }
  }
  console.log(`Workload: ${count} ✓`)

  // MonthlyHours herberekenen
  console.log('\nMonthlyHours...')
  const months = [[2026,1],[2026,2],[2026,3]]
  for (const [year, month] of months) {
    const prisma = new PrismaClient()
    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endMonth = month === 12 ? 1 : month + 1
      const endYear = month === 12 ? year + 1 : year
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`

      const monthDetails = await prisma.workloadDetail.findMany({
        where: { date: { gte: startDate, lt: endDate } },
        select: { personName: true, billableHours: true, workedHours: true },
      })

      const personMap = new Map()
      for (const d of monthDetails) {
        const ex = personMap.get(d.personName)
        if (ex) { ex.billable += d.billableHours; ex.worked += d.workedHours }
        else { personMap.set(d.personName, { billable: d.billableHours, worked: d.workedHours }) }
      }

      const ops = Array.from(personMap.entries()).map(([name, h]) =>
        prisma.monthlyHours.upsert({
          where: { employeeName_year_month: { employeeName: name, year, month } },
          update: { billableHours: Math.round(h.billable * 100) / 100, workedHours: Math.round(h.worked * 100) / 100 },
          create: { employeeName: name, year, month, billableHours: Math.round(h.billable * 100) / 100, workedHours: Math.round(h.worked * 100) / 100 },
        })
      )
      await prisma.$transaction(ops)
      console.log(`  ${year}-${String(month).padStart(2, '0')}: ${personMap.size} medewerkers ✓`)
    } finally {
      await prisma.$disconnect()
    }
  }

  console.log('\nKlaar!')
}

main().catch(e => { console.error(e); process.exit(1) })
