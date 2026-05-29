import { PrismaClient } from '@prisma/client'
async function main() {
  const p = new PrismaClient()
  try {
    const users = await p.user.findMany({ select: { name: true, avatarUrl: true } })
    for (const u of users) console.log(`${u.name}: ${u.avatarUrl || '(geen)'}`)
  } finally { await p.$disconnect() }
}
main()
