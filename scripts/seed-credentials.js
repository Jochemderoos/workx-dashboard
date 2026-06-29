const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find Jochem (PARTNER) as addedBy
  const jochem = await prisma.user.findFirst({ where: { email: 'jochem.deroos@workxadvocaten.nl' } })
  if (!jochem) {
    // Fallback: find any PARTNER
    const partner = await prisma.user.findFirst({ where: { role: 'PARTNER' } })
    if (!partner) throw new Error('Geen PARTNER user gevonden')
    var userId = partner.id
  } else {
    var userId = jochem.id
  }

  const credentials = [
    {
      service: 'Wifi kantoor',
      category: 'ICT',
      username: 'Netwerk: 4042',
      password: process.env.SEED_WIFI_PASSWORD || 'Vraag aan Hanna',
      notes: 'Kantoor WiFi netwerk',
    },
    {
      service: 'Trifact',
      category: 'Administratie',
      password: 'Vraag aan Hanna',
      notes: 'Factuurverwerking',
    },
    {
      service: 'Exact',
      category: 'Administratie',
      password: 'Vraag aan Hanna',
      notes: 'Boekhoudsoftware',
    },
    {
      service: 'KPN',
      category: 'ICT',
      username: 'Klantnr: 20204524722',
      password: 'Vraag aan Hanna',
      notes: 'Telefonie',
    },
    {
      service: 'KVK',
      category: 'Administratie',
      password: 'Vraag aan Hanna',
      notes: 'Kamer van Koophandel',
    },
    {
      service: 'Viking',
      category: 'Abonnementen',
      password: 'Vraag aan Hanna',
      notes: 'Kantoorbenodigdheden',
    },
    {
      service: 'Albert Heijn',
      category: 'Abonnementen',
      password: 'Vraag aan Hanna',
      notes: 'Boodschappen kantoor',
    },
    {
      service: 'Mailchimp',
      category: 'AI & Tools',
      password: 'Vraag aan Hanna',
      notes: 'Nieuwsbrieven',
    },
    {
      service: 'Bol.com / Coolblue',
      category: 'Abonnementen',
      password: 'Vraag aan Hanna',
      notes: 'Kantoorinkopen',
    },
    {
      service: 'PCI-Groep printer portal',
      category: 'ICT',
      password: 'Vraag aan Hanna',
      url: 'https://www.pci-groep.nl',
      notes: 'Printerbeheer en support: 088 543 08 08',
    },
  ]

  let created = 0
  for (const cred of credentials) {
    const existing = await prisma.sharedCredential.findFirst({
      where: { service: cred.service },
    })
    if (existing) {
      console.log(`  Skip: ${cred.service} (bestaat al)`)
      continue
    }
    await prisma.sharedCredential.create({
      data: { ...cred, addedById: userId },
    })
    console.log(`  + ${cred.service}`)
    created++
  }

  console.log(`\nKlaar: ${created} wachtwoorden toegevoegd`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
