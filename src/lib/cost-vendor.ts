// Gedeelde vendor-normalisatie voor kosten. Wordt gebruikt door:
//  - MT940-importer (rauwe :86: → korte vendornaam)
//  - kosten-pagina (groeperen van bestaande posten)
//
// De aliassen hieronder zijn afgeleid van de handmatig ingevoerde
// kostenposten van januari t/m april 2026 — zo komt de import-stijl
// overeen met wat al in het overzicht stond.

const VENDOR_ALIASES: Array<[RegExp, string]> = [
  [/vlaams broodhuys/, 'Vlaams Broodhuys'],
  [/albert heijn/, 'Albert Heijn'],
  [/bol\.?\s?com/, 'Bol.com'],
  [/viking/, 'Viking kantoorspullen'],
  [/google ireland/, 'Google Ireland'],
  [/spotify/, 'Spotify'],
  [/\biside\b/, 'Iside'],
  [/\bkpn\b/, 'KPN'],
  [/constant it/, 'Constant IT'],
  [/basenet/, 'Basenet'],
  [/herengracht investments/, 'Herengracht Investments (huur)'],
  [/norm finance/, 'Norm Finance'],
  [/international card services|^icscards|^ics\b/, 'International Card Services'],
  [/digihero/, 'Digihero'],
  [/financ.+dagblad/, 'Financieele Dagblad'],
  [/kamer van koophandel|\bkvk\b/, 'Kamer van Koophandel'],
  [/abn[\s-]?amro/, 'ABN AMRO'],
  [/stadhouders/, 'Stadhouders Advocaten'],
  [/\bkwps\b/, 'KWPS (doorbelast)'],
  [/chambers/, 'Chambers'],
  [/bright pensioen/, 'Bright Pensioen'],
  // "Delfts congress support", "Delfts Congres" — zelfde vendor
  [/delfts? congres/, 'Delfts Congress Support'],
  // Tolereer typo "Verenging" + bredere match (Vereniging voor Arbeidsrecht Advocaten Amsterdam)
  [/veren(?:i|g|ig)ing\s+(?:voor\s+)?arbeidsrecht/, 'Vereniging voor Arbeidsrecht'],
  // Vereniging Jonge Balie = aparte vereniging
  [/vereniging\s+jonge\s+balie|jonge balie/, 'Jonge Balie Amsterdam'],
  [/nederlandse orde|contributie nederlandse orde/, 'Nederlandse Orde van Advocaten'],
  [/amsterdamse orde/, 'Amsterdamse Orde van Advocaten'],
  [/spontaanja|spontaan ja/, 'Spontaanja schoonmaker'],
  [/smartcoffee|smart coffee/, 'Smartcoffee (Boonchance)'],
  [/bocca coffee|bocca koffie/, 'Bocca Coffee'],
  [/dba .*bary|\bde bary\b/, 'De Bary koffie'],
  [/dba hospitality/, 'DBA Hospitality'],
  [/gamma business/, 'Gamma Business'],
  [/\bfroot\b/, 'Froot'],
  [/tentoo/, 'Tentoo'],
  [/fleurop/, 'Fleurop bloemen'],
  [/post\s?nl|\bpostnl\b/, 'PostNL'],
  [/marie[\s-]?stella/, 'Marie-Stella-Maris'],
  [/\bhema\b/, 'HEMA'],
  [/rituals/, 'Rituals'],
  [/topgeschenken/, 'Topgeschenken'],
  [/brownie box/, 'Brownie box (relatiegeschenken)'],
  // ASR — alle premiebetalingen op één hoop (verzuimverzekering)
  [/asr verzuim|verzuimverzekering|asr\s+schadeverzekering|\basr\s+nederland\b|\basr\b/, 'ASR Verzuimverzekering'],
  [/fietskoerier/, 'Fietskoerier'],
  [/zerozero|zero zero|broodjes zero/, 'Zerozero broodjes'],
  [/krua thai/, 'Krua Thai (partnerdiner)'],
  [/stichting opleiding/, 'Stichting Opleiding Advocaten'],
  [/stichting idfa/, 'Stichting IDFA'],
  [/proceskosten/, 'Proceskosten'],
  [/mooi boules/, 'Mooi Boules (borrel)'],
  [/hotel arena/, 'Hotel Arena (borrel)'],
  [/merchado|merchlab|merchandise/, 'Merchandise (lustrum)'],
  [/legal\s?mike/, 'Legal Mike'],
  [/legal\s?planet/, 'Legal Planet'],
  [/doxflow/, 'Doxflow'],
  [/vurich/, 'Vurich gerechtsdeurwaarder'],
  [/ttwwoo/, 'TTWWOO'],
  [/milieuservice/, 'Milieuservice'],
  [/ndsm/, 'NDSM Apotheek'],
  [/bram willems/, 'Bram Willems Photography'],
  // Van Loman — varianten met/zonder spatie, met/zonder trailing punt
  [/\bvan\s?loman\b/, 'Van Loman (doorbelast)'],
  [/van benthem/, 'Van Benthem & Keulen'],
  [/hj advocaten/, 'HJ Advocaten & Mediators'],
  [/stichting spuistraat/, 'Stichting Spuistraat 10'],
  [/coolblue/, 'Coolblue'],
  [/adobe/, 'Adobe'],
  [/athenaeum/, 'Athenaeum'],
  [/\bpci\b/, 'PCI (printer)'],
  [/de lage landen/, 'De Lage Landen Vendorlease'],
  [/marleenkookt/, 'Marleenkookt'],
  [/nectaro/, 'Nectaro (Lodewijk)'],
  [/buffet van odette/, 'Buffet van Odette'],
  [/\bns reizigers\b|\bns groep\b|\bns reisb/, 'NS'],
  [/mediationgenootschap/, 'Mediationgenootschap'],
  [/alo .*mediation|partners in mediation/, 'ALO (Partners in Mediation)'],
  [/citius/, 'Citius Advocaten'],
  [/avocare/, 'Avocare'],
  [/pallas/, 'Pallas Advocaten'],
  [/youman fisher/, 'Youman Fisher'],
  [/academie voor de rechtspr/, 'Academie voor de Rechtspraak'],
  [/amstelveld/, 'Amstelveld (borrel)'],
  [/dutch arbitration/, 'Dutch Arbitration Association'],
  // Ministerie van Justitie / Veiligheid en Justitie = zelfde vendor
  [/ministerie\s+van\s+(veiligheid\s+en\s+)?justitie/, 'Ministerie van Justitie (doorbelast)'],
  [/kosten buitenlandse/, 'Buitenlandse overboeking-kosten'],
  [/five city spa/, 'Five City Spa'],
  [/fiets workx/, 'Fiets Workx (medewerker)'],
  [/declaratieformulier|^declaratie\b/, 'Declaratieformulier medewerker'],
  [/cadeau|boekenbon|nijntje/, 'Cadeaus medewerkers/relaties'],
  [/abonnement|\babo\s/, 'Diverse abonnementen'],
  // Doublures opgemerkt uit MT940-import
  [/^sdu\b|sdu uitgevers/, 'Sdu Uitgevers'],
  [/jones brothers/, 'Jones Brothers Coffee'],
  [/ceppi[.\s']*s?\s+deli|\bceppi/, 'Ceppi\'s Deli'],
  [/veloretti/, 'Veloretti'],
  [/otterlo\s*events|\botterlo\b/, 'Otterlo Events'],
  [/the data lawyers/, 'The Data Lawyers'],
  [/natec sunergy/, 'Natec Sunergy'],
  [/fgn\s+lansingerland|\bfgn\b/, 'FGN Lansingerland'],
  [/het helderhuys/, 'Het Helderhuys'],
  [/het koekemannetje/, 'Het Koekemannetje'],
  [/alpina westland/, 'Alpina Westland'],
]

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bB\.?\s?V\.?\b/gi, 'BV')
    .replace(/\bN\.?\s?V\.?\b/gi, 'NV')
    .trim()
}

