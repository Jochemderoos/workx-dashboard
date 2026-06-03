// One-time refactor #2:
// - main() krijgt optionele PrismaClient parameter
// - bestaande `new PrismaClient()` valt terug op de externe als die er is
// - $disconnect alleen als we 'm zelf hebben aangemaakt
//
// Hierdoor kan een orchestrator één gedeelde client doorgeven aan
// alle scripts, scheelt 40× connect/disconnect (~30-60s op de build).

const fs = require('fs')
const path = require('path')

const SCRIPT_DIR = path.join(__dirname)
const PATTERNS = [/^add-.*\.ts$/, /^migrate-.*\.ts$/, /^seed-.*\.ts$/, /^import-marnix-.*\.ts$/]
const files = fs.readdirSync(SCRIPT_DIR).filter(f => PATTERNS.some(p => p.test(f)))

let changed = 0
for (const f of files) {
  const full = path.join(SCRIPT_DIR, f)
  let content = fs.readFileSync(full, 'utf8')
  const before = content

  // 1. Signature: main() → main(externalPrisma?: PrismaClient)
  content = content.replace(
    /export async function main\(\s*\)/m,
    'export async function main(externalPrisma?: PrismaClient)',
  )

  // 2. const prisma = new PrismaClient() → const prisma = externalPrisma ?? new PrismaClient()
  content = content.replace(
    /const prisma\s*=\s*new PrismaClient\(\)/g,
    'const prisma = externalPrisma ?? new PrismaClient()',
  )

  // 3. await prisma.$disconnect() → if (!externalPrisma) await prisma.$disconnect()
  // Match both .catch(() => {}) varianten en zonder catch
  content = content.replace(
    /await prisma\.\$disconnect\(\)\.catch\(\(\) => \{\}\)/g,
    'if (!externalPrisma) await prisma.$disconnect().catch(() => {})',
  )
  content = content.replace(
    /await prisma\.\$disconnect\(\)(?!\.)/g,
    'if (!externalPrisma) await prisma.$disconnect()',
  )

  if (content !== before) {
    fs.writeFileSync(full, content)
    changed++
    console.log(`refactored: ${f}`)
  } else {
    console.log(`  skipped: ${f} (geen match)`)
  }
}

console.log(`\ndone — ${changed}/${files.length} files updated`)
