const XLSX = require('xlsx')

function parseDutchNumber(v) {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.trim().replace(',', '.')) || 0
  return 0
}

const NAME_CORRECTIONS = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
  'Lodewijk van': 'Lodewijk van Thiel',
}

const files = [
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1648.xls',
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1647.xls',
  'C:/Users/quiri/Downloads/xls Uren grafiek-15032026_1649.xls',
]

let totalDupes = 0, totalLostBillable = 0

for (const f of files) {
  const wb = XLSX.readFile(f)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['GegevensOverzicht'], { header: 1, defval: '' })

  // Group rows by unique key
  const groups = new Map()
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length < 6) continue
    let name = String(r[1] || '').trim()
    if (!name || name.toLowerCase().includes('totaal')) continue
    for (const [inc, cor] of Object.entries(NAME_CORRECTIONS)) {
      if (name === inc || name.startsWith(inc + ' ')) name = cor
    }
    const project = String(r[8] || '').trim()
    if (!project) continue
    const activity = String(r[9] || '').trim()
    const rawDate = r[3]
    let d = null
    if (typeof rawDate === 'string') {
      const m = rawDate.trim().match(/^(\d+)-(\d+)-(\d+)$/)
      if (m) d = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0')
    }
    if (!d) continue
    const billable = parseDutchNumber(r[4])
    const worked = parseDutchNumber(r[5])
    if (billable === 0 && worked === 0) continue

    const key = `${name}|${d}|${project}|${activity}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ billable, worked })
  }

  let dupes = 0, lostBillable = 0
  for (const [key, entries] of groups) {
    if (entries.length > 1) {
      dupes++
      const total = entries.reduce((s, e) => s + e.billable, 0)
      const lastOnly = entries[entries.length - 1].billable
      lostBillable += total - lastOnly
    }
  }
  totalDupes += dupes
  totalLostBillable += lostBillable
  console.log(`${f.split('/').pop()}: ${dupes} dubbele sleutels, ${Math.round(lostBillable * 100) / 100} verloren billable uren`)
}

console.log(`\nTotaal: ${totalDupes} dubbele sleutels, ${Math.round(totalLostBillable * 100) / 100} verloren billable uren in WorkloadDetail`)
