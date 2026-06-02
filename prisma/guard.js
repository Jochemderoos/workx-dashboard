#!/usr/bin/env node

/**
 * Prisma Guard - Blokkeert gevaarlijke prisma commando's
 *
 * Deze database wordt GEDEELD met het study-hub project.
 * `prisma db push` zou ALLE study_ tabellen verwijderen!
 *
 * Veilige alternatieven:
 *   npx prisma generate  - Genereert Prisma Client (veilig)
 *   npx prisma studio    - Database browser (veilig)
 */

const args = process.argv.slice(2).join(' ')

const BLOCKED_COMMANDS = [
  'db push',
  'db reset',
  'migrate reset',
  'migrate dev',
]

const blocked = BLOCKED_COMMANDS.find(cmd => args.includes(cmd))

if (blocked) {
  console.error('')
  console.error('  +----------------------------------------------------------+')
  console.error('  |  GEBLOKKEERD: prisma ' + blocked.padEnd(36) + ' |')
  console.error('  |                                                          |')
  console.error('  |  Deze database wordt GEDEELD met study-hub.              |')
  console.error('  |  Dit commando zou ALLE study_ tabellen verwijderen!      |')
  console.error('  |                                                          |')
  console.error('  |  Veilige alternatieven:                                  |')
  console.error('  |    npx prisma generate   (Prisma Client genereren)       |')
  console.error('  |    npx prisma studio     (Database browser)              |')
  console.error('  +----------------------------------------------------------+')
  console.error('')
  process.exit(1)
}

// Veilige commando's doorlaten
const { execSync } = require('child_process')
try {
  execSync(`npx prisma ${args}`, { stdio: 'inherit' })
} catch (e) {
  process.exit(e.status || 1)
}
