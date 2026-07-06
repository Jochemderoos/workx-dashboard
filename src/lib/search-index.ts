// Centrale zoek-index voor het dashboard.
//
// Doel: één plek waar ALLE doorzoekbare content uit het dashboard bij elkaar
// komt — sidebar-pagina's, hr-docs-hoofdstukken (volledige tekst), en
// "factoids" (KvK / IBAN / BTW / belangrijke nummers). Plus een eenvoudige,
// uitlegbare relevance-engine zonder externe dependencies.
//
// Toevoegen?  Heeft een page extra termen die mensen zouden typen? Vul
// SYNONYMS aan of voeg een entry toe in EXTRA_FACTOIDS. Pages worden
// automatisch geïndexeerd uit menu-data.

import {
  teamMenu_Algemeen,
  teamMenu_Werk,
  teamMenu_Tools,
  teamMenu_Docs,
  partnersMenuItems,
  extraMenuItems,
  manageMenuItems,
  type MenuItem,
} from '@/lib/menu-data'
import { THE_WAY_IT_WORKX } from '@/app/dashboard/hr-docs/documents'
import { KNOWHOW_OFFICEMANAGEMENT } from '@/app/dashboard/hr-docs/knowhow-document'
import { PARTNERS, ADVOCATEN, OFFICE_TEAM } from '@/lib/team-photos'

// ── Types ─────────────────────────────────────────────────────────────────

export type SearchKind = 'page' | 'doc' | 'factoid' | 'action' | 'person' | 'detail'

export interface SearchItem {
  id: string
  kind: SearchKind
  label: string             // Hoofdtekst (titel)
  description?: string      // Sub-tekst (één regel context)
  href: string              // Waar leid de gebruiker naartoe
  body?: string             // Vollege plain-text content (voor diep zoeken)
  synonyms?: string[]       // Termen die ook moeten matchen
  section?: string          // Bv. "Algemeen", "Workx docs", "Office"
  // Voor persoon-items en persoonsacties: de voornaam(en) waar het over gaat.
  // Als gezet: matcht alleen als de query een van deze namen bevat
  // (voorkomt dat "ontwikkelplan" alle ontwikkelplan-per-persoon items toont).
  requiresNameMatch?: string[]
}

export interface SearchHit {
  item: SearchItem
  score: number
  matchedField: 'label' | 'synonym' | 'description' | 'body'
  snippet?: string          // Stukje content rond de match (voor preview)
}

// ── Synoniemen ────────────────────────────────────────────────────────────
// Per page-href een rijke set termen die mensen mogelijk typen.
// Dit is de plek om snel uit te breiden als iets niet gevonden wordt.

