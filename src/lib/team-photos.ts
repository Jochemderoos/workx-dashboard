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

  // Kantoor
  'Hanna Blaauboer': 'https://www.workxadvocaten.nl/wp-content/uploads/2022/01/Hanna.jpg',
  'Lotte van Sint Truiden': 'https://www.workxadvocaten.nl/wp-content/uploads/2024/01/Lotte.jpg',
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

// Lijst van advocaten (voor werkdruk tracking)
export const ADVOCATEN = [
  'Justine Schellekens',
  'Marlieke Schipper',
  'Wies van Pesch',
  'Emma van der Vos',
  'Alain Heunen',
  'Kay Maes',
  'Erika van Zadelhof',
  'Heleen Pesser',
  'Barbara Rip',
  'Julia Groen',
]

// Alle teamleden
export const ALL_TEAM_MEMBERS = [
  // Partners
  'Marnix Ritmeester',
  'Jochem de Roos',
  'Maaike de Jong',
  'Bas den Ridder',
  'Juliette Niersman',
  // Advocaten
  ...ADVOCATEN,
  // Kantoor
  'Hanna Blaauboer',
  'Lotte van Sint Truiden',
]
