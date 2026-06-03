// One-time refactor helper:
// - voegt `export` toe aan `async function main(`
// - vervangt eindstandige `main()` met `if (require.main === module) main()`
// Hierna kunnen de scripts zowel standalone (tsx scripts/X.ts) als in een
// orchestrator gebruikt worden (via `import { main } from './X'`).

const fs = require('fs')
const path = require('path')

const SCRIPT_DIR = path.join(__dirname)
const PATTERNS = [/^add-.*\.ts$/, /^migrate-.*\.ts$/, /^seed-.*\.ts$/, /^import-marnix-.*\.ts$/]

const files = fs.readdirSync(SCRIPT_DIR).filter(f => PATTERNS.some(p => p.test(f)))

let changed = 0
for (const f of files) {
  const full = path.join(SCRIPT_DIR, f)
  let content = fs.readFileSync(full, 'utf8')
  let before = content

  // 1. export async function main
  content = content.replace(/^async function main\(/m, 'export async function main(')
  // 2. standalone main() bottom-call
  content = content.replace(/^main\(\)\s*$/m, 'if (require.main === module) main()')

  if (content !== before) {
    fs.writeFileSync(full, content)
    changed++
    console.log(`refactored: ${f}`)
  }
}

console.log(`done — ${changed}/${files.length} files updated`)