const PAGE_SYNONYMS: Record<string, string[]> = {
  '/dashboard/office': [
    'kantoor', 'kantoorgegevens', 'workx advocaten', 'herengracht', 'kvk', 'btw',
    'iban', 'abn amro', 'bic', 'bankrekening', 'rekeningnummer', 'adres',
    'postcode', 'hanna', 'lotte', 'bente', 'diyar', 'aanwezigheid', 'remote',
    'telefoon', 'kantoortelefoon', 'doorschakeling',
  ],
  '/dashboard/appjeplekje': [
    'kantoor', 'werkplek', 'reserveren', 'plek', 'bureau', 'aanwezig', 'bezet',
    'huis', 'thuis', 'amsterdam', 'herengracht',
  ],
  '/dashboard/agenda': [
    'kalender', 'afspraken', 'meeting', 'events', 'planning', 'zittingen',
    'mediation', 'wanneer',
  ],
  '/dashboard/jaaragenda': [
    'jaarplanning', 'jaaroverzicht', 'doelen', 'mijlpalen', 'planning',
  ],
  '/dashboard/vakanties': [
    'verlof', 'vrij', 'vakantie', 'afwezig', 'dagen', 'feestdagen',
    'ouderschapsverlof', 'ziektedagen', 'opname',
  ],
  '/dashboard/opleidingen': [
    'po-punten', 'po', 'cursus', 'training', 'opleiding', 'jar', 'wwft',
    'certificaten', 'workx-opleiding', 'workx opleiding',
  ],
  '/dashboard/bonus': [
    'bonus', 'omzet', 'provisie', 'geld', 'berekenen', 'incentive',
  ],
  '/dashboard/declaraties': [
    'declaratie', 'declareren', 'onkosten', 'kosten', 'bonnetje', 'reiskosten',
    'kilometers', 'km', 'vergoeding', 'kilometervergoeding', 'parkeren',
    'restaurant', 'taxi', 'trein', 'lunch', 'iban',
  ],
  '/dashboard/kosten': [
    'maandlasten', 'vaste kosten', 'huur', 'energie', 'leveranciers',
    'facturen', 'uitgaven', 'maandkosten',
  ],
  '/dashboard/financien': [
    'omzet', 'jaarcijfers', 'winst', 'resultaat', 'financiele', 'p&l',
  ],
  '/dashboard/debiteuren': [
    'openstaande facturen', 'debiteur', 'crediteur', 'incasso', 'herinneringen',
    'reminder', 'betalingen',
  ],
  '/dashboard/team': [
    'collega', 'mensen', 'wie', 'profiel', 'team', 'iedereen',
  ],
  '/dashboard/werk': [
    'wie doet wat', 'verantwoordelijkheden', 'taken', 'verdeling', 'nieuwsbrief',
    'jar bespreking', 'lopende zaken',
  ],
  '/dashboard/werk/lopende-zaken': [
    'zaken', 'dossiers', 'lopende', 'cliënten', 'matters',
  ],
  '/dashboard/eigen-taken': [
    'taak', 'taken', 'to-do', 'todo', 'persoonlijk', 'mijn',
  ],
  '/dashboard/mijn-werkweek': [
    'uren', 'urenregistratie', 'urenoverzicht', 'werkdruk', 'werkdrukmeter',
    'capaciteit', 'planning',
  ],
  '/dashboard/onboarding': [
    'nieuwe medewerker', 'eerste dag', 'introductie', 'starten', 'inwerken',
  ],
  '/dashboard/wachtwoorden': [
    'inloggen', 'login', 'password', 'basenet', '365', 'office 365', 'systemen',
    'tweestapsverificatie', '2fa', 'reset',
  ],
  '/dashboard/hr-docs': [
    'handboek', 'personeelshandboek', 'docs', 'workx docs', 'the way it workx',
    'beleid', 'regelementen', 'arbeidsvoorwaarden',
  ],
  '/dashboard/ai': [
    'claude', 'ai', 'assistent', 'chat', 'jurisprudentie', 'rechtspraak',
    'modelteksten', 'document genereren',
  ],
  '/dashboard/chat': [
    'team chat', 'praten', 'message', 'bericht', 'whatsapp', 'slack',
  ],
  '/dashboard/arbeidsvoorwaarden': [
    'salaris', 'loon', 'pensioen', 'verzekeringen', 'cao', 'leaseauto',
    'mobiliteit', 'telefoon',
  ],
  '/dashboard/transitie': [
    'transitievergoeding', 'ontslag', 'beëindiging', 'vso', 'vaststellingsovereenkomst',
    'tv', 'berekening', 'tv tool',
  ],
  '/dashboard/pitch': [
    'pitch', 'nieuwe klanten', 'sales', 'acquisitie', 'voorstel',
  ],
  '/dashboard/workx-uitjes': [
    'borrel', 'etentje', 'film', 'suppen', 'padel', 'bowling', 'bierfiets',
    'opera', 'voorstelling', 'theater', 'uitje', 'team-uitje', 'feestje',
  ],
  '/dashboard/lustrum': [
    '15 jaar', 'mallorca', 'vluchten', 'trip', 'jubileum', 'feest',
  ],
  '/dashboard/dd-projecten': [
    'due diligence', 'dd', 'onderzoek', 'overname',
  ],
  '/dashboard/bevriende-kantoren': [
    'andere kantoren', 'samenwerking', 'doorverwijzing', 'collega kantoor',
  ],
  '/dashboard/afspiegeling': [
    'reorganisatie', 'ontslag', 'afspiegelen', 'leeftijdscategorie',
  ],
  '/dashboard/recruitment': [
    'sollicitatie', 'vacature', 'kandidaat', 'cv', 'aannemen',
  ],
  '/dashboard/workxflow': [
    'projecten', 'workflow', 'proces',
  ],
  '/dashboard/partners/jaarplannen': [
    'jaarplan', 'persoonlijk', 'doelen', 'ontwikkeling', 'evaluatie',
  ],
  '/dashboard/ontwikkelplannen': [
    'ontwikkeling', 'jaarplan', 'evaluatie', 'beoordeling', 'groei',
  ],
  '/dashboard/office-tasks': [
    'office taken', 'hanna taken', 'back office',
  ],
}

