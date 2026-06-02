export const CHANGELOG_VERSION = '2026-06-02'

export interface ChangelogFeature {
  icon: string
  title: string
  description: string
  href: string
  color: string
  iconColor: string
  iconBg: string
  isNew?: boolean
}

export interface ChangelogEntry {
  version: string
  date: string
  features: ChangelogFeature[]
  improvements: string[]
}

export const CURRENT_CHANGELOG: ChangelogEntry = {
  version: '2026-06-02',
  date: 'Juni 2026',
  features: [
    {
      icon: 'calendar',
      title: 'Werkverdelingsgesprekken',
      description: 'Wekelijkse koppeling advocaat ↔ partner. De medewerker krijgt automatisch een Slack-DM met de afspraak.',
      href: '/dashboard/partners/werkverdelingsgesprekken',
      color: 'from-workx-lime/20 to-emerald-500/20',
      iconColor: 'text-workx-lime',
      iconBg: 'bg-workx-lime/10',
      isNew: true,
    },
    {
      icon: 'briefcase',
      title: 'Office',
      description: 'Wie is wanneer op kantoor of remote? Klik een cel om te wisselen — geen bewerkingsmodus, geen rompslomp.',
      href: '/dashboard/office',
      color: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      isNew: true,
    },
    {
      icon: 'star',
      title: 'Performance Management',
      description: 'Per advocaat een dossier voor ontwikkelpunten, doelen en beoordelingen.',
      href: '/dashboard/partners/performance',
      color: 'from-violet-500/20 to-fuchsia-500/20',
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      isNew: true,
    },
  ],
  improvements: [
    'Telefoon en email zichtbaar op elke teamkaart — klikbaar',
    'Notificatie in dashboard-bel bij debiteuren- of kosten-import',
    'Debiteuren samengevouwen per cliëntgroep (Stek, DeBrij, JB Law, Van Campen Liem)',
    'Tarieven-document met afwijkende cliënt-uurtarieven',
    'MT940-import: stabiele dedup en aparte BALANS-categorie voor waarborgsommen',
    'Sessie blijft 90 dagen actief — minder vaak opnieuw inloggen',
  ],
}
