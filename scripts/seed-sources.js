/**
 * Seed script: Pre-populate AISource records for Workx Advocaten
 *
 * Creates sources for:
 * 1. PDF: Arbeidsrechtelijke themata I & II (8e druk) 2024
 * 2. VAAN AR Updates (website with credentials)
 * 3. InView - Arbeidsrecht tijdschrift (website with credentials)
 * 4. InView - RAR (Rechtspraak Arbeidsrecht) (website with credentials)
 *
 * Usage: node scripts/seed-sources.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const USER_ID = 'cml1u6k0700034ehqar3klcr5' // Jochem de Roos

const CREDENTIALS = JSON.stringify({
  email: 'jochem.deroos@workxadvocaten.nl',
  password: 'Amsterdam24!'
})

async function extractPdfText(filePath) {
  console.log('📄 PDF tekst extraheren...')
  try {
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    console.log(`   Bestandsgrootte: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`)
    const data = await pdfParse(buffer, { max: 0 })
    console.log(`   Geëxtraheerd: ${data.text.length} tekens, ${data.numpages} pagina's`)
    return data.text
  } catch (err) {
    console.error('   PDF extractie mislukt:', err.message)
    return ''
  }
}

async function main() {
  console.log('🚀 Bronnen seeden voor Workx Advocaten...\n')

  // Check user exists
  const user = await prisma.user.findUnique({ where: { id: USER_ID } })
  if (!user) {
    console.error('❌ Gebruiker niet gevonden:', USER_ID)
    process.exit(1)
  }
  console.log(`✅ Gebruiker: ${user.name || user.email}\n`)

  // 1. PDF: Arbeidsrechtelijke themata
  const pdfPath = path.join('C:', 'Users', 'quiri', 'Downloads', 'Arbeidsrechtelijke themata I  II (8e druk) 2024 (4).pdf')

  if (fs.existsSync(pdfPath)) {
    console.log('--- Bron 1: Arbeidsrechtelijke Themata PDF ---')
    const pdfText = await extractPdfText(pdfPath)

    if (pdfText && pdfText.length > 100) {
      // Limit to 500K chars
      const content = pdfText.slice(0, 500000)

      const pdfSource = await prisma.aISource.create({
        data: {
          userId: USER_ID,
          name: 'Arbeidsrechtelijke Themata I & II (8e druk, 2024)',
          type: 'document',
          description: 'Standaard leerboek/handboek arbeidsrecht. Behandelt alle belangrijke arbeidsrechtelijke onderwerpen inclusief ontslagrecht, arbeidsovereenkomsten, collectief arbeidsrecht, etc.',
          category: 'arbeidsrecht',
          content,
          isActive: true,
          isProcessed: false,
        }
      })
      console.log(`   ✅ Aangemaakt: ${pdfSource.id} (${content.length} tekens)\n`)
    } else {
      console.log('   ⚠️ Geen tekst uit PDF geëxtraheerd\n')
    }
  } else {
    console.log('⚠️ PDF niet gevonden:', pdfPath, '\n')
  }

  // 2. VAAN AR Updates
  console.log('--- Bron 2: VAAN AR Updates ---')
  const vaanSource = await prisma.aISource.create({
    data: {
      userId: USER_ID,
      name: 'VAAN AR Updates',
      type: 'website',
      description: 'Vereniging Arbeidsrecht Advocaten Nederland — Arbeidsrecht Updates met recente rechtspraak, annotaties en commentaren.',
      url: 'https://vaan.ar-updates.nl/rechtspraak/ar-updates/catalogus',
      credentials: CREDENTIALS,
      category: 'rechtspraak',
      isActive: true,
      isProcessed: false,
    }
  })
  console.log(`   ✅ Aangemaakt: ${vaanSource.id}\n`)

  // 3. InView - Arbeidsrecht tijdschrift
  console.log('--- Bron 3: InView — Arbeidsrecht tijdschrift ---')
  const inviewArbeidsrecht = await prisma.aISource.create({
    data: {
      userId: USER_ID,
      name: 'InView — Tijdschrift Arbeidsrecht',
      type: 'website',
      description: 'Tijdschrift Arbeidsrecht via InView.nl (Boom Juridisch). Wetenschappelijke artikelen en commentaren over Nederlands arbeidsrecht.',
      url: 'https://www.inview.nl/document/idd15aff36fc-9f19-4b2c-8b04-e06e68c0e57c/tijdschrift-arbeidsrecht',
      credentials: CREDENTIALS,
      category: 'arbeidsrecht',
      isActive: true,
      isProcessed: false,
    }
  })
  console.log(`   ✅ Aangemaakt: ${inviewArbeidsrecht.id}\n`)

  // 4. InView - RAR (Rechtspraak Arbeidsrecht)
  console.log('--- Bron 4: InView — RAR ---')
  const inviewRar = await prisma.aISource.create({
    data: {
      userId: USER_ID,
      name: 'InView — RAR (Rechtspraak Arbeidsrecht)',
      type: 'website',
      description: 'RAR: Rechtspraak Arbeidsrecht via InView.nl (Boom Juridisch). Geannoteerde arbeidsrechtelijke rechtspraak.',
      url: 'https://www.inview.nl/document/id6c72ee8e-3714-42c3-9728-6f11af23e0de/rar-rechtspraak-arbeidsrecht',
      credentials: CREDENTIALS,
      category: 'rechtspraak',
      isActive: true,
      isProcessed: false,
    }
  })
  console.log(`   ✅ Aangemaakt: ${inviewRar.id}\n`)

  // Summary
  const allSources = await prisma.aISource.findMany({
    where: { userId: USER_ID },
    select: { id: true, name: true, type: true, isProcessed: true }
  })

  console.log('═══════════════════════════════════════════')
  console.log(`📊 Totaal ${allSources.length} bronnen aangemaakt:`)
  for (const s of allSources) {
    console.log(`   ${s.isProcessed ? '✅' : '⏳'} ${s.name} (${s.type})`)
  }
  console.log('═══════════════════════════════════════════')
  console.log('\n💡 De bronnen zijn nu zichtbaar in het Bronnen tab.')
  console.log('   De PDF wordt automatisch verwerkt bij het openen van het tab,')
  console.log('   of je kunt "Verwerk nu" klikken per bron.')
}

main()
  .catch(console.error)
  .finally(() => prisma[String.fromCharCode(36) + 'disconnect']())
