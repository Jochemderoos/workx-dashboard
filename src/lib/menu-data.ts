// Centrale plek waar alle sidebar-pagina's en hun beschrijvingen staan.
// Wordt gebruikt door:
//  - Sidebar.tsx (desktop navigatie)
//  - app/dashboard/overzicht/page.tsx (sitemap-overzicht)
// Wijzig hier → beide updaten automatisch.

import { Icons } from '@/components/ui/Icons'

export interface MenuItem {
  href: string
  icon: typeof Icons.home
  label: string
  iconAnim?: string
  badge?: string
  hideForExternal?: boolean
  partnerOnly?: boolean // alleen PARTNER/ADMIN — verbergt voor EMPLOYEE in overzicht & sidebar
  description?: string // Toegelicht voor het overzicht
  children?: MenuItem[] // sub-items voor uitklap in sidebar
}

// ─── TEAM — algemene pagina's voor iedereen ─────────────────────────────────

export const teamMenu_Algemeen: MenuItem[] = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard', iconAnim: 'icon-home-hover',
    description: 'Startpagina met persoonlijke widgets, kalender, taken en reminders.' },
  { href: '/dashboard/overzicht', icon: Icons.layers, label: 'Overzicht', iconAnim: 'icon-layers-hover',
    description: 'Sitemap: alle pagina\'s in het dashboard met beschrijving, klik-door naar elke pagina.' },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', iconAnim: 'icon-party-hover', badge: '15 jaar!',
    description: 'Programma, vluchtgegevens, paklijst en aftelteller voor de Mallorca-trip.' },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje', iconAnim: 'icon-mappin-hover',
    description: 'Reserveer je werkplek op kantoor. Zie wie er vandaag is.' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda', iconAnim: 'icon-calendar-hover',
    description: 'Gezamenlijke agenda voor afspraken, events en kantoor-dagen.' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof', iconAnim: 'icon-sun-hover', hideForExternal: true,
    description: 'Vakantie-aanvragen, saldo, ouderschapsverlof en planning per team.' },
  { href: '/dashboard/opleidingen', icon: Icons.graduationCap, label: 'Opleidingen', iconAnim: 'icon-graduation-hover',
    description: 'Workx-opleiding, PO-puntenoverzicht, certificaten en JAR-rooster.' },
]

export const teamMenu_Werk: MenuItem[] = [
  { href: '/dashboard/werk', icon: Icons.users, label: 'Wie doet Wat', iconAnim: 'icon-briefcase-hover',
    description: 'Lopende werkverdeling en verantwoordelijkheden over het team.' },
  { href: '/dashboard/werkoverleg', icon: Icons.presentation, label: 'Werkoverleg', iconAnim: 'icon-file-hover',
    description: 'Wekelijks teamoverleg op dinsdag — actiepunten en notulen.' },
  { href: '/dashboard/werk/overdracht', icon: Icons.fileText, label: 'Overdracht', iconAnim: 'icon-file-hover',
    description: 'Overdrachtsdocumenten bij vakantie/verlof. Klant-wijzen en lopende zaken.' },
  { href: '/dashboard/ontwikkelplannen', icon: Icons.target, label: 'Ontwikkelplannen', iconAnim: 'icon-target-hover', hideForExternal: true,
    description: 'Persoonlijk ontwikkelplan: inhoudelijke kennis, ervaring, ondernemerschap.' },
  { href: '/dashboard/debiteuren', icon: Icons.fileText, label: 'Debiteuren', iconAnim: 'icon-file-hover', hideForExternal: true,
    description: 'Openstaande facturen, aanschrijven-knop, BaseNet-import voor het hele kantoor.' },
  { href: '/dashboard/dd-projecten', icon: Icons.shield, label: 'DD Projecten', iconAnim: 'icon-briefcase-hover', hideForExternal: true,
    description: 'Due-diligence projecten met team-toewijzing en status.' },
]

