// BTW-helper. Voor de financiële overzichten willen we ex-btw bedragen
// gebruiken (omzet wordt ook ex-btw ingevoerd). MT940 levert bruto
// bedragen.
//
// Aanpak: standaard 21% BTW. 0% voor categorieën waar geen BTW op zit:
//   - UWV/ASR (vergoedingen — niet BTW-plichtig)
//   - WGL (pensioenpremie — vrijgesteld)
//   - Huur (vrijgesteld tenzij opt-in, en in dit pand geen opt-in)
//   - Verzekeringen (vrijgesteld)
//   - Banken / financiële dienstverlening (vrijgesteld)
//   - Belastingdienst (al uitgefilterd, maar dubbelcheck)
//   - Salaris / personeel via Tentoo (loonadministratie 0%)
//   - Lidmaatschap orde / overheidsorganen (vrijgesteld)

const ZERO_VAT_PATTERNS: RegExp[] = [
  /herengracht\s+investments/i,    // huur
  /\bhuur\b/i,
  /\basr\b/i,                      // verzekering
  /verzuimverzekering/i,
  /aegon/i,
  /nationale[-\s]?nederlanden/i,
  /\babn\s*amro\b/i,                // bank-servicekosten
  /\brabobank\b/i,
  /\bing\b\s+bank/i,
  /\bbright\s*pensioen\b/i,
  /\bpensioen\b/i,
  /belastingdienst/i,
  /\bnova\b/i,                     // Nederlandse Orde van Advocaten
  /amsterdamse\s+orde\s+van\s+advocaten/i,
  /nederlandse\s+orde\s+van\s+advocaten/i,
  /\borde\s+van\s+advocaten\b/i,
  /\btentoo\b/i,                   // payroll-administratie
  /\bicsdirect\b|international\s+card\s+services/i, // ICS is doorbelaste creditcard-betalingen — meestal al ex-btw door derden
]

export interface VatableCost {
  amount: number
  description?: string | null
  category?: string | null
}

// Bepaalt het BTW-percentage dat van toepassing is.
export function vatRateFor(cost: VatableCost): number {
  if (cost.category === 'UWV' || cost.category === 'ASR' || cost.category === 'WGL') return 0
  const desc = cost.description || ''
  for (const pat of ZERO_VAT_PATTERNS) {
    if (pat.test(desc)) return 0
  }
  return 0.21
}

// Bruto bedrag → ex-btw bedrag.
export function amountExVat(cost: VatableCost): number {
  const rate = vatRateFor(cost)
  if (rate === 0) return cost.amount
  return cost.amount / (1 + rate)
}

// Som van een lijst kosten ex-btw.
export function sumExVat(costs: VatableCost[]): number {
  return costs.reduce((s, c) => s + amountExVat(c), 0)
}
