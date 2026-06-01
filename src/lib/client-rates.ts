// Afwijkende klant-uurtarieven (geïmporteerd uit "Klant - afwijkende uurtarieven.docx").
// Bron is een Word-document dat Hanna onderhoudt; bij wijziging deze lijst handmatig bijwerken
// of later naar een Prisma-model migreren.

export interface ClientRateLine {
  rol: string
  tarief: number | null // null = "n.v.t." (bv. project- of jaarbedrag staat in `vast`)
}

export interface ClientRate {
  klant: string
  vanaf: string // tekstuele datum, bv. "1 januari 2026"
  tarieven: ClientRateLine[]
  vast?: { label: string; bedrag: number } // bv. "Per project" of "Per jaar"
  notes?: string[] // losse opmerkingen onder de regels
  opmerking?: string // partner-opmerking ("Kan dit omhoog?", etc.)
}

export const CLIENT_RATES: ClientRate[] = [
  {
    klant: 'Lineage',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partners', tarief: 330 },
      { rol: 'Counsel', tarief: 310 },
      { rol: '8 jaar+', tarief: 295 },
      { rol: '7 jaar', tarief: 285 },
      { rol: '6 jaar', tarief: 265 },
      { rol: '5 jaar', tarief: 260 },
      { rol: '4 jaar', tarief: 235 },
      { rol: '3 jaar', tarief: 206 },
      { rol: '2 jaar', tarief: 192 },
      { rol: '1 jaar', tarief: 168 },
    ],
    opmerking: 'Afspraak: 2% per jaar. Al afgesproken en gaat dus omhoog per januari.',
  },
  {
    klant: 'Accenture',
    vanaf: '1 juni 2024',
    tarieven: [
      { rol: 'Partners', tarief: 317.60 },
      { rol: '7 jaar+', tarief: 264.69 },
      { rol: '6 jaar', tarief: 255.87 },
      { rol: '5 jaar', tarief: 251.46 },
      { rol: '3 jaar', tarief: 220.58 },
      { rol: '2 jaar', tarief: 202.41 },
      { rol: '1 jaar', tarief: 194.11 },
    ],
    notes: ['Hotline standaard dossier: blended fee van € 290'],
    opmerking: 'Stijging van 5% is niet toegestaan, maximum 3,8%. Nu fixed prices per dossier afgesproken. Kan blended fee omhoog? (werken niet veel meer voor Accenture).',
  },
  {
    klant: 'Achmea',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 395 },
      { rol: 'Senior', tarief: 320 },
    ],
  },
  {
    klant: 'Arkin',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 340 },
      { rol: 'Senior', tarief: 300 },
    ],
    opmerking: 'Kan dit omhoog?',
  },
  {
    klant: 'Alo Yoga',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 395 },
      { rol: 'Senior', tarief: 330 },
      { rol: 'Junior (Heleen)', tarief: 250 },
    ],
  },
  {
    klant: 'Booking',
    vanaf: '1 februari 2025',
    tarieven: [
      { rol: 'Partner', tarief: 350 },
      { rol: 'Senior', tarief: 270 },
      { rol: 'Junior', tarief: 230 },
    ],
    notes: ['Detachering: € 200'],
    opmerking: 'Kan dit omhoog?',
  },
  {
    klant: 'Brenntag (secondment)',
    vanaf: '1 juli 2025',
    tarieven: [
      { rol: 'Alle', tarief: 225 },
    ],
    opmerking: 'Kan dit omhoog?',
  },
  {
    klant: 'Cerus',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partners', tarief: 395 },
    ],
  },
  {
    klant: 'Dura Vermeer',
    vanaf: 'Algemeen',
    tarieven: [],
    vast: { label: 'Per jaar', bedrag: 7500 },
  },
  {
    klant: 'EPEX',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 385 },
      { rol: 'Senior', tarief: 320 },
    ],
  },
  {
    klant: 'FGN',
    vanaf: 'Algemeen',
    tarieven: [],
    vast: { label: 'Per project', bedrag: 4300 },
  },
  {
    klant: 'Gunvor',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 395 },
      { rol: 'Senior', tarief: 320 },
    ],
  },
  {
    klant: 'OSW/Schwaner',
    vanaf: 'Begin zaak (december 2025)',
    tarieven: [
      { rol: 'Partner', tarief: 395 },
      { rol: 'Senior', tarief: 330 },
    ],
  },
  {
    klant: 'Outform',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Partner', tarief: 395 },
      { rol: 'Senior', tarief: 330 },
    ],
  },
  {
    klant: 'Polaroid',
    vanaf: '2025',
    tarieven: [
      { rol: 'Partner', tarief: 385 },
      { rol: 'Senior', tarief: 320 },
    ],
  },
  {
    klant: 'Lammerts van Bueren',
    vanaf: '1 januari 2026',
    tarieven: [
      { rol: 'Bas', tarief: 295 },
    ],
  },
]
