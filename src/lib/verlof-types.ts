// Gedeelde definitie van verlof-types in het vakantieschema.
// Alleen 'vakantie' telt van het vakantiesaldo af; alle andere types zijn
// verlof dat apart geteld wordt (en dus NIET van de vakantiedagen afgaat).
// Gebruikt door de vakantiepagina, de summary-API, employee-compensation en Team.

export type VerlofType =
  | 'vakantie'
  | 'onbetaald'
  | 'zwangerschap'
  | 'ouderschap_betaald'
  | 'ouderschap_onbetaald'
  | 'geboorteverlof'

export interface VerlofTypeDef {
  key: VerlofType
  label: string      // volledige naam
  short: string      // korte naam (badges/tellers)
  countsAgainstSaldo: boolean
  totalDays: number | null // wettelijk maximum in werkdagen (null = geen cap)
  // Tailwind-kleuraccent voor badges (text/bg) + progress-bar (bar)
  text: string
  bg: string
  bar: string
}

export const VERLOF_TYPES: VerlofTypeDef[] = [
  { key: 'vakantie',             label: 'Vakantie',                          short: 'Vakantie',       countsAgainstSaldo: true,  totalDays: null, text: 'text-green-400', bg: 'bg-green-500/15',  bar: 'bg-green-400' },
  { key: 'onbetaald',            label: 'Onbetaald verlof',                  short: 'Onbetaald',      countsAgainstSaldo: false, totalDays: null, text: 'text-sky-400',   bg: 'bg-sky-500/15',    bar: 'bg-sky-400' },
  { key: 'zwangerschap',         label: 'Zwangerschaps-/bevallingsverlof',   short: 'Zwangerschap',   countsAgainstSaldo: false, totalDays: 80,   text: 'text-pink-400',  bg: 'bg-pink-500/15',   bar: 'bg-pink-400' },
  { key: 'ouderschap_betaald',   label: 'Betaald ouderschapsverlof',         short: 'Betaald OV',     countsAgainstSaldo: false, totalDays: 40,   text: 'text-purple-400', bg: 'bg-purple-500/15', bar: 'bg-purple-400' },
  { key: 'ouderschap_onbetaald', label: 'Onbetaald ouderschapsverlof',       short: 'Onbetaald OV',   countsAgainstSaldo: false, totalDays: 85,   text: 'text-indigo-400', bg: 'bg-indigo-500/15', bar: 'bg-indigo-400' },
  { key: 'geboorteverlof',       label: 'Aanvullend geboorteverlof partner', short: 'Geboorteverlof', countsAgainstSaldo: false, totalDays: 25,   text: 'text-blue-400',  bg: 'bg-blue-500/15',   bar: 'bg-blue-400' },
]

const BY_KEY: Record<string, VerlofTypeDef> = Object.fromEntries(VERLOF_TYPES.map(t => [t.key, t]))

export function normalizeVerlofType(t: unknown): VerlofType {
  return typeof t === 'string' && BY_KEY[t] ? (t as VerlofType) : 'vakantie'
}

export function verlofDef(t: unknown): VerlofTypeDef {
  return BY_KEY[normalizeVerlofType(t)]
}

// Types die NIET van het vakantiesaldo afgaan (alles behalve 'vakantie').
export const NON_SALDO_TYPES: VerlofType[] = VERLOF_TYPES.filter(t => !t.countsAgainstSaldo).map(t => t.key)

// Verlof-types (dus zonder vakantie/onbetaald) — voor de Team-tellers per persoon.
export const OUDERSCHAP_TYPES: VerlofType[] = ['zwangerschap', 'ouderschap_betaald', 'ouderschap_onbetaald', 'geboorteverlof']
