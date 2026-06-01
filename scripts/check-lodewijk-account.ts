import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  const lodewijk = await p.user.findFirst({
    where: { name: { contains: 'Lodewijk' } },
    select: { id: true, name: true, email: true, role: true, isActive: true, password: true }
  })
  if (lodewijk) {
    console.log('Bestaand account gevonden:')
    console.log('  Naam: ' + lodewijk.name)
    console.log('  Email: ' + lodewijk.email)
    console.log('  Role: ' + lodewijk.role)
    console.log('  Actief: ' + lodewijk.isActive)
    console.log('  Heeft wachtwoord: ' + (lodewijk.password ? 'ja' : 'nee'))
  } else {
    console.log('Geen Lodewijk account gevonden')
  }
  await p.$disconnect()
}

main()
