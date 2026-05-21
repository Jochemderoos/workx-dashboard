// BTW-helper. Voor de financiële overzichten willen we ex-btw bedragen
// gebruiken (omzet wordt ook ex-btw ingevoerd). MT940 levert bruto
// bedragen.
//
// Tarieven:
//   21% — standaard (default)
//    9% — voeding, horeca, lunch, koffie, boeken
//    0% — vrijgesteld (huur, verzekeringen, banken, belasting, Orde,
//         UWV/ASR retours, salarisbetalingen)

export interface VatableCost {
  amount: number
  description?: string | null
  category?: string | null
}

// 0% BTW — vrijgestelde categorieën
const ZERO_VAT_PATTERNS: RegExp[] = [
  /herengracht\s+investments/i,    // huur (vrijgesteld, geen opt-in)
  /\bhuur\b/i,
  /\basr\b/i,                      // verzekering vrijgesteld
  /verzuimverzekering/i,
  /\baegon\b/i,
  /nationale[-\s]?nederlanden/i,
  /\babn\s*amro\b/i,               // bank-servicekosten vrijgesteld
  /\brabobank\b/i,
  /\bing\b\s+bank/i,
  /belastingdienst/i,              // dubbelcheck — al uitgefilterd
  /amsterdamse\s+orde\s+van\s+advocaten/i,
  /nederlandse\s+orde\s+van\s+advocaten/i,
  /\borde\s+van\s+advocaten\b/i,
]

// 9% BTW — voeding, horeca, boeken, kappers
const LOW_VAT_PATTERNS: RegExp[] = [
  /albert\s*heijn/i,
  /\bah\b/i,
  /vlaams\s+broodhuys/i,
  /bocca\s+coffee/i,
  /\bbocca\b/i,
  /zerozero/i,
  /zero\s*zero/i,
  /\bde\s+bary\b/i,
  /broodjes/i,
  /\bmerchado\b/i,                  // wijn/flessen
  /\bsmartcoffee\b|boonchance/i,
  /\bbol\.com\b/i,                  // boeken/cadeaus — vaak 9%
  /\biside\b/i,                     // schoonheid/welzijn
  /\bhema\b/i,                      // gedeeltelijk 9%
  /froot/i,
]

// Bepaalt het BTW-percentage dat van toepassing is.
export function vatRateFor(cost: VatableCost): number {
  if (cost.category === 'UWV' || cost.category === 'ASR') return 0
  const desc = cost.description || ''
  for (const pat of ZERO_VAT_PATTERNS) {
    if (pat.test(desc)) return 0
  }
  for (const pat of LOW_VAT_PATTERNS) {
    if (pat.test(desc)) return 0.09
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
