const { PrismaClient } = require('@prisma/client')
const AdmZip = require('adm-zip')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const prisma = new PrismaClient()

const NAME_MAP = {
  'Marlieke': 'Marlieke Schipper',
  'Justine': 'Justine Schellekens',
  'Emma': 'Emma van der Vos',
  'Hanna': 'Hanna Blaauboer',
  'Wies': 'Wies van Pesch',
  'Alain': 'Alain Heunen',
  'Kay': 'Kay Maes',
  'Erika': 'Erika van Zadelhof',
  'Barbara': 'Barbara Rip',
  'Heleen': 'Heleen Pesser',
}

function extractTextFromDocxXml(xml) {
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

  const sections = []
  const rows = processed.split('|||ROW|||').filter(r => r.includes('|||CELL|||'))

  for (const row of rows) {
    const cells = row.split('|||CELL|||').map(c => c.replace(/\n+/g, '\n').trim())
    if (cells.some(c => c.includes('Onderdeel'))) continue
    if (cells.join('').replace(/\s/g, '').length === 0) continue

    const numMatch = cells[0] && cells[0].match(/(\d+)/)
    if (!numMatch) continue

    const number = parseInt(numMatch[1])
    const title = (cells[1] || '').trim()
    const goals = (cells[2] || '').trim()
    const evaluation = (cells[3] || '').trim()

    if (title || goals) {
      sections.push({ number, title, goals, evaluation })
    }
  }

  return { name, period, sections }
}

function extractNameFromFilename(filename) {
  const cleaned = filename.replace('.docx', '').replace('.DOCX', '')
  let match = cleaned.match(/Ontwikkelplan\s*-\s*(\w+)/)
  if (match) return match[1]
  match = cleaned.match(/Ontwikkelplan\s+(\w+)/)
  if (match) return match[1]
  return ''
}

function extractYear(filename, period) {
  const periodMatch = period.match(/20\d{2}/)
  if (periodMatch) return parseInt(periodMatch[0])
  const fileMatch = filename.match(/20\d{2}/)
  if (fileMatch) return parseInt(fileMatch[0])
  return new Date().getFullYear()
}

async function main() {
  const dirPath = 'C:/Users/quiri/Desktop/Ontwikkelplannen'
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.docx'))
  console.log('Gevonden: ' + files.length + ' DOCX bestanden\n')

  const users = await prisma.user.findMany({ select: { id: true, name: true } })
  console.log('Users in database: ' + users.length + '\n')

  const existing = await prisma.developmentPlan.findMany({ select: { documentName: true } })
  const existingSet = new Set(existing.map(p => p.documentName))

  let imported = 0
  let skipped = 0
  let errors = 0

  for (const file of files) {
    if (existingSet.has(file)) {
      console.log('  SKIP: ' + file)
      skipped++
      continue
    }

    try {
      const filePath = path.join(dirPath, file)
      const zip = new AdmZip(filePath)
      const docEntry = zip.getEntry('word/document.xml')
      if (!docEntry) {
        console.log('  FOUT (geen xml): ' + file)
        errors++
        continue
      }

      const xml = docEntry.getData().toString('utf-8')
      const { name, period, sections } = extractTextFromDocxXml(xml)

      const fileFirstName = extractNameFromFilename(file)
      const firstName = name || fileFirstName
      const fullName = NAME_MAP[firstName] || firstName

      const matchedUser = users.find(u => u.name.split(' ')[0].toLowerCase() === firstName.toLowerCase())
      const year = extractYear(file, period)

      const id = 'cl' + crypto.randomBytes(12).toString('base64url')

      await prisma.developmentPlan.create({
        data: {
          id,
          userId: matchedUser ? matchedUser.id : null,
          employeeName: fullName,
          period: period || file.replace('.docx', '').replace('Ontwikkelplan', '').trim(),
          year,
          sections: JSON.stringify(sections),
          status: 'afgerond',
          documentName: file,
          updatedAt: new Date(),
        },
      })

      console.log('  OK: ' + file + ' -> ' + fullName + ' (' + year + ') [' + sections.length + ' secties]')
      imported++
    } catch (err) {
      console.log('  FOUT: ' + file + ' -> ' + err.message.substring(0, 120))
      errors++
    }
  }

  console.log('')
  console.log('=== RESULTAAT ===')
  console.log('Geimporteerd: ' + imported)
  console.log('Overgeslagen:  ' + skipped)
  console.log('Fouten:        ' + errors)
  console.log('Totaal:        ' + files.length)
}

main().catch(console.error).finally(() => prisma.$disconnect())
