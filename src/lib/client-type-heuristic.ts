// Heuristiek om dossiers te classificeren als werknemer- of werkgever-zaak.
// Op basis van het deel vóór de eerste '/' in de projectnaam:
//   "De Koning / EQT"           → 'De Koning'   → WERKNEMER
//   "Janssen / Heineken"        → 'Janssen'     → WERKNEMER
//   "De Koning / adviesvraag"   → 'De Koning'   → WERKNEMER
//   "Heineken B.V. / iets"      → 'Heineken B.V.' → WERKGEVER (bedrijfsindicator)
//
// Bedrijfsindicatoren maken er een werkgever van. Onbekend/twijfel → WERKNEMER
// (de meeste zaken zijn werknemerszaken). Handmatige overrides via
// ClientClassification tabel.

export type ClientType = 'WERKNEMER' | 'WERKGEVER'

const COMPANY_PATTERNS = [
  /\bb\.?\s*v\.?\b/i,              // B.V., BV, b.v.
  /\bn\.?\s*v\.?\b/i,              // N.V., NV
  /\bbvba\b/i,
  /\bcv\b/i,
  /\bvof\b/i,
  /\bstichting\b/i,
  /\bvereniging\b/i,
  /\bcoöperatie\b/i,
  /\bholding\b/i,
  /\bgroup\b/i,
  /\bgmbh\b/i,
  /\bag\b/i,
  /\bs\.?a\.?\b/i,
  /\bltd\b/i,
  /\binc\b/i,
  /\bcorp\b/i,
  /\bllc\b/i,
  /\bplc\b/i,
  /\bservice[sn]?\b/i,
  /\bsolutions?\b/i,
  /\b(advocaten|advocatenkantoor|notaris)\b/i,
  /\b(bank|verzekering|asset|capital|partners|consulting)\b/i,
]

export function normalizeClientKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Pak het deel vóór de eerste '/' (of '|' of ' - ' als fallback).
export function extractClientLhs(projectName: string | null | undefined): string | null {
  if (!projectName) return null
  const split = projectName.split(/\s*[\/|]\s*/)[0]?.trim()
  if (!split) return null
  return split
}

export function heuristicType(clientLhs: string): ClientType {
  if (COMPANY_PATTERNS.some(p => p.test(clientLhs))) return 'WERKGEVER'
  return 'WERKNEMER'
}

export interface ClassifiedClient {
  displayName: string
  clientKey: string
  type: ClientType
  isManual: boolean
  totalExcl: number
  invoiceCount: number
}
