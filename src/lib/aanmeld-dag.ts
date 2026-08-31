// Wanneer springt "me aanmelden voor kantoor" door naar de volgende werkdag.
//
// Vanaf 13:00 meldt in de praktijk bijna niemand zich nog aan voor de dag
// zelf, dus staat vanaf dat uur de volgende werkdag voorgeselecteerd — zowel
// op de Appjeplekje-pagina als in de widget op het dashboard.

export const AANMELD_OMSLAGUUR = 13

/** Is het na het omslaguur op een gewone werkdag? */
export function naOmslaguur(nu: Date = new Date()): boolean {
  return nu.getHours() >= AANMELD_OMSLAGUUR
}

export function isWeekend(nu: Date = new Date()): boolean {
  const dag = nu.getDay()
  return dag === 0 || dag === 6
}

/**
 * Welk tabje ("vandaag" of "morgen") staat voorgeselecteerd in de
 * dashboard-widget.
 *
 * In het weekend niet doorspringen: het tabje "vandaag" wijst dan al naar de
 * eerstvolgende maandag, en doorspringen zou je op dinsdag laten uitkomen.
 */
export function standaardWidgetDag(nu: Date = new Date()): 'today' | 'tomorrow' {
  if (isWeekend(nu)) return 'today'
  return naOmslaguur(nu) ? 'tomorrow' : 'today'
}
