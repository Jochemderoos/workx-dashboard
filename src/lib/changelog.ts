export const CHANGELOG_VERSION = '2026-03-01'

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
  version: '2026-03-01',
  date: 'Maart 2026',
  features: [
    {
      icon: 'file',
      title: 'Overdracht',
      description: 'Overdrachtsdocumenten bij afwezigheid: waarnemers toewijzen per zaak.',
      href: '/dashboard/werk/overdracht',
      color: 'from-purple-500/20 to-blue-500/20',
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10',
      isNew: true,
    },
    {
      icon: 'star',
      title: 'Certificaten',
      description: 'PO-punten en opleidingscertificaten bijhouden per medewerker.',
      href: '/dashboard/opleidingen',
      color: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      isNew: true,
    },
    {
      icon: 'briefcase',
      title: 'Ontwikkelplannen',
      description: 'Persoonlijke ontwikkelplannen met doelen en evaluaties.',
      href: '/dashboard/ontwikkelplannen',
      color: 'from-emerald-500/20 to-green-500/20',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      isNew: true,
    },
  ],
  improvements: [
    'Bonnetjes & declaraties: foto\'s uploaden per activiteit',
    'Weekoverzicht team met staafdiagram en kleurcodering',
    'Sidebar highlight werkt correct bij geneste pagina\'s',
  ],
}