function aliasMatch(text: string): string | null {
  const cleaned = text.toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  for (const [re, label] of VENDOR_ALIASES) {
    if (re.test(cleaned)) return label
  }
  return null
}

// Strip betaaldienst- en boekhoud-suffixes die niets met de vendor te
// maken hebben maar in de MT940-omschrijving worden meegestuurd.
const SUFFIX_NOISE = [
  /\bvia\s+stic?hting\s+mollie\s+payments?\b.*$/i,
  /\bvia\s+mollie\b.*$/i,
  /\bvia\s+stripe(?:\s+technology(?:\s+europe(?:\s+ltd)?)?)?\b.*$/i,
  /\bvia\s+adyen\b.*$/i,
  /\bvia\s+paypal\b.*$/i,
  /\bbetalingskenm\.?:?\s*\S+\b/i,
  /\bmandaatkenm\.?:?\s*\S+\b/i,
  /\bkenmerk\s*:?.*$/i,
  /\bomschrijving\s*:?.*$/i,
  /\bmachtiging\s*:?.*$/i,
  /\bincassant\s*:?.*$/i,
  /\beref\s*:?.*$/i,
  /\bmarf\s*:?.*$/i,
]

function cleanName(raw: string): string {
  let s = raw
  for (const re of SUFFIX_NOISE) s = s.replace(re, '')
  return titleCase(
    s
      .replace(/\s*,?\s*PAS\d+\s*$/i, '')
      .replace(/\s*,\s*[A-Z]{2,4}\s*$/, '')   // ,AMS  ,NLD
      .replace(/\b(B\.?V\.?|N\.?V\.?|BVBA)\b/gi, '')
      .replace(/[.\s]+$/, '')                  // trailing punten / spaties
      .replace(/\s+/g, ' ')
      .trim()
  ) || '(geen omschrijving)'
}