// ── Extra "factoids" — kleine, direct beantwoordbare zoekresultaten ──────
// Voor dingen die geen pagina zijn maar wel een definitief antwoord hebben.

const EXTRA_FACTOIDS: SearchItem[] = [
  {
    id: 'factoid-kvk',
    kind: 'factoid',
    label: 'KvK-nummer: 56660936',
    description: 'Workx Advocaten B.V. — staat ook op Office en in Workx docs',
    href: '/dashboard/hr-docs?doc=knowhow-officemanagement&chapter=kantoorgegevens',
    synonyms: ['kvk', 'handelsregister', 'kamer van koophandel', '56660936'],
    section: 'Officiële gegevens',
  },
  {
    id: 'factoid-btw',
    kind: 'factoid',
    label: 'BTW / VAT-nummer: NL852244034B01',
    description: 'Workx Advocaten B.V.',
    href: '/dashboard/hr-docs?doc=knowhow-officemanagement&chapter=kantoorgegevens',
    synonyms: ['btw', 'vat', 'omzetbelasting', 'NL852244034B01'],
    section: 'Officiële gegevens',
  },
  {
    id: 'factoid-iban',
    kind: 'factoid',
    label: 'IBAN: NL86 ABNA 0457 8975 03',
    description: 'ABN AMRO — t.n.v. Workx Advocaten B.V., BIC ABNANL2A',
    href: '/dashboard/hr-docs?doc=knowhow-officemanagement&chapter=kantoorgegevens',
    synonyms: ['iban', 'bankrekening', 'rekeningnummer', 'abn', 'abn amro', 'bic', 'abnanl2a', 'NL86ABNA0457897503'],
    section: 'Officiële gegevens',
  },
  {
    id: 'factoid-adres',
    kind: 'factoid',
    label: 'Adres kantoor: Herengracht 448, 1017 CA Amsterdam',
    description: 'Workx Advocaten B.V. — hoofdvestiging',
    href: '/dashboard/hr-docs?doc=knowhow-officemanagement&chapter=kantoorgegevens',
    synonyms: ['adres', 'herengracht', '1017', 'amsterdam', 'postcode', 'locatie kantoor', 'vestiging'],
    section: 'Officiële gegevens',
  },
  {
    id: 'factoid-telefoon',
    kind: 'factoid',
    label: 'Kantoortelefoon: 020 308 0320',
    description: 'Workx Advocaten B.V.',
    href: '/dashboard/hr-docs?doc=knowhow-officemanagement&chapter=contactgegevens',
    synonyms: ['telefoon', 'telefoonnummer', 'bellen', 'nummer', 'kantoor', '0203080320'],
    section: 'Officiële gegevens',
  },
  // Acties die ook handig zijn als zoekresultaat
  {
    id: 'action-declaratie',
    kind: 'action',
    label: 'Declaratie indienen',
    description: 'Onkosten / reiskosten / km-vergoeding indienen',
    href: '/dashboard/declaraties',
    synonyms: ['declareren', 'bonnetje', 'kosten', 'onkosten', 'kilometers', 'reiskosten', 'vergoeding'],
    section: 'Acties',
  },
  {
    id: 'action-vakantie',
    kind: 'action',
    label: 'Vakantie aanvragen',
    description: 'Verlof / vrije dagen / afwezig melden',
    href: '/dashboard/vakanties',
    synonyms: ['verlof aanvragen', 'vrij', 'vakantie', 'dagen', 'afwezig', 'opname'],
    section: 'Acties',
  },
  {
    id: 'action-uitje',
    kind: 'action',
    label: 'Workx-uitje plannen',
    description: 'Borrel, etentje, film, padel — iets leuks met collega\'s',
    href: '/dashboard/workx-uitjes',
    synonyms: ['uitje plannen', 'borrel plannen', 'etentje', 'team activiteit', 'organiseren'],
    section: 'Acties',
  },
  {
    id: 'action-werkplek',
    kind: 'action',
    label: 'Werkplek reserveren',
    description: 'Plek op kantoor reserveren via Appjeplekje',
    href: '/dashboard/appjeplekje',
    synonyms: ['plek reserveren', 'werkplek', 'bureau', 'aanwezig', 'naar kantoor'],
    section: 'Acties',
  },
]

