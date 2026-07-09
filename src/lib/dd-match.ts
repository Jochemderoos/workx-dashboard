// Gedeelde DD-matchlogica — gebruikt door de DD-projectenpagina én het
// workload/details endpoint, zodat detectie/koppeling niet uit elkaar lopen.

export const DD_CLIENTS = ['De Breij', 'Stek', 'JB Law', 'Strauswolfs', 'Cleber']

// Varianten in projectnamen → canonieke clientnaam.
export const CLIENT_ALIASES: Record<string, string> = {
  debreij: 'De Breij',
  'de breij': 'De Breij',
  stek: 'Stek',
  'jb law': 'JB Law',
  strauswolfs: 'Strauswolfs',
  strasuwolfs: 'Strauswolfs',
  cleber: 'Cleber',
}

export function matchDDClient(projectName: string): string | undefined {
  const lower = projectName.toLowerCase()
  for (const [alias, client] of Object.entries(CLIENT_ALIASES)) {
    if (lower.includes(alias)) return client
  }
  return undefined
}

// Nieuwe DD-zaken moeten DD, VDD of Due Diligence in de naam hebben.
// Woordgrenzen voorkomen valse matches ("add", "middle", "Reddy" e.d.).
const DD_KEYWORD_RE = /(\bv?dd\b)|(due\s*diligence)/i
export function hasDDKeyword(projectName: string): boolean {
  return DD_KEYWORD_RE.test(projectName)
}

// Kernwoorden uit een zaaknaam (codenamen zoals Crest, Iron, Nexus, MCC).
// Stopwoorden + clientnamen eruit, zodat we een handmatig project aan de
// juiste urenregel kunnen koppelen op naam i.p.v. alleen op client.
const KW_STOP = new Set([
  'project', 'projecten', 'dd', 'vdd', 'due', 'diligence', 'voor', 'naar', 'van', 'de', 'het', 'een',
  'der', 'den', 'en', 'of', 'the', 'na', 'advies', 'overname', 'overnames', 'kantoor', 'arbeidsrecht',
  'litigation', 'holding', 'group', 'investment', 'digitale', 'audio', 'klant', 'onmiddellijke',
  'opzegging', 'management', 'overeenkomst', 'door', 'met', 'bij', 'nog', 'onbekend',
  'debreij', 'breij', 'stek', 'jb', 'law', 'strauswolfs', 'strasuwolfs', 'cleber', 'advocaten',
  'https', 'www', 'com', 'nl', 'bv', 'nv',
])
export function ddKeywords(name: string): Set<string> {
  const out = new Set<string>()
  for (const t of name.toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (KW_STOP.has(t)) continue
    if (/^\d+$/.test(t)) continue // puur getal (bijv. jaartal) → te generiek
    if (t.length >= 3 || (/[a-z]/.test(t) && /\d/.test(t))) out.add(t) // 'h2' e.d. wél
  }
  return out
}
export function keywordsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const t of Array.from(a)) if (b.has(t)) return true
  return false
}