export const teamMenu_Tools: MenuItem[] = [
  { href: '/dashboard/eigen-taken', icon: Icons.check, label: 'Eigen taken', iconAnim: 'icon-check-hover',
    description: 'Persoonlijke takenlijst incl. actiepunten uit het partneroverleg.' },
  { href: '/dashboard/onboarding', icon: Icons.userPlus, label: 'Onboarding', iconAnim: 'icon-user-hover',
    description: 'Onboarding-checklist voor nieuwe medewerkers. Items afvinken + notities.' },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus', iconAnim: 'icon-euro-hover', hideForExternal: true,
    description: 'Bonusregeling-overzicht: eigen omzet en uitkering per kwartaal.' },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitievergoeding', iconAnim: 'icon-calculator-hover',
    description: 'Bereken transitievergoeding obv salaris en duur dienstverband.' },
  { href: '/dashboard/declaraties', icon: Icons.euro, label: 'Declaraties', iconAnim: 'icon-euro-hover', hideForExternal: true,
    description: 'Onkostendeclaraties met bonnetjes en goedkeurings-flow.' },
]

export const teamMenu_Docs: MenuItem[] = [
  { href: '/dashboard/hr-docs', icon: Icons.books, label: 'Workx Docs', iconAnim: 'icon-books-hover', hideForExternal: true,
    description: 'The Way it Workx, Kantoorhandboek, Klachtenregeling, Wachtwoorden, Salarishuis, Stappenplan partner.',
    children: [
      { href: '/dashboard/hr-docs?doc=the-way-it-workx', icon: Icons.smile, label: 'The Way it Workx', description: 'Personeelshandboek: welkom, start, werkplek, team, ontwikkelen, veilig werken, vakantie, beloning.' },
      { href: '/dashboard/hr-docs?doc=kantoorhandboek', icon: Icons.shield, label: 'Kantoorhandboek', description: 'Vakbekwaamheid, kantoororganisatie, Wwft, Stichting Derdengelden.' },
      { href: '/dashboard/hr-docs?doc=klachtenregeling', icon: Icons.fileText, label: 'Klachtenregeling', description: 'Procedure bij klachten van cliënten.' },
      { href: '/dashboard/hr-docs?doc=wachtwoorden', icon: Icons.lock, label: 'Wachtwoorden', description: 'Gedeelde inloggegevens en belangrijke services.' },
      { href: '/dashboard/hr-docs?doc=salarishuis', icon: Icons.euro, label: 'Salarishuis', description: 'Indicatieve salarisschalen per ervaringsjaar.' },
      { href: '/dashboard/hr-docs?doc=stappenplan-partner', icon: Icons.target, label: 'Stappenplan partner', description: 'Counsel → Director → Partner groeipad.' },
      { href: '/dashboard/hr-docs?doc=knowhow-officemanagement', icon: Icons.briefcase, label: 'Know how — Office Management', description: 'Telefoonnummers, inloggegevens, BaseNet tips, Doxflow.' },
    ] },
  { href: '/dashboard/bevriende-kantoren', icon: Icons.building, label: 'Bevriende kantoren', iconAnim: 'icon-briefcase-hover',
    description: 'Lijst nationale en internationale bevriende advocatenkantoren met contactinfo.' },
  { href: '/dashboard/team', icon: Icons.users, label: 'Team', iconAnim: 'icon-users-hover',
    description: 'Alle Workx-collega\'s met foto, contactgegevens en rol.' },
]

// ─── PARTNER — alleen voor PARTNER en ADMIN ─────────────────────────────────

export const partnersMenuItems: MenuItem[] = [
  { href: '/dashboard/partners/werk', icon: Icons.briefcase, label: 'Werk', iconAnim: 'icon-briefcase-hover',
    description: 'Partner-werk overzicht en planning.' },
  { href: '/dashboard/partners/verantwoordelijk', icon: Icons.users, label: 'Verantwoordelijk', iconAnim: 'icon-users-hover',
    description: 'Verdeel verantwoordelijkheden per hoofdstuk over het team. Publiceer naar Wie doet Wat.' },
  { href: '/dashboard/partners/notulen', icon: Icons.fileText, label: 'Partner agenda/notulen', iconAnim: 'icon-file-hover',
    description: 'Partner-overleg notulen per maand met agendapunten en actiepunten.' },
  { href: '/dashboard/partners/werkverdelingsgesprekken', icon: Icons.chat, label: 'Werkverdelingsgesprekken', iconAnim: 'icon-chat-hover',
    description: 'Wekelijkse 1-op-1 gesprekken partner ↔ medewerker.' },
  { href: '/dashboard/partners/sollicitaties', icon: Icons.userPlus, label: 'Sollicitaties', iconAnim: 'icon-user-hover',
    description: 'Sollicitanten beheren, CVs uploaden, gesprekken plannen + sollicitatiebeleid.' },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financien', iconAnim: 'icon-piechart-hover',
    description: 'Omzet/kosten/saldo overzicht, jaarrekening.' },
  { href: '/dashboard/kosten', icon: Icons.euro, label: 'Kosten', iconAnim: 'icon-euro-hover',
    description: 'MT940-import, categorieën, vendor-aliases voor financiële administratie.' },
]

