// Idempotente seed van de hoofdstukken + taken uit het Word-document
// "Overzicht taken Workx". Voegt alleen toe wat ontbreekt; raakt
// bestaande records (incl. ingevulde verantwoordelijken) niet aan.

import { PrismaClient } from '@prisma/client'

interface ChapterSeed {
  name: string
  tasks: string[]
}

const SEED: ChapterSeed[] = [
  { name: 'Accountmanagement', tasks: [
    'Corporate kantoren',
    'Internationaal netwerk',
    'Seminar / webinar',
    'Nieuwsbrief',
    '(Kerst) relatiegeschenk',
    'Bijhouden relatiebestand Mailchimp',
  ] },
  { name: 'Acquisitie', tasks: [
    'Score bord bijhouden',
    'Lauwe acquisitie / tasjes',
    'Evenementen',
    'Pitch docs',
  ] },
  { name: 'Know How', tasks: [
    'Cursussen intern',
    'Modellen',
    'Standaard adviezen',
    'Abonnementen / boeken',
    'Beleid werkwijze',
  ] },
  { name: 'Marketing', tasks: [
    'Social media',
    'SEO / Google',
    'Chambers',
    'Legal 500',
  ] },
  { name: 'Team building', tasks: [
    'Jaarlijkse trip',
    'Tweemaandelijks uitje',
    'Werkoverleg',
    '10 jaar Workx',
    'Workx talk / walk',
  ] },
  { name: 'Financiën', tasks: [
    'Kwartaalcijfers bespreken',
    'Debiteuren check',
    'Bonussen medewerkers',
    'Facturen',
    'Uren',
    'Budgetten',
  ] },
  { name: 'HR', tasks: [
    'Verzoeken medewerkers',
    'Beoordelingen',
    'Ontwikkelgesprekken',
    'Vakantieplanning',
    'Werving',
    'Onboarding',
    'Pensioen',
  ] },
  { name: 'Kantoorzaken', tasks: [
    'Facilitair',
    'IT',
    'Website',
    'Veilige en fijne werkomgeving',
    'Bewaken huisstijl',
    'Thuiswerken',
    'Afstemmen / aanspreekpunt Hanna',
    'Verzekeringen / contracten',
    'WWFT / Orde',
    'Werkstudent',
    'Jr. office manager',
    'Bijhouden "The Way it Workx"',
  ] },
  { name: 'Werkverdeling', tasks: [
    'Inventariseren en herverdeling',
    'Dinsdagochtendsessie werkverdeling',
    'Uren',
    'Jaaragenda',
    'Evaluatie verdeling verantwoordelijkheden',
  ] },
  { name: 'Partneroverleg', tasks: [
    'Organisatie heisessie',
    'Succession planning',
    'Visie Workx',
    'Wekelijks overleg',
    'Workx onderneemt',
    'One-Team-Workx',
    'Mentorschap / begeleiding evaluatie',
  ] },
]

export async function main(externalPrisma?: PrismaClient) {
  if (!process.env.DATABASE_URL) {
    console.log('[seed-partner-tasks] geen DATABASE_URL — overslaan')
    return
  }
  const prisma = externalPrisma ?? new PrismaClient()
  try {
    let chaptersAdded = 0
    let tasksAdded = 0

    for (let i = 0; i < SEED.length; i++) {
      const seed = SEED[i]
      let chapter = await prisma.partnerTaskChapter.findFirst({ where: { name: seed.name } })
      if (!chapter) {
        chapter = await prisma.partnerTaskChapter.create({
          data: { name: seed.name, sortOrder: i },
        })
        chaptersAdded++
      }
      for (let j = 0; j < seed.tasks.length; j++) {
        const taskName = seed.tasks[j]
        const existing = await prisma.partnerTask.findFirst({
          where: { chapterId: chapter.id, task: taskName },
        })
        if (!existing) {
          await prisma.partnerTask.create({
            data: { chapterId: chapter.id, task: taskName, sortOrder: j },
          })
          tasksAdded++
        }
      }
    }

    console.log(`[seed-partner-tasks] ${chaptersAdded} hoofdstuk(ken) en ${tasksAdded} taak/taken toegevoegd`)
  } catch (err) {
    console.error('[seed-partner-tasks] mislukt (build gaat door):', err)
  } finally {
    if (!externalPrisma) await prisma.$disconnect().catch(() => {})
  }
}

if (require.main === module) main()