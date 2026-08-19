// Onderwerpen die een gebruiker op de homepage kan pinnen (bovenaan of als
// snelkoppeling). Icon is een key in Icons; badge verwijst naar een live-teller.

export type BadgeKey = 'declaraties' | 'mailchimp'

export interface PinnableWidget {
  key: string
  label: string
  sub: string
  href: string
  icon: string // key in components/ui/Icons
  color: string // tailwind text+bg classes voor het icoon-vlak
  badge?: BadgeKey
}

export const PINNABLE_WIDGETS: PinnableWidget[] = [
  { key: 'office', label: 'Office', sub: 'Aanwezigheid', href: '/dashboard/office', icon: 'building', color: 'text-blue-400 bg-blue-500/10' },
  { key: 'declaraties', label: 'Declaraties', sub: 'Open declaraties', href: '/dashboard/declaraties', icon: 'euro', color: 'text-workx-lime bg-workx-lime/10', badge: 'declaraties' },
  { key: 'debiteuren', label: 'Debiteuren', sub: 'Bijwerken', href: '/dashboard/debiteuren', icon: 'fileText', color: 'text-orange-400 bg-orange-500/10' },
  { key: 'opleidingen', label: 'Opleidingen', sub: 'Cursussen & JAR', href: '/dashboard/opleidingen', icon: 'graduationCap', color: 'text-pink-400 bg-pink-500/10' },
  { key: 'mailchimp', label: 'Mailchimp', sub: 'Nieuwe contacten', href: '/dashboard/mailchimp', icon: 'mail', color: 'text-purple-400 bg-purple-500/10', badge: 'mailchimp' },
  { key: 'agenda', label: 'Agenda', sub: 'Events & verjaardagen', href: '/dashboard/agenda', icon: 'calendar', color: 'text-blue-400 bg-blue-500/10' },
  { key: 'appjeplekje', label: 'Appjeplekje', sub: 'Werkplek reserveren', href: '/dashboard/appjeplekje', icon: 'building', color: 'text-emerald-400 bg-emerald-500/10' },
  { key: 'vakanties', label: 'Vakanties', sub: 'Verlof aanvragen', href: '/dashboard/vakanties', icon: 'calendar', color: 'text-cyan-400 bg-cyan-500/10' },
  { key: 'eigen-taken', label: 'Eigen taken', sub: 'Jouw takenlijst', href: '/dashboard/eigen-taken', icon: 'check', color: 'text-green-400 bg-green-500/10' },
  { key: 'jaaragenda', label: 'Jaaragenda', sub: 'Planning', href: '/dashboard/jaaragenda', icon: 'calendar', color: 'text-indigo-400 bg-indigo-500/10' },
  { key: 'bonus', label: 'Bonus', sub: 'Berekeningen', href: '/dashboard/bonus', icon: 'euro', color: 'text-green-400 bg-green-500/10' },
  { key: 'team', label: 'Team', sub: 'Wie is wie', href: '/dashboard/team', icon: 'users', color: 'text-indigo-400 bg-indigo-500/10' },
  { key: 'bevriende-kantoren', label: 'Bevriende kantoren', sub: 'Doorverwijzen', href: '/dashboard/bevriende-kantoren', icon: 'briefcase', color: 'text-amber-400 bg-amber-500/10' },
  { key: 'wachtwoorden', label: 'Wachtwoorden', sub: 'Inloggegevens', href: '/dashboard/wachtwoorden', icon: 'lock', color: 'text-slate-300 bg-slate-500/10' },
  { key: 'werk', label: 'Wie doet Wat', sub: 'Werkverdeling', href: '/dashboard/werk', icon: 'users', color: 'text-blue-400 bg-blue-500/10' },
]

export const PINNABLE_BY_KEY: Record<string, PinnableWidget> = Object.fromEntries(
  PINNABLE_WIDGETS.map(w => [w.key, w])
)

// Standaard-pins voor het office-team (Hanna/Lotte/Bente) als ze nog niets zelf
// hebben ingesteld: de vijf office-kernvakjes, bovenaan.
export const OFFICE_DEFAULT_TOP = ['office', 'declaraties', 'debiteuren', 'opleidingen', 'mailchimp']

export function isOfficeRole(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

// De sentinel-key waarmee we markeren dat een gebruiker bewust heeft aangepast.
export const CUSTOMIZED_SENTINEL = '__customized__'
