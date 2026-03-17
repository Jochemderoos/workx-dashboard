export const CHANGELOG_VERSION = '2026-03-17'

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
  version: '2026-03-17',
  date: 'Maart 2026',
  features: [
    {
      icon: 'sun',
      title: 'Light Mode',
      description: 'Wissel tussen donker en licht thema via de toggle in de sidebar (onderaan). Je voorkeur wordt onthouden.',
      href: '/dashboard',
      color: 'from-amber-500/20 to-yellow-500/20',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      isNew: true,
    },
    {
      icon: 'sparkles',
      title: 'Claude-only modus',
      description: 'Paarse knop naast het invoerveld: snel antwoord zonder juridische bronnen. Perfect voor vertalingen en e-mails.',
      href: '/dashboard/ai',
      color: 'from-purple-500/20 to-indigo-500/20',
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10',
      isNew: true,
    },
    {
      icon: 'users',
      title: 'Werkstudent',
      description: 'Overzicht van opdrachten aan de werkstudent: deadline, prioriteit en status bijhouden.',
      href: '/dashboard/werkstudent',
      color: 'from-cyan-500/20 to-blue-500/20',
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      isNew: true,
    },
  ],
  improvements: [
    'AI Assistent geeft nu direct antwoord zonder eerst vragen te stellen',
    'Verbeterde documentverwerking bij het uploaden van bestanden naar AI',
    'Toggle voor donker/licht thema is prominenter in de sidebar',
  ],
}
