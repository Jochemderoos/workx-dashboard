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
  [/international card services|^icscards/, 'International Card Services'],
  [/digihero/, 'Digihero'],
  [/financ.+dagblad/, 'Financieele Dagblad'],
  [/kamer van koophandel|\bkvk\b/, 'Kamer van Koophandel'],
  [/abn[\s-]?amro/, 'ABN AMRO'],
  [/stadhouders/, 'Stadhouders Advocaten'],
  [/\bkwps\b/, 'KWPS (doorbelast)'],
  [/chambers/, 'Chambers'],
  [/bright pensioen/, 'Bright Pensioen'],
  [/delfts? congress|delft congress/, 'Delfts Congress Support'],
  [/vereniging (voor )?arbeidsrecht/, 'Vereniging voor Arbeidsrecht'],
  [/nederlandse orde|contributie nederlandse orde/, 'Nederlandse Orde van Advocaten'],
  [/amsterdamse orde/, 'Amsterdamse Orde van Advocaten'],
  [/spontaanja|spontaan ja/, 'Spontaanja schoonmaker'],
  [/smartcoffee/, 'Smartcoffee (Boonchance)'],
  [/bocca coffee|bocca koffie/, 'Bocca Coffee'],
  [/dba .*bary|\bde bary\b/, 'De Bary koffie'],
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
  [/asr verzuim/, 'ASR Verzuimverzekering'],
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
  [/doxflow/, 'Doxflow'],
  [/vurich/, 'Vurich gerechtsdeurwaarder'],
  [/ttwwoo/, 'TTWWOO'],
  [/milieuservice/, 'Milieuservice'],
  [/jonge balie/, 'Jonge Balie Amsterdam'],
  [/ndsm/, 'NDSM Apotheek'],
  [/bram willems/, 'Bram Willems Photography'],
  [/van loman/, 'Van Loman (doorbelast)'],
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
  [/academie voor de rechtspraak/, 'Academie voor de Rechtspraak'],
  [/amstelveld/, 'Amstelveld (borrel)'],
  [/dutch arbitration/, 'Dutch Arbitration Association'],
  [/ministerie van justitie/, 'Ministerie van Justitie (doorbelast)'],
  [/kosten buitenlandse/, 'Buitenlandse overboeking-kosten'],
  [/five city spa/, 'Five City Spa'],
  [/fiets workx/, 'Fiets Workx (medewerker)'],
  [/declaratieformulier|^declaratie\b/, 'Declaratieformulier medewerker'],
  [/cadeau|boekenbon|nijntje/, 'Cadeaus medewerkers/relaties'],
  [/abonnement|\babo\s/, 'Diverse abonnementen'],
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

function cleanName(raw: string): string {
  return titleCase(
    raw
      .replace(/\s*,?\s*PAS\d+\s*$/i, '')
      .replace(/\s*,\s*[A-Z]{2,4}\s*$/, '')   // ,AMS  ,NLD
      .replace(/\b(B\.?V\.?|N\.?V\.?|BVBA)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
  ) || '(geen omschrijving)'
}

// Voor groeperen in overzicht (vervangt de oude groupKey in page.tsx).
export function groupKey(desc: string): string {
  const m = aliasMatch(desc)
  if (m) return m
  return desc
    .replace(/\(.*?\)/g, '')
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// Normaliseer een MT940 :86:-string (of een eerder grof opgeschoonde
// variant daarvan) naar een korte, leesbare omschrijving in dezelfde
// stijl als de handmatig ingevoerde posten.
export function normalizeVendor(raw: string): string {
  if (!raw || !raw.trim()) return '(geen omschrijving)'
  const s = raw.replace(/>\d{2}/g, ' ').replace(/\s+/g, ' ').trim()

  // 1) SWIFT-subvelden: /TRTP/.../NAME/<COUNTERPARTY>/REMI/...
  const swiftName = s.match(/\/NAME\/([^/]+)/i)?.[1]
  if (swiftName) {
    return aliasMatch(swiftName) ?? cleanName(swiftName)
  }

  // 2) Kaarttransactie (BEA/GEA/eCom):
  //    "BEA, Betaalpas 1234, 19.05.26/18:42 ALBERT HEIJN 1234,AMS,PAS123"
  const card = s.match(/\b(?:BEA|GEA|eCom|ECOM)\b[\s\S]*?\d{2}[:.]\d{2}\s+(.+?)$/i)
  if (card) {
    const name = card[1].trim()
    return aliasMatch(name) ?? cleanName(name)
  }

  // 3) Free-text Nederlandse stijl: "Naam: <COUNTERPARTY> Omschrijving: ..."
  const dutchName = s.match(/\bNaam:?\s*([^]+?)(?=\s*(?:Machtiging|Omschrijving|Kenmerk|IBAN|BIC|Incassant|MARF|EREF)\b|$)/i)?.[1]
  if (dutchName) {
    return aliasMatch(dutchName) ?? cleanName(dutchName)
  }

  // 4) Soms staat de naam direct na "/REMI/" zonder /NAME/
  const remiName = s.match(/\/REMI\/([^/]+)/i)?.[1]
  if (remiName) {
    const alias = aliasMatch(remiName)
    if (alias) return alias
  }

  // 5) Niets gestructureerd gevonden → probeer alias op de hele string
  const alias = aliasMatch(s)
  if (alias) return alias

  // 6) Laatste redmiddel: eerste 60 tekens, opgeschoond
  return cleanName(s.slice(0, 60))
}
