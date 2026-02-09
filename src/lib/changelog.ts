export const CHANGELOG_VERSION = '2026-02-09'

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
  version: '2026-02-09',
  date: 'Feb 2026',
  features: [
    {
      icon: 'sparkles',
      title: 'AI Assistent',
      description: 'Stel juridische vragen, analyseer documenten en zoek jurisprudentie met Claude AI.',
      href: '/dashboard/ai',
      color: 'from-violet-500/20 to-blue-500/20',
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      isNew: true,
    },
    {
      icon: 'file',
      title: 'Pitch Maker',
      description: 'Genereer professionele team pitches en profielen als PDF.',
      href: '/dashboard/pitch',
      color: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-400',
      iconBg: 'bg-blue-500/10',
      isNew: true,
    },
    {
      icon: 'printer',
      title: 'Workxflow',
      description: 'Print dagvaardingen en producties klaar voor de rechtbank.',
      href: '/dashboard/workxflow',
      color: 'from-emerald-500/20 to-green-500/20',
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      isNew: true,
    },
  ],
  improvements: [
    'AI Assistent nu ook beschikbaar op mobiel',
    'Anonimiseer-optie voor persoonsgegevens in AI chat',
    'Appjeplekje slaat weekenden automatisch over',
    'Nieuwsbrief-herinneringen op het dashboard',
  ],
}
