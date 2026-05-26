import xlsx from 'xlsx'
import path from 'path'
import os from 'os'

const file = path.join(os.homedir(), 'Downloads', 'Kopie van Bijlage - Lijst bevriende kantoren.xlsx')
const wb = xlsx.readFile(file)
console.log('Sheets:', wb.SheetNames)
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '', header: 1 })
  console.log('---SHEET:', name, '---')
  rows.forEach((r, i) => console.log(i, JSON.stringify(r)))
}
