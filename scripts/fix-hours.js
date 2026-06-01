// Fix: herbereken MonthlyHours met correcte aggregatie (uren optellen, niet overschrijven)
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
    const billableHours = parseDutchNumber(row[4])
    const workedHours = parseDutchNumber(row[5])
    if (billableHours === 0 && workedHours === 0) continue
    const projectName = String(row[8] || '').trim()
    if (!projectName) continue
    details.push({ personName, date: isoDate, billableHours, workedHours })
  }
  return details
}

async function main() {
  const files = [
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls', // januari
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls', // februari
    'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls', // maart
  ]

  // Parse alle bestanden en tel ALLE rijen op (geen dedup op detail-sleutel)
  const monthTotals = {} // { "personName|year|month": { billable, worked } }

  for (const f of files) {
    const details = parseFile(f)
    let totalB = 0, totalW = 0
    for (const d of details) {
      totalB += d.billableHours
      totalW += d.workedHours
      const year = parseInt(d.date.substring(0, 4))
      const month = parseInt(d.date.substring(5, 7))
      const key = `${d.personName}|${year}|${month}`
      if (!monthTotals[key]) monthTotals[key] = { personName: d.personName, year, month, billable: 0, worked: 0 }
      monthTotals[key].billable += d.billableHours
      monthTotals[key].worked += d.workedHours
    }
    console.log(`${f.split('/').pop()}: ${details.length} rows, billable: ${Math.round(totalB*100)/100}, worked: ${Math.round(totalW*100)/100}`)
  }

  // Update MonthlyHours
  const entries = Object.values(monthTotals)
  console.log(`\nUpdating ${entries.length} MonthlyHours records...`)

  const prisma = new PrismaClient()
  try {
    for (const e of entries) {
      await prisma.monthlyHours.upsert({
        where: { employeeName_year_month: { employeeName: e.personName, year: e.year, month: e.month } },
        update: { billableHours: Math.round(e.billable * 100) / 100, workedHours: Math.round(e.worked * 100) / 100 },
        create: { employeeName: e.personName, year: e.year, month: e.month, billableHours: Math.round(e.billable * 100) / 100, workedHours: Math.round(e.worked * 100) / 100 },
      })
    }

    // Verify totals
    console.log('\nVerificatie:')
    for (const month of [1, 2, 3]) {
      const hours = await prisma.monthlyHours.findMany({ where: { year: 2026, month } })
      const total = hours.reduce((s, h) => s + h.billableHours, 0)
      console.log(`  2026-${String(month).padStart(2,'0')}: ${Math.round(total*100)/100} billable uren`)
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('\nKlaar!')
}

main().catch(e => { console.error(e); process.exit(1) })
