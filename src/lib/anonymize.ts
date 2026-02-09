export interface AnonymizeResult {
  text: string
  mapping: Record<string, string>
}

// Counters per category for generating unique placeholders
interface Counters {
  bsn: number
  telefoon: number
  email: number
  iban: number
  postcode: number
  persoon: number
  bedrijf: number
}

function createCounters(): Counters {
  return { bsn: 0, telefoon: 0, email: 0, iban: 0, postcode: 0, persoon: 0, bedrijf: 0 }
}

// Reverse mapping: original → placeholder (to reuse same placeholder for same value)
type SeenMap = Map<string, string>

function replaceWithPlaceholder(
  text: string,
  pattern: RegExp,
  category: string,
  counterKey: keyof Counters,
  counters: Counters,
  mapping: Record<string, string>,
  seen: SeenMap,
): string {
  return text.replace(pattern, (match) => {
    const normalized = match.trim()
    if (seen.has(normalized)) {
      return seen.get(normalized)!
    }
    counters[counterKey]++
    const placeholder = `[${category}-${counters[counterKey]}]`
    mapping[placeholder] = match
    seen.set(normalized, placeholder)
    return placeholder
  })
}

/**
 * Anonymizes Dutch PII in text by replacing it with numbered placeholders.
 * Returns the anonymized text and a mapping from placeholder → original value.
 * The mapping is kept in memory only and never sent to the API.
 */
export function anonymizeText(text: string): AnonymizeResult {
  const mapping: Record<string, string> = {}
  const counters = createCounters()
  const seen: SeenMap = new Map()
  let result = text

  // 1. IBAN (before general number patterns) — NL followed by 2 digits, 4 uppercase letters, 10 digits
  result = replaceWithPlaceholder(
    result,
    /\bNL\d{2}[A-Z]{4}\d{10}\b/g,
    'IBAN',
    'iban',
    counters,
    mapping,
    seen,
  )

  // 2. Email addresses
  result = replaceWithPlaceholder(
    result,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    'Email',
    'email',
    counters,
    mapping,
    seen,
  )

  // 3. BSN: 9 consecutive digits with optional dots or dashes (but not part of a longer number)
  result = replaceWithPlaceholder(
    result,
    /\b\d{3}[-.]?\d{3}[-.]?\d{3}\b/g,
    'BSN',
    'bsn',
    counters,
    mapping,
    seen,
  )

  // 4. Dutch phone numbers: 06, +31, 0031, or landline patterns
  result = replaceWithPlaceholder(
    result,
    /(?:\+31|0031|06|0[1-9]\d)[-\s.]?\d{1,3}[-\s.]?\d{2,4}[-\s.]?\d{2,4}/g,
    'Telefoon',
    'telefoon',
    counters,
    mapping,
    seen,
  )

  // 5. Bedrijfsnamen: words followed by B.V., N.V., V.O.F., etc.
  result = replaceWithPlaceholder(
    result,
    /[A-Z][a-zA-Z\s&]+(?:B\.V\.|N\.V\.|V\.O\.F\.|BV|NV|VOF|Holding|Group|Groep)/g,
    'Bedrijf',
    'bedrijf',
    counters,
    mapping,
    seen,
  )

  // 6. Personen na trigger: "de heer", "mevrouw", "mw.", "mr.", "dhr." followed by a name
  result = replaceWithPlaceholder(
    result,
    /(de heer|mevrouw|mw\.|mr\.|dhr\.|mevr\.)\s+([A-Z\u00C0-\u024F][a-z\u00C0-\u024F]+(?:\s+(?:van|de|den|der|het|ten|ter)\s+)?[A-Z\u00C0-\u024F]?[a-z\u00C0-\u024F]*)/gi,
    'Persoon',
    'persoon',
    counters,
    mapping,
    seen,
  )

  // 7. Dutch postcodes: 4 digits + 2 letters
  result = replaceWithPlaceholder(
    result,
    /\b\d{4}\s?[A-Za-z]{2}\b/g,
    'Postcode',
    'postcode',
    counters,
    mapping,
    seen,
  )

  return { text: result, mapping }
}
