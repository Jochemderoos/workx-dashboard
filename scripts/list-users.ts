import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { name: true, email: true, role: true },
    orderBy: { name: 'asc' }
  })

  console.log('Actieve gebruikers:\n')
  users.forEach(u => {
    const role = u.role === 'PARTNER' ? '(Partner)' : u.role === 'ADMIN' ? '(Admin)' : ''
    console.log(`- ${u.name} — ${u.email} ${role}`)
  })
  console.log(`\nTotaal: ${users.length} gebruikers`)
}

main().finally(() => prisma.$disconnect())
