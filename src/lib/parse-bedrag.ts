/**
 * Leest een bedrag zoals mensen het intypen of uit een ander systeem plakken.
 *
 * Het probleem dat dit oplost: "2.000" geplakt uit het boekhoudsysteem werd
 * door parseFloat gelezen als 2 euro, omdat JavaScript de punt als
 * decimaalteken ziet. In Nederlandse notatie is de punt juist het
 * duizendtalteken.
 *
 * Aanpak — de laatste scheidingstekens bepalen de betekenis:
 *   "2.000"      → 2000     (punt + 3 cijfers = duizendtal)
 *   "2.000,50"   → 2000.5   (komma staat achteraan = decimaal)
 *   "€ 1.234,56" → 1234.56
 *   "2,50"       → 2.5      (Nederlandse komma)
 *   "2.50"       → 2.5      (Engelse punt, 1-2 cijfers erachter)
 *   "1,234.56"   → 1234.56  (Engelse notatie)
 *   "2000"       → 2000
 *
 * Geeft NaN terug als er geen bedrag in zit, zodat de aanroeper zelf kan
 * bepalen wat er dan moet gebeuren.
 */
export function parseBedrag(input: string | number | null | undefined): number {
  if (typeof input === 'number') return input
  if (input == null) return NaN

  // Valutatekens, spaties (ook harde spaties uit Excel/Word) en losse
  // apostrofs als duizendtalteken eruit.
  let s = String(input)
    .replace(/[\s  ]/g, '')
    .replace(/[€$£]/g, '')
    .replace(/'/g, '')
    .trim()

  if (!s) return NaN

  // Min-teken onthouden en bedrag tussen haakjes als negatief lezen (-1.234
  // schrijven boekhoudsystemen soms als (1.234)).
  let negatief = false
  if (/^\(.*\)$/.test(s)) {
    negatief = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negatief = true
    s = s.slice(1)
  }
  s = s.replace(/^\+/, '')

  if (!/[0-9]/.test(s)) return NaN

  const laatsteKomma = s.lastIndexOf(',')
  const laatstePunt = s.lastIndexOf('.')

  let genormaliseerd: string

  if (laatsteKomma !== -1 && laatstePunt !== -1) {
    // Allebei aanwezig: het teken dat het laatst staat is het decimaalteken,
    // het andere is duizendtalteken.
    const decimaalIndex = Math.max(laatsteKomma, laatstePunt)
    const duizendtal = decimaalIndex === laatsteKomma ? '.' : ','
    genormaliseerd =
      s.slice(0, decimaalIndex).split(duizendtal).join('') +
      '.' +
      s.slice(decimaalIndex + 1)
  } else if (laatsteKomma !== -1) {
    // Alleen komma's. Eén komma met 1 of 2 cijfers erachter is decimaal
    // (Nederlands); al het andere is duizendtal.
    const cijfersErachter = s.length - laatsteKomma - 1
    const meerdere = s.indexOf(',') !== laatsteKomma
    genormaliseerd = !meerdere && cijfersErachter > 0 && cijfersErachter <= 2
      ? s.slice(0, laatsteKomma) + '.' + s.slice(laatsteKomma + 1)
      : s.split(',').join('')
  } else if (laatstePunt !== -1) {
    // Alleen punten. Eén punt met 1 of 2 cijfers erachter is een Engels
    // decimaalteken; precies 3 cijfers erachter (of meerdere punten) is het
    // Nederlandse duizendtalteken — dat is het "2.000 wordt 2 euro"-geval.
    const cijfersErachter = s.length - laatstePunt - 1
    const meerdere = s.indexOf('.') !== laatstePunt
    genormaliseerd = !meerdere && cijfersErachter > 0 && cijfersErachter <= 2
      ? s
      : s.split('.').join('')
  } else {
    genormaliseerd = s
  }

  // Alles wat geen cijfer of decimaalpunt is eruit (bijv. "EUR" of "excl").
  genormaliseerd = genormaliseerd.replace(/[^0-9.]/g, '')

  const waarde = parseFloat(genormaliseerd)
  if (Number.isNaN(waarde)) return NaN
  return negatief ? -waarde : waarde
}

/** Zelfde parser, maar met een fallback in plaats van NaN. */
export function parseBedragOf(input: string | number | null | undefined, fallback = 0): number {
  const n = parseBedrag(input)
  return Number.isNaN(n) ? fallback : n
}