// Een stabiele 'fingerprint' van de tegenpartij, ongevoelig voor
// winkelnummers, stadcodes en rechtsvorm. Gebruikt voor leer-aliassen:
// als de gebruiker een omschrijving handmatig aanpast slaan we deze key
// op naast de nieuwe naam.
function toRawKey(counterparty: string): string {
  let s = counterparty.toLowerCase()
  for (const re of SUFFIX_NOISE) s = s.replace(re, '')
  return s
    .replace(/\s*,?\s*pas\d+\s*$/i, '')
    .replace(/\s*,\s*[a-z]{2,4}\s*$/i, '')   // ", ams" / ", nld"
    .replace(/\s+\d+\s*$/, '')                 // trailing winkelnummer
    .replace(/\b(b\.?\s?v\.?|n\.?\s?v\.?|bvba)\b/gi, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Pakt de tegenpartij-string uit een MT940 :86:-regel, ongeacht de
// formattering (SWIFT-subvelden, BEA/GEA, free-text Nederlandse stijl).
function extractCounterparty(raw: string): string | null {
  const s = raw.replace(/>\d{2}/g, ' ').replace(/\s+/g, ' ').trim()
  const swift = s.match(/\/NAME\/([^/]+)/i)?.[1]
  if (swift) return swift.trim()
  const card = s.match(/\b(?:BEA|GEA|eCom|ECOM)\b[\s\S]*?\d{2}[:.]\d{2}\s+(.+?)$/i)
  if (card) return card[1].trim()
  const dutch = s.match(/\bNaam:?\s*([^]+?)(?=\s*(?:Machtiging|Omschrijving|Kenmerk|IBAN|BIC|Incassant|MARF|EREF)\b|$)/i)?.[1]
  if (dutch) return dutch.trim()
  const remi = s.match(/\/REMI\/([^/]+)/i)?.[1]
  if (remi) return remi.trim()
  return null
}

// Hoger-niveau categorie-indeling voor inzichts-overzichten ("Borrels",
// "Etentjes / Lunch", "Software & IT", etc.). De regex matcht op de
// groupKey-naam (= de alias) zodat we per vendor één categorie krijgen.
const CATEGORY_RULES: Array<[RegExp, string]> = [
  // Eten & drinken kantoor (lunch, koffie, AH-bestellingen)
  [/albert heijn|vlaams broodhuys|zerozero|bocca|de bary|smartcoffee|ceppi|jones brothers|froot|broodjes|krua thai|buffet van odette|marleenkookt|fleurop/i, 'Eten & drinken kantoor'],
  // Borrels & netwerkevenementen
  [/hotel arena|mooi boules|amstelveld|merchandise|borrel|otterlo|alpina|het helderhuys|het koekemannetje/i, 'Borrels & netwerk'],
  // Cadeaus & relatiegeschenken (incl. medewerker-cadeaus)
  [/cadeau|topgeschenken|brownie box|marie-stella-maris|rituals|five city spa|nijntje|boekenbon|hema/i, 'Cadeaus & relatiegeschenken'],
  // Externe advocaten / doorbelaste advocatenkosten
  [/stadhouders|citius|pallas|youman fisher|legal mike|legal planet|the data lawyers|hj advocaten|van benthem|van loman|nectaro|avocare|bram willems/i, 'Externe advocaten'],
  // Lidmaatschap / beroepsverenigingen
  [/orde van advocaten|nederlandse orde|amsterdamse orde|jonge balie|vereniging voor arbeidsrecht|chambers|stichting idfa|dutch arbitration|mediationgenootschap|alo \(partners|stichting opleiding|stichting spuistraat/i, 'Lidmaatschap & beroep'],
  // Opleiding & cursus
  [/academie voor de rechtspraak|delfts congress|opleiding advocaten/i, 'Opleidingen & cursus'],
  // Software & IT
  [/constant it|adobe|google ireland|digihero|basenet|doxflow|spotify|coolblue|ttwwoo|pci|sdu uitgevers|legal planet/i, 'Software & IT'],
  // Huur & vaste kantoorlasten
  [/herengracht investments|stichting spuistraat/i, 'Huur'],
  // Verzekering
  [/asr verzuim|aegon|nationale-nederlanden|chambers/i, 'Verzekeringen'],
  // Banken & financieel
  [/abn amro|international card services|norm finance|kwps|bright pensioen/i, 'Bank & financieel'],
  // Kantoorbenodigdheden / inkopen
  [/viking|gamma business|fiets workx|coolblue|hema|milieuservice|fleurop/i, 'Kantoorbenodigdheden'],
  // Vervoer, post & koeriers
  [/postnl|ns reizigers|ns groep|fietskoerier|veloretti/i, 'Vervoer & post'],
  // Pers & abonnementen
  [/financieele dagblad|sdu uitgevers|athenaeum|abonnement/i, 'Pers & abonnementen'],
  // Kamer van Koophandel / overheden
  [/kamer van koophandel|ministerie van justitie|vurich|proceskosten|kosten buitenlandse/i, 'Overheid & deurwaarder'],
  // Personeel & declaraties (Workx-medewerkers)
  [/declaratieformulier|fiets workx|maaike de jong|isma\s+—\s+declaratie/i, 'Declaraties & personeel'],
  // Management fee (apart)
  [/^management fee/i, 'Management fee partners'],
]

// Geef een hogere categorie terug voor een (al genormaliseerde) vendor-naam
// of -description. Gebruikt voor de "Per categorie" overzichten.
export function vendorCategory(descriptionOrKey: string): string {
  const s = descriptionOrKey || ''
  for (const [re, label] of CATEGORY_RULES) {
    if (re.test(s)) return label
  }
  return 'Overig'
}

// Voor groeperen in overzicht. Probeert eerst alias-match op de ruwe
// description, dan op de schoongemaakte naam (zonder Mollie/Stripe-noise),
// en valt anders terug op de eerste 2 woorden van de schoonmaakte naam.
export function groupKey(desc: string): string {
  const direct = aliasMatch(desc)
  if (direct) return direct
  // Strip suffix-noise + rechtsvorm + trailing punten, dan opnieuw alias proberen
  let cleaned = desc
  for (const re of SUFFIX_NOISE) cleaned = cleaned.replace(re, '')
  cleaned = cleaned
    .replace(/\b(b\.?\s?v\.?|n\.?\s?v\.?|bvba)\b/gi, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const onCleaned = aliasMatch(cleaned)
  if (onCleaned) return onCleaned
  return cleaned
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || desc
}

export interface NormalizedVendor {
  vendorName: string  // korte, leesbare naam ("Vlaams Broodhuys")
  rawKey: string      // stabiele fingerprint van de tegenpartij ("vlaams broodhuys") — voor leer-aliassen
}

// Normaliseer een MT940 :86:-string (of een eerder grof opgeschoonde
// variant daarvan) naar een korte, leesbare omschrijving in dezelfde
// stijl als de handmatig ingevoerde posten. Geeft ook een rawKey terug:
// een stabiele fingerprint van de tegenpartij waaraan leer-aliassen
// gekoppeld kunnen worden.
export function normalizeVendor(raw: string): NormalizedVendor {
  if (!raw || !raw.trim()) {
    return { vendorName: '(geen omschrijving)', rawKey: '' }
  }
  const cp = extractCounterparty(raw)
  if (cp) {
    const key = toRawKey(cp) || cp.toLowerCase()
    const alias = aliasMatch(cp)
    return { vendorName: alias ?? cleanName(cp), rawKey: key }
  }
  // Niets gestructureerd herkenbaar — probeer alias op de hele string
  const s = raw.replace(/>\d{2}/g, ' ').replace(/\s+/g, ' ').trim()
  const alias = aliasMatch(s)
  const fallback = s.slice(0, 60)
  return {
    vendorName: alias ?? cleanName(fallback),
    rawKey: toRawKey(fallback) || fallback.toLowerCase(),
  }
}