// ── HTML → plain text + chunked snippets ──────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h\d|li|div)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

// ── Index builder ─────────────────────────────────────────────────────────

let CACHED_INDEX: SearchItem[] | null = null

function flattenMenu(items: MenuItem[], section: string): SearchItem[] {
  const out: SearchItem[] = []
  for (const it of items) {
    if (it.href) {
      out.push({
        id: `page:${it.href}`,
        kind: 'page',
        label: it.label,
        description: it.description,
        href: it.href,
        synonyms: PAGE_SYNONYMS[it.href] || [],
        section,
      })
    }
    if (it.children?.length) out.push(...flattenMenu(it.children, section))
  }
  return out
}

function buildPeopleItems(): SearchItem[] {
  const out: SearchItem[] = []

  // Voornaam → synoniemen (handig voor afkortingen/koosnamen)
  const synonymsFor = (name: string, role: string): string[] => {
    const first = name.split(' ')[0].toLowerCase()
    return [first, name.toLowerCase(), role.toLowerCase()]
  }
  // De voornaam-tokens waar de query op moet matchen om dit item te tonen.
  const nameTokensFor = (name: string): string[] => {
    const parts = name.toLowerCase().split(/\s+/).filter(p => p.length > 1)
    return parts
  }

  // Helper voor person-items met requiresNameMatch
  const addPersonItem = (item: Omit<SearchItem, 'requiresNameMatch'>, name: string) => {
    out.push({ ...item, requiresNameMatch: nameTokensFor(name) })
  }

  // Partners
  for (const name of PARTNERS) {
    const first = name.split(' ')[0]
    addPersonItem({
      id: `person:partner:${name}`,
      kind: 'person',
      label: name,
      description: 'Partner — klik voor zaken, jaarplan en performance',
      href: `/dashboard/team?focus=${encodeURIComponent(name)}`,
      synonyms: synonymsFor(name, 'partner'),
      section: 'Mensen',
    }, name)
    addPersonItem({
      id: `person:partner-jaarplan:${name}`,
      kind: 'action',
      label: `Jaarplan ${first}`,
      description: `Persoonlijk jaarplan van ${name}`,
      href: `/dashboard/partners/jaarplannen?partner=${encodeURIComponent(name)}`,
      synonyms: [`jaarplan ${first}`, `${first.toLowerCase()} ontwikkeling`, `${first.toLowerCase()} doelen`],
      section: 'Mensen',
    }, name)
    addPersonItem({
      id: `person:partner-coaching:${name}`,
      kind: 'action',
      label: `Coaching-budget ${first}`,
      description: `Coaching-uitgaven en saldo van ${name}`,
      href: `/dashboard/partners/coaching-budgetten?partner=${encodeURIComponent(name)}`,
      synonyms: [`coaching ${first}`, `${first.toLowerCase()} budget`, `${first.toLowerCase()} coach`],
      section: 'Mensen',
    }, name)
    addPersonItem({
      id: `person:partner-werk:${name}`,
      kind: 'action',
      label: `Werk van ${first}`,
      description: `Lopende zaken en taken van ${name}`,
      href: `/dashboard/partners/werk?partner=${encodeURIComponent(name)}`,
      synonyms: [`zaken ${first}`, `werk ${first}`, `${first.toLowerCase()} dossiers`],
      section: 'Mensen',
    }, name)
  }

  // Advocaten
  for (const name of ADVOCATEN) {
    const first = name.split(' ')[0]
    addPersonItem({
      id: `person:adv:${name}`,
      kind: 'person',
      label: name,
      description: 'Advocaat — klik voor profiel, werkdruk en ontwikkeling',
      href: `/dashboard/team?focus=${encodeURIComponent(name)}`,
      synonyms: synonymsFor(name, 'advocaat'),
      section: 'Mensen',
    }, name)
    addPersonItem({
      id: `person:adv-werkweek:${name}`,
      kind: 'action',
      label: `Werkweek ${first}`,
      description: `Urenoverzicht en werkdruk van ${name}`,
      href: `/dashboard/mijn-werkweek?user=${encodeURIComponent(name)}`,
      synonyms: [`uren ${first}`, `werkdruk ${first}`, `${first.toLowerCase()} capaciteit`],
      section: 'Mensen',
    }, name)
    addPersonItem({
      id: `person:adv-ontwikkel:${name}`,
      kind: 'action',
      label: `Ontwikkelplan ${first}`,
      description: `Ontwikkeling, evaluaties en groei van ${name}`,
      href: `/dashboard/ontwikkelplannen?user=${encodeURIComponent(name)}`,
      synonyms: [`ontwikkelplan ${first}`, `evaluatie ${first}`, `${first.toLowerCase()} jaarplan`],
      section: 'Mensen',
    }, name)
  }

  // Office team
  for (const p of OFFICE_TEAM) {
    const first = p.name.split(' ')[0]
    addPersonItem({
      id: `person:office:${p.name}`,
      kind: 'person',
      label: p.name,
      description: `${p.role} — Office team`,
      href: `/dashboard/office`,
      synonyms: synonymsFor(p.name, p.role),
      section: 'Mensen',
    }, p.name)
    if (first === 'Bas') {
      addPersonItem({
        id: `person:bas-jar:${p.name}`,
        kind: 'action',
        label: `JAR-rooster van Bas`,
        description: 'Wie/wanneer JAR-bespreking — beheerd door Bas',
        href: `/dashboard/opleidingen?tab=jar`,
        synonyms: ['jar rooster bas', 'jar bespreking', 'know how rooster'],
        section: 'Mensen',
      }, p.name)
    }
  }

  return out
}

