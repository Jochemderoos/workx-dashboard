/**
 * Test Templates Script
 * Haalt alle templates op uit de database en analyseert ze op kwaliteit.
 * Run: node scripts/test-templates.js
 */

const fs = require("fs")
const path = require("path")

// -- Load environment (same pattern as test-chat.js) --
function loadEnv(fp) {
  try {
    const lines = fs.readFileSync(fp, 'utf-8').split('\n')
    for (const line of lines) {
      if (line.startsWith('#')) continue
      const idx = line.indexOf('=')
      if (idx === -1) continue
      const key = line.substring(0, idx).trim()
      let val = line.substring(idx + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1)
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}

const root = path.resolve(__dirname, '..')
loadEnv(path.join(root, '.env'))
loadEnv(path.join(root, '.env.local'))

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== TEMPLATE ANALYSE ===\n')

  // 1. Ophalen templates
  const templates = await prisma.aITemplate.findMany({
    orderBy: { updatedAt: 'desc' },
  })

  console.log(`Totaal templates: ${templates.length}\n`)

  if (templates.length === 0) {
    console.log('Geen templates gevonden in de database.')
    return
  }

  let issues = []

  for (const t of templates) {
    console.log('─'.repeat(70))
    console.log(`Naam:        ${t.name}`)
    console.log(`ID:          ${t.id}`)
    console.log(`Categorie:   ${t.category}`)
    console.log(`Type:        ${t.fileType}`)
    console.log(`Grootte:     ${(t.fileSize / 1024).toFixed(1)} KB`)
    console.log(`Actief:      ${t.isActive ? 'JA' : 'NEE'}`)
    console.log(`Gebruik:     ${t.usageCount}x`)
    console.log(`Aangemaakt:  ${t.createdAt?.toISOString?.() || t.createdAt}`)
    console.log(`Bijgewerkt:  ${t.updatedAt?.toISOString?.() || t.updatedAt}`)

    // Beschrijving
    if (t.description) {
      console.log(`Beschrijving: ${t.description.slice(0, 200)}${t.description.length > 200 ? '...' : ''}`)
    } else {
      console.log(`Beschrijving: [ONTBREEKT]`)
      issues.push(`${t.name}: Geen beschrijving`)
    }

    // Instructies
    if (t.instructions) {
      console.log(`Instructies:  ${t.instructions.slice(0, 200)}${t.instructions.length > 200 ? '...' : ''}`)
    } else {
      console.log(`Instructies:  [ONTBREEKT]`)
      issues.push(`${t.name}: Geen instructies`)
    }

    // Placeholders
    if (t.placeholders) {
      try {
        const parsed = JSON.parse(t.placeholders)
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`Invulvelden:  ${parsed.length} velden: ${parsed.slice(0, 10).join(', ')}${parsed.length > 10 ? '...' : ''}`)
        } else if (Array.isArray(parsed) && parsed.length === 0) {
          console.log(`Invulvelden:  Lege array (geen velden gedetecteerd)`)
          issues.push(`${t.name}: Lege placeholders array`)
        } else {
          console.log(`Invulvelden:  Onverwacht formaat: ${typeof parsed}`)
          issues.push(`${t.name}: Placeholders is geen array`)
        }
      } catch (e) {
        console.log(`Invulvelden:  [PARSE FOUT: ${e.message}]`)
        issues.push(`${t.name}: Placeholders JSON parse fout`)
      }
    } else {
      console.log(`Invulvelden:  [ONTBREEKT]`)
      issues.push(`${t.name}: Geen placeholders`)
    }

    // Content
    if (t.content) {
      const contentLen = t.content.length
      console.log(`Content:      ${contentLen} tekens`)
      if (contentLen < 100) {
        console.log(`              [WAARSCHUWING: Zeer weinig content]`)
        issues.push(`${t.name}: Zeer weinig content (${contentLen} tekens)`)
      }
      console.log(`              Eerste 500 chars: ${t.content.slice(0, 500).replace(/\n/g, '\\n')}`)
    } else {
      console.log(`Content:      [ONTBREEKT]`)
      issues.push(`${t.name}: Geen content`)
    }

    // Base64
    if (t.fileBase64) {
      const base64Size = (t.fileBase64.length * 0.75 / 1024).toFixed(0)
      console.log(`Origineel:    ${base64Size} KB (base64 beschikbaar voor download)`)
    } else {
      console.log(`Origineel:    [GEEN ORIGINEEL BESTAND]`)
      issues.push(`${t.name}: Geen base64 (download niet mogelijk)`)
    }

    console.log('')
  }

  // Samenvatting
  console.log('═'.repeat(70))
  console.log('\n=== SAMENVATTING ===\n')
  console.log(`Totaal templates:  ${templates.length}`)
  console.log(`Actieve templates: ${templates.filter(t => t.isActive).length}`)
  console.log(`Met content:       ${templates.filter(t => t.content && t.content.length > 100).length}`)
  console.log(`Met placeholders:  ${templates.filter(t => {
    try { const p = JSON.parse(t.placeholders || '[]'); return Array.isArray(p) && p.length > 0 } catch { return false }
  }).length}`)
  console.log(`Met beschrijving:  ${templates.filter(t => t.description).length}`)
  console.log(`Met instructies:   ${templates.filter(t => t.instructions).length}`)
  console.log(`Met base64:        ${templates.filter(t => t.fileBase64).length}`)

  if (issues.length > 0) {
    console.log(`\n=== GEVONDEN PROBLEMEN (${issues.length}) ===\n`)
    for (const issue of issues) {
      console.log(`  - ${issue}`)
    }
  } else {
    console.log('\nGeen problemen gevonden!')
  }

  // Categorie-verdeling
  const categories = {}
  for (const t of templates) {
    categories[t.category] = (categories[t.category] || 0) + 1
  }
  console.log('\n=== VERDELING PER CATEGORIE ===')
  for (const [cat, count] of Object.entries(categories)) {
    console.log(`  ${cat}: ${count}`)
  }
}

main()
  .catch(err => {
    console.error('FOUT:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
