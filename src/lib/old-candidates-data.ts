// Historische lijst potentiele kandidaten — bron: BaseNet-letter mei/juni 2026.
// Read-only referentie zodat we 't niet vergeten.

export type OldCandidateCategory =
  | 'aangenomen'         // Inmiddels bij Workx
  | 'komt-langs'         // Komt langs voor koffie / vervolgafspraak
  | 'eerder-gesproken'   // Eerder contact gehad
  | 'staat-niet-open'    // Wees afgewezen of niet bereid
  | 'onbekend'           // Geen contact bij medewerkers

export interface OldCandidate {
  name: string
  office: string
  years: string
  notes: string
  category: OldCandidateCategory
}

export const OLD_CANDIDATES: OldCandidate[] = [
  {
    name: 'Alexander Collot d\'Escury',
    office: 'Stibbe',
    years: '7 jaar',
    notes: 'Emma gesproken en heel enthousiast. Bas maakte vervolgafspraak. Inmiddels bij Workx.',
    category: 'aangenomen',
  },
  {
    name: 'Juliette van der Beek',
    office: 'DLA',
    years: '7 jaar',
    notes: 'Komt langs voor koffie.',
    category: 'komt-langs',
  },
  {
    name: 'Emma Boellaard',
    office: 'DLA',
    years: '3 jaar',
    notes: 'Komt langs voor koffie.',
    category: 'komt-langs',
  },
  {
    name: 'Marije Ozinga',
    office: 'Dentons',
    years: '8 jaar',
    notes: 'Eerder gesproken. Toen bal bij haar laten liggen omdat ze nog zoekende was.',
    category: 'eerder-gesproken',
  },
  {
    name: 'Caspar Bosma',
    office: 'Lexence (eerder Barents Krantz)',
    years: '6 jaar',
    notes: 'Eerder gesproken. Justine contact gehad. Zit nog op zijn plek bij Lexence.',
    category: 'eerder-gesproken',
  },
  {
    name: 'Sanne Wouters',
    office: 'De Koning Vergouwen',
    years: '6 jaar arbeidsrecht (1,5 jaar stage + jurist; daarvoor 4 jaar OM)',
    notes: 'Eerder gesproken. Atypische achtergrond. Waren positief over persoon, maar geen plek voor haar profiel destijds.',
    category: 'eerder-gesproken',
  },
  {
    name: 'Eva Bokslag',
    office: 'ACT',
    years: '7 jaar',
    notes: 'Eerder gesproken. Leuk gesprek. Vermoedelijk geen corporate-ervaring + andere betere profielen destijds.',
    category: 'eerder-gesproken',
  },
  {
    name: 'Puck Keurentjes',
    office: 'Vestius',
    years: '5 jaar',
    notes: 'Wies heeft bericht. Staat niet open voor overstap.',
    category: 'staat-niet-open',
  },
  {
    name: 'Erik Steenis',
    office: 'Liberdock (voorheen Lexence)',
    years: '7 jaar',
    notes: 'Waarschijnlijk korte-termijn partnerambities. Geen direct contact via medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Claire Vogel',
    office: 'Van Doorne',
    years: '10 jaar',
    notes: 'Recent overgestapt van Bronsgeest Deur naar Lexence. Partnerambities onbekend. Niet bekend bij medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Pieter de Ruiter',
    office: 'Pallas',
    years: '9 jaar',
    notes: 'Waarschijnlijk korte-termijn partnerambities. Veel medezeggenschap. Niet bekend bij medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Fanny Sax',
    office: 'Bergh Stoop & Sanders',
    years: '9 jaar',
    notes: 'Ruime ervaring. Corporate-ervaring + partnerambities onbekend. Niet bekend bij medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Renske van Herpen',
    office: 'Bronsgeest Deur',
    years: '5 jaar',
    notes: 'Niet bekend bij medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Thomas van der Toorn',
    office: 'Bronsgeest Deur',
    years: '5 jaar',
    notes: 'Niet bekend bij medewerkers.',
    category: 'onbekend',
  },
  {
    name: 'Maikel Doting',
    office: 'AKD',
    years: '3 jaar',
    notes: 'Erika kent hem.',
    category: 'onbekend',
  },
  {
    name: 'Guido Brandt',
    office: 'Wieringa',
    years: '3 jaar',
    notes: 'Erika kent hem.',
    category: 'onbekend',
  },
]

export const CATEGORY_META: Record<OldCandidateCategory, { label: string; emoji: string; color: string }> = {
  'aangenomen':       { label: 'Inmiddels bij Workx',  emoji: '🎉', color: 'green' },
  'komt-langs':       { label: 'Komt langs / loopt',   emoji: '☕', color: 'lime' },
  'eerder-gesproken': { label: 'Eerder gesproken',     emoji: '💬', color: 'blue' },
  'staat-niet-open':  { label: 'Staat niet open',      emoji: '🚫', color: 'red' },
  'onbekend':         { label: 'Nog onbekend',         emoji: '❓', color: 'gray' },
}