export function buildSearchIndex(): SearchItem[] {
  if (CACHED_INDEX) return CACHED_INDEX

  const out: SearchItem[] = []

  // 1. Alle menu-pagina's
  out.push(...flattenMenu(teamMenu_Algemeen, 'Algemeen'))
  out.push(...flattenMenu(teamMenu_Werk, 'Werk'))
  out.push(...flattenMenu(teamMenu_Tools, 'Tools'))
  out.push(...flattenMenu(teamMenu_Docs, 'Documenten'))
  out.push(...flattenMenu(partnersMenuItems, 'Partners'))
  out.push(...flattenMenu(extraMenuItems, 'Extra'))
  out.push(...flattenMenu(manageMenuItems, 'Beheer'))

  // 2. Alle hr-docs hoofdstukken als losse items met deep-link
  for (const doc of [THE_WAY_IT_WORKX, KNOWHOW_OFFICEMANAGEMENT]) {
    for (const ch of doc.chapters) {
      const body = stripHtml(ch.content || '')
      out.push({
        id: `doc:${doc.id}:${ch.id}`,
        kind: 'doc',
        label: ch.title,
        description: `${doc.title} — ${body.split('\n')[0].slice(0, 100)}`,
        href: `/dashboard/hr-docs?doc=${doc.id}&chapter=${ch.id}`,
        body,
        section: doc.title,
      })
    }
  }

  // 3. Factoids + acties
  out.push(...EXTRA_FACTOIDS)

  // 4. Team-leden + per-persoon acties
  out.push(...buildPeopleItems())

  // Dedupe op id
  const seen = new Set<string>()
  CACHED_INDEX = out.filter(it => (seen.has(it.id) ? false : (seen.add(it.id), true)))
  return CACHED_INDEX
}

