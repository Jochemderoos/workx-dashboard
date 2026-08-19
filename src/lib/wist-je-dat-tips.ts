// "Wist je dat?" tips per dashboard-pagina.
// Eén tip per dag — deterministisch bepaald op basis van de dagindex sinds 2026-01-01.
// Partners krijgen extra tips voor de partner-pagina's.

export interface DashboardTip {
  page: string // korte naam van de pagina
  href: string
  title: string // "Wist je dat?" titel (komt in de bell-melding)
  message: string // 1 zin uitleg wat je daar kunt
}

const EPOCH = new Date('2026-01-01T00:00:00Z').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

export function daysSinceEpoch(now: Date = new Date()): number {
  return Math.floor((now.getTime() - EPOCH) / DAY_MS)
}

// Tips beschikbaar voor iedereen
export const GENERAL_TIPS: DashboardTip[] = [
  {
    page: 'Homepage',
    href: '/dashboard',
    title: '💡 Wist je dat? — Je eigen homepage',
    message: 'Klik bovenaan op "Homepage aanpassen" om zelf te kiezen welke onderdelen je bovenaan of als snelkoppeling ziet — en sleep de rijen in je eigen volgorde.',
  },
  {
    page: 'Overzicht',
    href: '/dashboard/overzicht',
    title: '💡 Wist je dat? — Site-overzicht',
    message: 'Op de Overzicht-pagina vind je een sitemap van het hele dashboard met per pagina een korte beschrijving.',
  },
  {
    page: 'Appjeplekje',
    href: '/dashboard/appjeplekje',
    title: '💡 Wist je dat? — Appjeplekje',
    message: 'Reserveer je werkplek voor de dag op kantoor en zie meteen wie er die dag is.',
  },
  {
    page: 'Agenda',
    href: '/dashboard/agenda',
    title: '💡 Wist je dat? — Agenda',
    message: 'De gezamenlijke agenda toont afspraken, events, kantoor-dagen en feestdagen in één overzicht.',
  },
  {
    page: 'Vakanties & Verlof',
    href: '/dashboard/vakanties',
    title: '💡 Wist je dat? — Vakanties & Verlof',
    message: 'Vraag hier vakantie aan, check je saldo en zie in rood de schoolvakanties Noord-Holland (rode periodes).',
  },
  {
    page: 'Opleidingen',
    href: '/dashboard/opleidingen',
    title: '💡 Wist je dat? — Opleidingen',
    message: 'Bekijk hier je PO-punten, certificaten én het JAR-rooster. Twee weken voor jouw beurt krijg je een reminder.',
  },
  {
    page: 'Wie doet Wat',
    href: '/dashboard/werk',
    title: '💡 Wist je dat? — Wie doet Wat',
    message: 'Zie wie waaraan werkt deze week en welke verantwoordelijkheden over het team verdeeld zijn.',
  },
  {
    page: 'Werkoverleg',
    href: '/dashboard/werkoverleg',
    title: '💡 Wist je dat? — Werkoverleg',
    message: 'De agenda, notulen en actiepunten van het dinsdagoverleg staan hier — je kunt zelf agendapunten inbrengen.',
  },
  {
    page: 'Mijn werkweek',
    href: '/dashboard/mijn-werkweek',
    title: '💡 Wist je dat? — Mijn werkweek',
    message: 'Vul wekelijks (vanaf do 15:00 tot ma 10:00) in wat je liggen hebt en hoe je beschikbaarheid is. Partners gebruiken het bij het werkverdelingsgesprek.',
  },
  {
    page: 'Office',
    href: '/dashboard/office',
    title: '💡 Wist je dat? — Office',
    message: 'Zie wie van de back office wanneer op kantoor of remote werkt + hoe de kantoortelefoon wordt opgevangen. Twee weken vooruit zichtbaar.',
  },
  {
    page: 'Overdracht',
    href: '/dashboard/werk/overdracht',
    title: '💡 Wist je dat? — Overdracht',
    message: 'Bij vakantie of verlof vul je hier het overdrachtsdocument in voor je waarnemers.',
  },
  {
    page: 'Ontwikkelplannen',
    href: '/dashboard/ontwikkelplannen',
    title: '💡 Wist je dat? — Ontwikkelplannen',
    message: 'Houd hier samen met je mentor je persoonlijke ontwikkelplan bij: kennis, ervaring en ondernemerschap.',
  },
  {
    page: 'Debiteuren',
    href: '/dashboard/debiteuren',
    title: '💡 Wist je dat? — Debiteuren',
    message: 'Het overzicht openstaande facturen — met aanschrijven-knop en BaseNet-import voor het hele kantoor.',
  },
  {
    page: 'Eigen taken',
    href: '/dashboard/eigen-taken',
    title: '💡 Wist je dat? — Eigen taken',
    message: 'Je persoonlijke takenlijst, inclusief actiepunten die uit het partneroverleg naar jou zijn toegewezen.',
  },
  {
    page: 'Onboarding',
    href: '/dashboard/onboarding',
    title: '💡 Wist je dat? — Onboarding',
    message: 'Een complete onboarding-checklist voor nieuwe medewerkers, met items om af te vinken en notities toe te voegen.',
  },
  {
    page: 'Mijn coachingbudget',
    href: '/dashboard/arbeidsvoorwaarden',
    title: '💡 Wist je dat? — Coaching-budget',
    message: 'Je hebt €1.500 ex btw per 3 jaar voor een eigen coach. Houd hier zelf bij wat je hebt besteed.',
  },
  {
    page: 'Bonus',
    href: '/dashboard/bonus',
    title: '💡 Wist je dat? — Bonusregeling',
    message: 'Houd je eigen omzet bij en dien één keer per kwartaal je bonusoverzicht in. Hanna verwerkt het.',
  },
  {
    page: 'Transitievergoeding',
    href: '/dashboard/transitie',
    title: '💡 Wist je dat? — Transitievergoeding',
    message: 'Bereken snel een transitievergoeding op basis van salaris en duur dienstverband.',
  },
  {
    page: 'Declaraties',
    href: '/dashboard/declaraties',
    title: '💡 Wist je dat? — Declaraties',
    message: 'Dien onkosten en reiskosten in met bonnetje. Doorbelasten aan een zaak kan ook met één klik.',
  },
  {
    page: 'Workx Docs',
    href: '/dashboard/hr-docs',
    title: '💡 Wist je dat? — Workx Docs',
    message: 'The Way it Workx, Kantoorhandboek, Klachtenregeling, Wachtwoorden, Salarishuis, Tarieven en Stappenplan partner staan hier allemaal.',
  },
  {
    page: 'Bevriende kantoren',
    href: '/dashboard/bevriende-kantoren',
    title: '💡 Wist je dat? — Bevriende kantoren',
    message: 'De lijst nationale en internationale bevriende kantoren — met contactgegevens en wie bij ons de contact heeft.',
  },
  {
    page: 'Team',
    href: '/dashboard/team',
    title: '💡 Wist je dat? — Team',
    message: 'Alle Workx-collega\'s met foto, contactgegevens en rol — handig om snel iemand te vinden.',
  },
  {
    page: 'Wachtwoorden',
    href: '/dashboard/hr-docs?doc=wachtwoorden',
    title: '💡 Wist je dat? — Wachtwoorden',
    message: 'Gedeelde inloggegevens en belangrijke services (Doxflow, BaseNet, Constant IT, etc.) vind je in Workx Docs.',
  },
  {
    page: 'Salarishuis',
    href: '/dashboard/hr-docs?doc=salarishuis',
    title: '💡 Wist je dat? — Salarishuis',
    message: 'Het bruto maandsalaris per ervaringsjaar (indicatief). Voor de bijbehorende uurtarieven én afwijkende klant-tarieven, zie Workx Docs → Tarieven.',
  },
  {
    page: 'Tarieven',
    href: '/dashboard/hr-docs?doc=tarieven',
    title: '💡 Wist je dat? — Tarieven',
    message: 'Standaard uurtarieven per ervaringsjaar én afwijkende klant-tarieven (Lineage, Accenture, Achmea, etc.) op één plek.',
  },
  {
    page: 'Notulen partner',
    href: '/dashboard/partners/notulen',
    title: '💡 Wist je dat? — Partner agenda/notulen',
    message: 'Iedere partner kan agendapunten inbrengen voor het maandelijkse overleg en actiepunten zijn zichtbaar voor iedereen die ze krijgt toegewezen.',
  },
  {
    page: 'Workx Docs — JAR-rooster',
    href: '/dashboard/opleidingen',
    title: '💡 Wist je dat? — JAR ruilen',
    message: 'Kun je niet op jouw JAR-beurt? Je kunt direct in het JAR-rooster ruilen met een collega via een dropdown.',
  },
  {
    page: 'Sitemap-filter',
    href: '/dashboard/overzicht',
    title: '💡 Wist je dat? — Snel zoeken',
    message: 'In de sidebar staat een zoekbalk waarmee je razendsnel kunt filteren op pagina-naam.',
  },
]

