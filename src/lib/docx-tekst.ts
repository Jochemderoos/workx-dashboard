// Word-documenten omzetten naar tekst die bruikbaar is voor een taalmodel.
//
// Waarom niet gewoon mammoth.extractRawText: overdrachtsdocumenten zijn vaak
// een tabel ("KLANT | CONTACTEN | STATUS | ... | WAARNEMER"). extractRawText
// plakt alle cellen achter elkaar met lege regels ertussen, waardoor niet meer
// te zien is welke waarde bij welke kolom hoort — en lege cellen verdwijnen,
// zodat de kolommen ook nog eens verschuiven. Daarom lezen we de HTML en
// zetten we elke tabelrij om in "Kolomnaam: waarde"-regels.

const ENTITEITEN: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    // Elk opsommingsitem op een eigen regel. Het openen van <li> markeren is
    // nodig naast het sluiten: bij een genest lijstje (zoals "Stek" met
    // subzaken eronder) valt het regeleinde van het buitenste item pas ná alle
    // subitems, waardoor de kop aan het eerste subitem vastplakt.
    .replace(/<[ou]l[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    // Celgrenzen markeren voordat de tags weggaan. Zonder dit plakken waarden
    // uit naast elkaar liggende cellen aan elkaar ("Juliette/MaaikeVita"),
    // wat gebeurt bij geneste tabellen die buiten de tabel-herkenning vallen.
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, m => ENTITEITEN[m.toLowerCase()] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Eén tabel → per rij een blokje met "Kolomnaam: waarde"-regels. */
function tabelNaarTekst(tabelHtml: string, tabelNummer: number): string {
  // Losse regex-lussen in plaats van matchAll-spread: het project compileert
  // naar een target waar itereren over een RegExp-iterator niet mag.
  const rijen: string[][] = []
  const rijRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rijMatch: RegExpExecArray | null
  while ((rijMatch = rijRegex.exec(tabelHtml)) !== null) {
    const cellen: string[] = []
    const celRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let celMatch: RegExpExecArray | null
    while ((celMatch = celRegex.exec(rijMatch[1])) !== null) {
      cellen.push(stripTags(celMatch[1]))
    }
    rijen.push(cellen)
  }
  if (rijen.length === 0) return ''

  // Eerste rij als kolomkoppen gebruiken zodra die grotendeels gevuld is;
  // anders vallen we terug op "Kolom 1", "Kolom 2", enzovoort.
  const eerste = rijen[0]
  const gevuld = eerste.filter(c => c.length > 0).length
  const heeftKoppen = rijen.length > 1 && gevuld >= Math.max(2, Math.ceil(eerste.length / 2))
  const koppen = heeftKoppen
    ? eerste.map((c, i) => c.replace(/:\s*$/, '') || `Kolom ${i + 1}`)
    : eerste.map((_, i) => `Kolom ${i + 1}`)

  const dataRijen = heeftKoppen ? rijen.slice(1) : rijen

  const blokken: string[] = []
  let nummer = 0
  for (const rij of dataRijen) {
    // Rijen zonder enige inhoud slaan we over — dat zijn lege tabelregels.
    if (rij.every(cel => cel.length === 0)) continue
    nummer++
    const regels = rij
      .map((cel, i) => (cel ? `${koppen[i] ?? `Kolom ${i + 1}`}: ${cel.replace(/\n+/g, ' ')}` : null))
      .filter(Boolean)
    blokken.push(`[Rij ${nummer}]\n${regels.join('\n')}`)
  }

  if (blokken.length === 0) return ''
  const kop = `--- Tabel ${tabelNummer} (${blokken.length} rij${blokken.length === 1 ? '' : 'en'}) ---`
  return `${kop}\n${blokken.join('\n\n')}`
}

/**
 * Zet de HTML van mammoth om in tekst met behoud van tabelstructuur.
 * Lopende tekst buiten tabellen blijft gewoon staan — daar staat vaak
 * belangrijke context in ("Alexander neemt mijn zaken waar").
 */
export function htmlNaarTekst(html: string): string {
  const delen: string[] = []
  let tabelNummer = 0

  for (const stuk of html.split(/(<table[^>]*>[\s\S]*?<\/table>)/i)) {
    if (!stuk) continue
    if (/^<table/i.test(stuk)) {
      tabelNummer++
      const tekst = tabelNaarTekst(stuk, tabelNummer)
      if (tekst) delen.push(tekst)
    } else {
      const tekst = stripTags(stuk)
      if (tekst) delen.push(tekst)
    }
  }

  return delen.join('\n\n')
}