// ── Tekstnormalisatie ─────────────────────────────────────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')                     // splits diakrieten
    .replace(/[̀-ͯ]/g, '')      // verwijder diakrieten
    .replace(/[^a-z0-9]+/g, ' ')          // alles wat geen letter/cijfer is → spatie
    .trim()
}

function tokenize(s: string): string[] {
  const n = normalize(s)
  if (!n) return []
  return n.split(/\s+/).filter(t => t.length > 0)
}

// ── Score-formule ─────────────────────────────────────────────────────────
// Per item bekijken we hoe goed elk token uit de query matcht in elk veld.
// Som de scores op. Multi-word: ELK token moet ergens matchen, anders 0.
//
// Belangrijk: bij een PREFIX-only-match (gebruiker is nog aan het typen)
// krijgen "brede" items zoals menu-pagina's voorrang boven "specifieke"
// details zoals individuele hr-docs hoofdstukken, mensen of bevriende
// kantoren. Pas bij EXACT-MATCH komen de specifieke items vol naar boven.

interface FieldHit {
  field: 'label' | 'synonym' | 'description' | 'body'
  score: number
  position: number          // waar in het veld zit de match (voor snippets)
}

// Gewichten per kind voor PREFIX-/SUBSTRING-only matches (geen exact woord).
// Hoe hoger, hoe meer prioriteit bij "Va..."-typen.
const PREFIX_WEIGHT_BY_KIND: Record<SearchKind, number> = {
  page: 1.0,      // menu-pagina's: volle voorrang bij snel typen
  factoid: 1.0,   // KvK/IBAN/BTW: óók direct relevant
  action: 0.7,    // 'Declaratie indienen' etc.
  doc: 0.45,     // hr-docs hoofdstukken
  person: 0.5,    // collega's
  detail: 0.35,   // bevriende kantoren, individuele records — alleen top bij volledige match
}

function scoreToken(token: string, item: SearchItem): FieldHit | null {
  const lbl = normalize(item.label)
  const w = PREFIX_WEIGHT_BY_KIND[item.kind] ?? 0.7

  // Exact label match = altijd 100 (ongeacht kind — wie precies 'Van Loman'
  // typt, wil dat resultaat bovenaan)
  if (lbl === token) return { field: 'label', score: 100, position: 0 }
  // Exact-word match in label-tokens: 'va' === 'van' niet maar 'van' === 'van' wel
  if (lbl.split(' ').includes(token)) return { field: 'label', score: 80, position: lbl.indexOf(token) }
  // Prefix-match krijgt kind-gewicht
  if (lbl.startsWith(token + ' ') || lbl.startsWith(token)) {
    return { field: 'label', score: Math.round(70 * w), position: 0 }
  }
  const lblIdx = lbl.indexOf(token)
  if (lblIdx >= 0) return { field: 'label', score: Math.round(40 * w), position: lblIdx }

  // Synoniemen
  if (item.synonyms?.length) {
    for (const syn of item.synonyms) {
      const sn = normalize(syn)
      if (sn === token) return { field: 'synonym', score: 60, position: 0 }
      if (sn.startsWith(token)) return { field: 'synonym', score: Math.round(45 * w), position: 0 }
      if (sn.includes(token)) return { field: 'synonym', score: Math.round(35 * w), position: sn.indexOf(token) }
    }
  }

  // Description
  if (item.description) {
    const dn = normalize(item.description)
    const di = dn.indexOf(token)
    if (di >= 0) return { field: 'description', score: Math.round(20 * w), position: di }
  }

  // Volledige body
  if (item.body) {
    const bn = normalize(item.body)
    const bi = bn.indexOf(token)
    if (bi >= 0) return { field: 'body', score: Math.round(12 * w), position: bi }
  }

  return null
}

