const XLSX = require('xlsx')

const MEDEWERKERS = [
  'Hanna Blaauboer', 'Justine Schellekens', 'Marlieke Schipper',
  'Wies van Pesch', 'Emma van der Vos', 'Alain Heunen', 'Kay Maes',
  'Erika van Zadelhof', 'Heleen Pesser', 'Barbara Rip',
  'Lotte van Sint Truiden', 'Julia Groen', 'Lodewijk van Thiel',
  'Marnix Ritmeester', 'Jochem de Roos', 'Maaike de Jong',
  'Bas den Ridder', 'Juliette Niersman',
]

const NAME_CORRECTIONS = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
  'Lodewijk van': 'Lodewijk van Thiel',
}

function parseDutchNumber(val) {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val.trim().replace(',', '.')) || 0
  return 0
}

const files = [
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls', // januari
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls', // februari
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls', // maart
]

for (const f of files) {
  const wb = XLSX.readFile(f)
  const sheet = wb.Sheets['GegevensOverzicht']
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // Check Dashboard sheet for totals
  const dashboard = wb.Sheets['Dashboard']
  if (dashboard) {
    const dRows = XLSX.utils.sheet_to_json(dashboard, { header: 1, defval: '' })
    console.log(`\n=== ${f.split('/').pop()} - Dashboard ===`)
    for (let i = 0; i < Math.min(5, dRows.length); i++) {
      console.log('  Row', i, ':', JSON.stringify(dRows[i]).substring(0, 200))
    }
  }

  // Collect all unique names
  const names = new Set()
  let totalBillable = 0, totalWorked = 0, rowCount = 0
  let skippedNoProject = 0, skippedNoHours = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 6) continue
    const rawName = String(row[1] || '').trim()
    if (!rawName || rawName.toLowerCase().includes('totaal')) continue

    let personName = rawName
    for (const [incorrect, correct] of Object.entries(NAME_CORRECTIONS)) {
      if (rawName === incorrect || rawName.startsWith(incorrect + ' ')) personName = correct
    }

    const billable = parseDutchNumber(row[4])
    const worked = parseDutchNumber(row[5])
    const projectName = String(row[8] || '').trim()

    if (billable === 0 && worked === 0) { skippedNoHours++; continue }
    if (!projectName) { skippedNoProject++; totalBillable += billable; totalWorked += worked; continue }

    names.add(personName)
    totalBillable += billable
    totalWorked += worked
    rowCount++
  }

  console.log(`\n=== ${f.split('/').pop()} ===`)
  console.log(`Verwerkte rijen: ${rowCount}, overgeslagen (geen project): ${skippedNoProject}, overgeslagen (geen uren): ${skippedNoHours}`)
  console.log(`Totaal MET project - billable: ${Math.round(totalBillable * 100) / 100}, worked: ${Math.round(totalWorked * 100) / 100}`)
  console.log(`Gevonden namen: ${[...names].sort().join(', ')}`)

  const missing = MEDEWERKERS.filter(m => !names.has(m))
  if (missing.length > 0) console.log(`ONTBREKEND: ${missing.join(', ')}`)
}
