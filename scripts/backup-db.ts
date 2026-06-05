// Handmatige database-backup via Prisma — geen pg_dump nodig.
// Iterates over alle tabellen in het schema, dumpt elke tabel als JSON-array
// en comprimeert tot één .json.gz bestand.
//
// Gebruik:
//   npx tsx scripts/backup-db.ts
//
// Output: backups/workx-YYYY-MM-DD-HH-MM-SS.json.gz
//
// Restore: zie docs/RESTORE.md (scripts/restore-db.ts is nog manueel werk
// per tabel — voor 'nuclear' restore is Supabase PITR sneller).

import { spawn } from 'child_process'
import zlib from 'zlib'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// Lichte env-loader — leest .env / .env.local zonder externe dependency
function loadEnv(file: string) {
  try {
    const content = fs.readFileSync(file, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (!m) continue
      const key = m[1]
      let val = m[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {}
}
loadEnv(path.join(process.cwd(), '.env.local'))
loadEnv(path.join(process.cwd(), '.env'))

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL niet gezet. Stop.')
    process.exit(1)
  }

  const prisma = new PrismaClient()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dir = path.join(process.cwd(), 'backups')
  fs.mkdirSync(dir, { recursive: true })
  const outFile = path.join(dir, `workx-${stamp}.json.gz`)

  console.log(`▸ Backup naar ${outFile}`)

  // Verzamel alle model-namen uit Prisma client (DMMF metadata)
  const dmmf = (prisma as any)._runtimeDataModel
  const modelNames: string[] = Object.keys(dmmf?.models || {})
  if (modelNames.length === 0) {
    // Fallback: hardcode lijst (mocht DMMF wegvallen)
    console.warn('Geen DMMF gevonden — gebruik findAllRecords via Prisma raw query is geen optie.')
    process.exit(1)
  }

  console.log(`  ${modelNames.length} tabellen gevonden`)

  const backup: { meta: any; data: Record<string, unknown[]> } = {
    meta: {
      generatedAt: new Date().toISOString(),
      modelCount: modelNames.length,
      schema: 'workx-dashboard',
    },
    data: {},
  }

  let totalRecords = 0
  for (const modelName of modelNames) {
    const camel = modelName[0].toLowerCase() + modelName.slice(1)
    const delegate = (prisma as any)[camel]
    if (!delegate?.findMany) {
      console.warn(`  ⚠ ${modelName}: geen findMany delegate — skip`)
      continue
    }
    try {
      const records = await delegate.findMany({})
      backup.data[modelName] = records
      totalRecords += records.length
      process.stdout.write(`  · ${modelName}: ${records.length}\n`)
    } catch (err: any) {
      console.warn(`  ⚠ ${modelName}: ${err.message?.split('\n')[0]}`)
    }
  }

  await prisma.$disconnect()

  // Serialize + gzip naar disk
  const json = JSON.stringify(backup, (_key, value) => {
    if (typeof value === 'bigint') return value.toString()
    if (value instanceof Date) return value.toISOString()
    return value
  })
  const buf = await new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(json, { level: 9 }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
  fs.writeFileSync(outFile, buf)

  const mb = (buf.length / 1024 / 1024).toFixed(2)
  console.log(`\n✓ Backup klaar`)
  console.log(`  bestand: ${outFile}`)
  console.log(`  grootte: ${mb} MB`)
  console.log(`  records: ${totalRecords.toLocaleString('nl-NL')} over ${Object.keys(backup.data).length} tabellen`)
  console.log(`\nVergeet niet:`)
  console.log(`  1. Kopieer naar Google Drive / externe schijf`)
  console.log(`  2. Supabase Pro heeft 7 dagen PITR — dit is je extra off-site verzekering`)
}

main().catch(err => {
  console.error('FOUT:', err.message || err)
  process.exit(1)
})
