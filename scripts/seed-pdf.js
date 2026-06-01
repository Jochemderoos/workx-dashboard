/**
 * Seed the PDF source: Arbeidsrechtelijke themata I & II (8e druk) 2024
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const { PDFParse } = require('pdf-parse')

const prisma = new PrismaClient()
const USER_ID = 'cml1u6k0700034ehqar3klcr5'

async function main() {
  const pdfPath = 'C:/Users/quiri/Downloads/Arbeidsrechtelijke themata I  II (8e druk) 2024 (4).pdf'

  console.log('PDF laden...')
  const buf = fs.readFileSync(pdfPath)
  console.log(`  Bestandsgrootte: ${(buf.length / 1024 / 1024).toFixed(1)} MB`)

  console.log('Tekst extraheren...')
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

  console.log('Opslaan in database...')
  const source = await prisma.aISource.create({
    data: {
      userId: USER_ID,
      name: 'Arbeidsrechtelijke Themata I & II (8e druk, 2024)',
      type: 'document',
      description: 'Standaard leerboek/handboek arbeidsrecht (Bakels reeks). 1805 pagina\'s. Behandelt arbeidsovereenkomstenrecht, ontslagrecht, collectief arbeidsrecht, medezeggenschapsrecht, socialezekerheidsrecht.',
      category: 'arbeidsrecht',
      content,
      isActive: true,
      isProcessed: false,
    }
  })

  console.log(`PDF bron aangemaakt: ${source.id}`)
  console.log(`${content.length} tekens opgeslagen`)

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
  .finally(() => prisma[String.fromCharCode(36) + 'disconnect']())
