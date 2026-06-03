// Seed initiële template-items voor onboarding-checklist.
// Idempotent: voegt alleen ontbrekende items toe (op title-match).

import { PrismaClient } from '@prisma/client'

const TEMPLATES: Array<{ title: string; description?: string; category: string }> = [
  // Hardware
  { title: 'Laptop verstrekt + door IT geïnstalleerd', category: 'Hardware', description: '365 Office licentie + standaard software' },
  { title: 'Mobiele telefoon verstrekt', category: 'Hardware' },
  { title: 'Overig advocaatgereedschap (toga, etc.)', category: 'Hardware', description: 'Bespreek wat nog ontbreekt' },

  // Accounts & Toegang
  { title: 'Workx e-mailadres aangemaakt', category: 'Accounts & Toegang' },
  { title: 'BaseNet toegang ingesteld', category: 'Accounts & Toegang', description: 'Dossier-systeem' },
  { title: 'Doxflow toegang (indien relevant)', category: 'Accounts & Toegang', description: 'Voor processtukken' },
  { title: 'Slack-account toegevoegd', category: 'Accounts & Toegang' },
  { title: 'Workx WhatsApp-groep toegevoegd', category: 'Accounts & Toegang' },
  { title: 'Workx Dashboard-account aangemaakt', category: 'Accounts & Toegang', description: 'Deze app' },
  { title: 'Wachtwoorden-overzicht gedeeld waar nodig', category: 'Accounts & Toegang' },

  // Wegwijs
  { title: 'Rondleiding kantoor', category: 'Wegwijs', description: 'Beneden + boven, ruimtes, postvak, lunch-plek' },
  { title: 'Voorgesteld aan het team', category: 'Wegwijs', description: 'Bij voorkeur tijdens lunch' },
  { title: 'Uitleg BaseNet (zoeken, dossier opbouwen)', category: 'Wegwijs' },
  { title: 'Uitleg Slack + statussen (geel/oranje/rood)', category: 'Wegwijs' },
  { title: 'Uitleg werkdag, kantoortijden en bereikbaarheid', category: 'Wegwijs' },
  { title: 'Uitleg overlegstructuur', category: 'Wegwijs', description: 'Dinsdag teammeeting, 3-wekelijkse JAR-bespreking, werkverdelingsgesprek' },
  { title: 'Mentor aangewezen', category: 'Wegwijs', description: 'Een van de partners — eerste afspraak inplannen' },
  { title: 'Appjeplekje-app gebruik uitgelegd', category: 'Wegwijs', description: 'Werkplek reserveren' },

  // HR & Beleid
  { title: 'Arbeidsovereenkomst ondertekend', category: 'HR & Beleid' },
  { title: 'The Way it Workx doorgelezen', category: 'HR & Beleid', description: 'Personeelshandboek — zie Workx Docs' },
  { title: 'Klachtenregeling toegelicht', category: 'HR & Beleid' },
  { title: 'Vertrouwenspersoon-info gegeven', category: 'HR & Beleid', description: 'Intern: Marlieke. Extern: Marcel Boshuizen / Sjakkelien Marlet' },
  { title: 'BHV-info gegeven', category: 'HR & Beleid', description: 'BHV\'ers: Marnix, Justine, Hanna' },
  { title: 'Verzuimprotocol uitgelegd', category: 'HR & Beleid' },

  // Werkplek
  { title: 'Werkplek toegewezen + sleutels/badge', category: 'Werkplek' },
  { title: 'Postvak ingericht', category: 'Werkplek' },
  { title: 'Workx-fiets ontvangen 🚲', category: 'Werkplek', description: 'De legendarische Workx-fiets!' },

  // Eerste maand
  { title: 'Eerste werkverdelingsgesprek gepland', category: 'Eerste maand' },
  { title: 'Eerste mentor-gesprek gehad', category: 'Eerste maand' },
  { title: 'Ontwikkelplan opgesteld', category: 'Eerste maand', description: 'Inhoudelijke kennis, ervaring, ondernemerschap' },
  { title: 'Coachbudget besproken', category: 'Eerste maand', description: '€ 1.500 ex BTW per 3 jaar + 2x coaching onder werktijd' },
  { title: 'PO-puntenplanning besproken', category: 'Eerste maand', description: '20 PO-punten/jaar, min. 12 arbeidsrecht' },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-onboarding-templates] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    // SortOrder = volgorde binnen categorie
    const categoryOrder = new Map<string, number>()
    const toCreate: typeof TEMPLATES = []

    for (const t of TEMPLATES) {
      const exists = await prisma.onboardingTemplate.findFirst({ where: { title: t.title } })
      if (exists) continue
      toCreate.push(t)
    }

    for (const t of toCreate) {
      const so = (categoryOrder.get(t.category) ?? -1) + 1
      categoryOrder.set(t.category, so)
      await prisma.onboardingTemplate.create({
        data: {
          title: t.title,
          description: t.description ?? null,
          category: t.category,
          sortOrder: so,
        },
      })
    }
    if (toCreate.length > 0) {
      console.log(`[seed-onboarding-templates] ${toCreate.length} nieuwe templates aangemaakt`)
    } else {
      console.log('[seed-onboarding-templates] alle templates bestonden al')
    }
  } catch (err) {
    console.error('[seed-onboarding-templates] mislukt:', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()