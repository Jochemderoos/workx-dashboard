// Gecentraliseerde team foto's van workxadvocaten.nl
// Eén source of truth voor alle foto's in het dashboard

export const TEAM_PHOTOS: Record<string, string> = {
  // Partners
  'Marnix Ritmeester': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Marnix-3.jpg',
  'Jochem de Roos': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Jochem-2.jpg',
  'Maaike de Jong': 'https://www.workxadvocaten.nl/wp-content/uploads/2015/06/Maaike-2021-255x245.jpg',
  'Bas den Ridder': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Bas.jpg',
  'Juliette Niersman': 'https://www.workxadvocaten.nl/wp-content/uploads/2021/09/Juliette-Klein.jpg',

  // Advocaten
  'Justine Schellekens': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/02/Justine-2025.jpg',
  'Marlieke Schipper': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Marlieke-255x245.jpg',
  'Wies van Pesch': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/11/Wiesklein.jpg',
  'Emma van der Vos': 'https://www.workxadvocaten.nl/wp-content/uploads/2023/06/Emma.jpg',
  'Alain Heunen': 'https://www.workxadvocaten.nl/wp-content/uploads/2023/10/Alain-2023.jpg',
  'Kay Maes': 'https://www.workxadvocaten.nl/wp-content/uploads/2023/11/Kay-2023.jpg',
  'Julia Groen': 'https://www.workxadvocaten.nl/wp-content/uploads/2025/06/Julia-2025.jpg',
  'Erika van Zadelhof': 'https://www.workxadvocaten.nl/wp-content/uploads/2024/01/Erika-2025.jpg',
  'Barbara Rip': 'https://www.workxadvocaten.nl/wp-content/uploads/2024/10/Barbara.jpg',
  'Heleen Pesser': 'https://www.workxadvocaten.nl/wp-content/uploads/2024/10/Heleen.jpg',
  'Alexander Collot d\'Escury': '/team/alexander.jpg',

  // Externe advocaten
  'Lodewijk van Thiel': 'https://lodewijkvanthiel.nl/wp-content/uploads/2019/03/Lodewijk-Foto_v2.jpg',

  // Kantoor
  'Hanna Blaauboer': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Hanna.jpg',
  'Lotte van Sint Truiden': '/team/lotte.jpg',
  'Bente Karels': '/team/bente-v2.jpg',
  'Diyar Wakkas': '/team/diyar.png',
}

// Helper functie om foto URL te krijgen op basis van naam of avatarUrl
// Prioriteit: avatarUrl > exacte match > voornaam match
export function getPhotoUrl(name: string, avatarUrl?: string | null): string | null {
  // Eerst avatarUrl als die is opgegeven
  if (avatarUrl) return avatarUrl

  if (!name) return null

  // Exacte match in hardcoded photos
  if (TEAM_PHOTOS[name]) return TEAM_PHOTOS[name]

  // Probeer op voornaam
  const firstName = name.split(' ')[0]
  for (const [fullName, url] of Object.entries(TEAM_PHOTOS)) {
    if (fullName.startsWith(firstName)) return url
  }

  return null
}

// Partners
export const PARTNERS = [
  'Marnix Ritmeester',
  'Jochem de Roos',
  'Maaike de Jong',
  'Bas den Ridder',
  'Juliette Niersman',
]

// Schrijven uren en horen dus thuis in de werkdruk- en urenoverzichten, maar
// zijn geen advocaat: Diyar is juridisch medewerker, Nienke werkt als zzp'er
// mee. Apart gehouden zodat ze niet als advocaat worden gelabeld in de
// overzichten die op ADVOCATEN leunen (werkverdelingsgesprekken bijvoorbeeld).
export const OVERIGE_UURSCHRIJVERS = [
  'Diyar Wakkas',
  'Nienke Louwmans',
]

// Lijst van advocaten (voor werkdruk tracking)
export const ADVOCATEN = [
  'Justine Schellekens',
  'Marlieke Schipper',
  'Wies van Pesch',
  'Emma van der Vos',
  'Kay Maes',
  'Erika van Zadelhof',
  'Heleen Pesser',
  'Barbara Rip',
  'Julia Groen',
  'Alexander Collot d\'Escury',
  // In dienst per 1 september 2026. Foto volgt; tot die tijd tonen de
  // overzichten een initiaal-blokje.
  'Laetitia Wezenbeek',
  // Lodewijk van Thiel — niet meer werkzaam bij Workx; uit team/dropdowns
  // gehaald. Zijn foto blijft in TEAM_PHOTOS voor historische weergave
  // (gemaakte uren, zaken).
]

// Alle teamleden
export const ALL_TEAM_MEMBERS = [
  // Partners
  'Marnix Ritmeester',
  'Jochem de Roos',
  'Maaike de Jong',
  'Bas den Ridder',
  'Juliette Niersman',
  // Advocaten (incl. externe)
  ...ADVOCATEN,
  // Kantoor
  'Hanna Blaauboer',
  'Lotte van Sint Truiden',
  'Bente Karels',
  'Diyar Wakkas',
]

// Office-team (back office / admin) — voor de Office aanwezigheidspagina.
// Volgorde = volgorde in UI.
export const OFFICE_TEAM: { name: string; role: string }[] = [
  { name: 'Hanna Blaauboer', role: 'Head of Office' },
  { name: 'Lotte van Sint Truiden', role: 'Office Assistant' },
  { name: 'Bente Karels', role: 'Office Assistant' },
  { name: 'Diyar Wakkas', role: 'Juridisch medewerker' },
]