// Extra tips alleen voor PARTNER/ADMIN
export const PARTNER_TIPS: DashboardTip[] = [
  {
    page: 'Partner agenda/notulen',
    href: '/dashboard/partners/notulen',
    title: '💡 Wist je dat? — Partner-notulen',
    message: 'Per maand een eigen agenda met agendapunten, notulen en actiepunten. Je kunt punten direct doorzetten naar de volgende agenda.',
  },
  {
    page: 'Verantwoordelijk',
    href: '/dashboard/partners/verantwoordelijk',
    title: '💡 Wist je dat? — Verantwoordelijkheden',
    message: 'Verdeel verantwoordelijkheden per hoofdstuk over het team en publiceer de uitkomst naar Wie doet Wat.',
  },
  {
    page: 'Werkverdelingsgesprekken',
    href: '/dashboard/partners/werkverdelingsgesprekken',
    title: '💡 Wist je dat? — Werkverdelingsgesprekken',
    message: 'Houd de wekelijkse 1-op-1 gesprekken met medewerkers bij — medewerker-input (Mijn werkweek) staat automatisch in beeld.',
  },
  {
    page: 'Performance Management',
    href: '/dashboard/partners/performance',
    title: '💡 Wist je dat? — Performance Management',
    message: 'Noteer per medewerker observaties (positief of kritisch) met één klik. Vormt de onderbouwing voor beoordelingsgesprekken.',
  },
  {
    page: 'Sollicitaties',
    href: '/dashboard/recruitment/sollicitaties',
    title: '💡 Wist je dat? — Sollicitaties',
    message: 'Beheer sollicitanten, upload CV\'s, plan gesprekken en houd het sollicitatiebeleid up-to-date.',
  },
  {
    page: 'Financien',
    href: '/dashboard/financien',
    title: '💡 Wist je dat? — Financien',
    message: 'Omzet, kosten, saldo en concept jaarrekening per jaar — inclusief automatische VPB-berekening.',
  },
  {
    page: 'Kosten',
    href: '/dashboard/kosten',
    title: '💡 Wist je dat? — Kosten',
    message: 'Importeer MT940-bankafschriften, categoriseer transacties en houd vendor-aliases bij voor automatische categorisatie.',
  },
  {
    page: 'Partner werk',
    href: '/dashboard/partners/werk',
    title: '💡 Wist je dat? — Partner werk',
    message: 'Eigen partner-werkoverzicht met planning en lopende zaken op partnerniveau.',
  },
]

// Kies de tip van vandaag — deterministisch, zodat iedereen op dezelfde dag dezelfde tip ziet.
export function getTipOfTheDay(isPartner: boolean, now: Date = new Date()): DashboardTip {
  const pool = isPartner ? [...GENERAL_TIPS, ...PARTNER_TIPS] : GENERAL_TIPS
  const idx = Math.abs(daysSinceEpoch(now)) % pool.length
  return pool[idx]
}

// Notificatie-key per dag (YYYY-MM-DD) — zodat dismissal per dag werkt en de tip morgen weer verschijnt.
export function tipKeyForDay(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `wist-je-dat-${y}-${m}-${d}`
}