// Pak een leesbare snippet rond de eerste body-match
function extractSnippet(body: string, token: string, maxLen = 120): string | undefined {
  const bn = normalize(body)
  const idx = bn.indexOf(token)
  if (idx < 0) return undefined
  // Loop terug naar woordstart (op het oorspronkelijke body, niet de genormaliseerde)
  const start = Math.max(0, idx - 40)
  const raw = body.slice(start, Math.min(body.length, idx + maxLen))
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  return (start > 0 ? '… ' : '') + cleaned + (start + cleaned.length < body.length ? ' …' : '')
}

// ── Publieke search-functie ───────────────────────────────────────────────

export interface SearchOptions {
  /** Verberg alle mensen-items (voor EMPLOYEE-rol — privacy). */
  hideAllPersons?: boolean
}

export function searchIndex(
  query: string,
  limit = 12,
  options: SearchOptions = {},
  extraItems: SearchItem[] = [],
): SearchHit[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const index = [...buildSearchIndex(), ...extraItems]
  const hits: SearchHit[] = []

  for (const item of index) {
    // Privacy-filter: bij EMPLOYEE worden mensen-items helemaal niet getoond.
    const isPersonItem = item.kind === 'person' || item.id.startsWith('person:')
    if (options.hideAllPersons && isPersonItem) continue

    // requiresNameMatch: persoon-actie items matchen alleen als de query een
    // van de voornaam-tokens bevat. Voorkomt dat "ontwikkelplan" alle
    // 'Ontwikkelplan [naam]' items toont.
    if (item.requiresNameMatch?.length) {
      const hasNameToken = tokens.some(t =>
        item.requiresNameMatch!.some(n => n === t || n.startsWith(t) || t.startsWith(n))
      )
      if (!hasNameToken) continue
    }

    const perToken: FieldHit[] = []
    let allMatched = true
    for (const tk of tokens) {
      const hit = scoreToken(tk, item)
      if (!hit) { allMatched = false; break }
      perToken.push(hit)
    }
    if (!allMatched) continue

    const total = perToken.reduce((s, h) => s + h.score, 0)
    // Beste veld = veld met hoogste score; snippet alleen als beste veld 'body' is
    const best = perToken.reduce((b, h) => (h.score > b.score ? h : b), perToken[0])

    let snippet: string | undefined
    if (best.field === 'body' && item.body) {
      // gebruik het token dat in body matchte
      const bodyTokens = perToken.filter(h => h.field === 'body')
      if (bodyTokens.length) {
        const matchedToken = tokens[perToken.indexOf(bodyTokens[0])]
        snippet = extractSnippet(item.body, matchedToken)
      }
    }

    // Lichte boost voor acties en factoids — die zijn vaak het meest concrete antwoord
    let totalBoosted = total
    if (item.kind === 'factoid') totalBoosted += 15
    if (item.kind === 'action') totalBoosted += 8

    hits.push({ item, score: totalBoosted, matchedField: best.field, snippet })
  }

  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, limit)
}

// Reset de cache (handig in dev / na content-changes)
export function resetSearchIndex() {
  CACHED_INDEX = null
}