// ─── EXTRA — laag-gebruikt, uitklapbaar ─────────────────────────────────────

export const extraMenuItems: MenuItem[] = [
  { href: '/dashboard/werkstudent', icon: Icons.clipboard, label: 'Werkstudent', iconAnim: 'icon-file-hover',
    description: 'Tooling voor de werkstudent.' },
  { href: '/dashboard/workxflow', icon: Icons.printer, label: 'Workxflow', iconAnim: 'icon-file-hover', hideForExternal: true,
    description: 'Workflow voor het printen/voorbereiden van dagvaardingen.' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling', iconAnim: 'icon-layers-hover',
    description: 'Afspiegelingsbeginsel calculator voor reorganisaties.' },
  { href: '/dashboard/pitch', icon: Icons.file, label: 'Pitch Maker', iconAnim: 'icon-file-hover', hideForExternal: true,
    description: 'Bouw een pitch-PDF voor klanten met teamleden en cases.' },
]

// ─── BEHEER ─────────────────────────────────────────────────────────────────

export const manageMenuItems: MenuItem[] = [
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback', iconAnim: 'icon-chat-hover',
    description: 'Stuur feedback, ideeën of bug-meldingen.' },
  { href: '/dashboard/settings', icon: Icons.settings, label: 'Instellingen', iconAnim: 'icon-settings-hover',
    description: 'Persoonlijke instellingen en accountbeheer.' },
]

// ─── EXPORT: alle hrefs voor active-state matching ──────────────────────────

export const allMenuHrefs = [
  ...teamMenu_Algemeen,
  ...teamMenu_Werk,
  ...teamMenu_Tools,
  ...teamMenu_Docs,
  ...partnersMenuItems,
  ...extraMenuItems,
  ...manageMenuItems,
].map(i => i.href)

// ─── SECTIE-STRUCTUUR voor het overzicht ────────────────────────────────────

export interface SiteSection {
  id: string
  title: string
  emoji: string
  description: string
  partnerOnly?: boolean
  subGroups: Array<{
    id: string
    title: string
    items: MenuItem[]
  }>
}

export const SITE_SECTIONS: SiteSection[] = [
  {
    id: 'team',
    title: 'Team',
    emoji: '👥',
    description: 'Dagelijkse pagina\'s — agenda, werk, persoonlijke tools en info.',
    subGroups: [
      { id: 'algemeen', title: 'Algemeen', items: teamMenu_Algemeen },
      { id: 'werk', title: 'Werk', items: teamMenu_Werk },
      { id: 'tools', title: 'Tools', items: teamMenu_Tools },
      { id: 'info', title: 'Info', items: teamMenu_Docs },
    ],
  },
  {
    id: 'partner',
    title: 'Partner',
    emoji: '🎯',
    description: 'Partner-specifieke werkzaamheden, financiën en HR.',
    partnerOnly: true,
    subGroups: [
      { id: 'partner', title: 'Partner', items: partnersMenuItems },
    ],
  },
  {
    id: 'extra',
    title: 'Extra',
    emoji: '📎',
    description: 'Specifieke tooling die niet dagelijks wordt gebruikt.',
    subGroups: [
      { id: 'extra', title: 'Extra', items: extraMenuItems },
    ],
  },
  {
    id: 'beheer',
    title: 'Beheer',
    emoji: '⚙️',
    description: 'Feedback en instellingen.',
    subGroups: [
      { id: 'beheer', title: 'Beheer', items: manageMenuItems },
    ],
  },
]
