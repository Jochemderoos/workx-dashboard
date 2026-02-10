/**
 * Seed AI bron: Tekst en commentaar 2024
 * Volgt exact het patroon van seed-pdf.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()
const USER_ID = 'cml1u6k0700034ehqar3klcr5' // Hanna (admin)

async function main() {
  // Look for the PDF in Downloads
  const pdfPath = 'C:/Users/quiri/Downloads/Tekst en commentaar 2024.pdf'

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF niet gevonden: ${pdfPath}`)
    console.log('Plaats het bestand "Tekst en commentaar 2024.pdf" in C:/Users/quiri/Downloads/')
    process.exit(1)
  }

  console.log('PDF laden...')
  const buf = fs.readFileSync(pdfPath)
  console.log(`  Bestandsgrootte: ${(buf.length / 1024 / 1024).toFixed(1)} MB`)

  console.log('Tekst extraheren...')
  const { PDFParse } = require('pdf-parse')
  const uint8 = new Uint8Array(buf)
  const p = new PDFParse(uint8)
  const rawText = await p.getText()
  const text = typeof rawText === 'string' ? rawText : (rawText.text || String(rawText))

  console.log(`  Tekens: ${text.length}`)

  if (text.length < 100) {
    console.error('Onvoldoende tekst uit PDF')
    process.exit(1)
  }

  // Limit to 500K chars for database
  const content = text.slice(0, 500000)

  // Check if source already exists
  const existing = await prisma.aISource.findFirst({
    where: {
      userId: USER_ID,
      name: { contains: 'Tekst en commentaar', mode: 'insensitive' },
    },
  })

  if (existing) {
    console.log(`Bron bestaat al: ${existing.id}`)
    console.log('Gebruik de Verwerk-knop in AI Assistent om te verwerken.')
    return
  }

  console.log('Opslaan in database...')
  const source = await prisma.aISource.create({
    data: {
      userId: USER_ID,
      name: 'Tekst en Commentaar Arbeidsrecht 2024',
      type: 'document',
      description: 'Tekst en Commentaar Arbeidsrecht 2024 - wetteksten met uitgebreid artikelsgewijs commentaar. Standaard naslagwerk voor de arbeidsrechtpraktijk met actuele jurisprudentie en literatuur.',
      category: 'arbeidsrecht',
      content,
      isActive: true,
      isProcessed: false,
    }
  })

  console.log(`PDF bron aangemaakt: ${source.id}`)
  console.log(`${content.length} tekens opgeslagen`)
  console.log('Gebruik de Verwerk-knop in AI Assistent om de bron te verwerken.')

  // Show all sources now
  const all = await prisma.aISource.findMany({
    where: { userId: USER_ID },
    select: { id: true, name: true, type: true, isProcessed: true }
  })
  console.log(`\nTotaal ${all.length} bronnen:`)
  for (const s of all) {
    console.log(`  ${s.isProcessed ? '[verwerkt]' : '[onverwerkt]'} ${s.name} (${s.type})`)
  }
}

main()
  .catch(err => { console.error('Fout:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
