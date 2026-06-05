// Handmatige database-backup van de Workx Dashboard productie-DB.
// Maakt een gecomprimeerde pg_dump → backups/workx-YYYY-MM-DD-HH-MM-SS.sql.gz.
//
// Gebruik:
//   npx tsx scripts/backup-db.ts
//
// Vereist pg_dump in PATH (komt mee met Postgres-installatie of `brew install
// libpq` / `choco install postgresql`).
//
// Aanbevolen: draai dit minimaal wekelijks en kopieer het bestand naar
// Google Drive / externe locatie voor off-site backup (Supabase eigen
// retention is 7 dagen op gratis tier).

import { spawn } from 'child_process'
import zlib from 'zlib'
import fs from 'fs'
import path from 'path'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL niet gezet in env. Stop.')
    process.exit(1)
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dir = path.join(process.cwd(), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const outFile = path.join(dir, `workx-${stamp}.sql.gz`)

  console.log('▸ pg_dump start...')
  console.log(`  bestand: ${outFile}`)

  // Pooler-URL (port 6543) ondersteunt geen pg_dump. Forceer directe connectie
  // via port 5432 als de URL via supabase pooler loopt.
  let dumpUrl = url
  if (url.includes('pooler.supabase.com:6543')) {
    dumpUrl = url
      .replace('pooler.supabase.com:6543', 'pooler.supabase.com:5432')
      .replace('-pooler.', '.')
    console.log('  (pooler-URL omgezet naar directe connectie voor pg_dump)')
  }

  const args = [
    '--no-owner',
    '--clean',
    '--if-exists',
    '--quote-all-identifiers',
    dumpUrl,
  ]

  const dump = spawn('pg_dump', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const gzip = zlib.createGzip({ level: 9 })
  const out = fs.createWriteStream(outFile)
  dump.stdout.pipe(gzip).pipe(out)

  let stderrBuf = ''
  dump.stderr.on('data', (chunk) => { stderrBuf += chunk.toString() })

  await new Promise<void>((resolve, reject) => {
    out.on('finish', () => resolve())
    out.on('error', reject)
    dump.on('error', reject)
    dump.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`pg_dump exit ${code}: ${stderrBuf}`))
      }
    })
  })

  const stats = fs.statSync(outFile)
  const mb = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`\n✓ Backup klaar (${mb} MB)`)
  console.log('\nVergeet niet:')
  console.log('  1. Kopieer naar Google Drive / externe schijf')
  console.log('  2. Test af en toe een restore (zie docs/RESTORE.md)')
}

main().catch(err => { console.error(err.message || err); process.exit(1) })
