// Reveal-moment: vanaf wanneer ziet iedereen elkaars input + het totaal-overzicht.
// Vóór dit moment ziet een medewerker alleen z'n eigen input.
// Partners + ADMIN zien altijd alles, ook vóór de reveal.
//
// Belangrijk: medewerkers kunnen ALTIJD blijven toevoegen aan hun lijst —
// ook na de reveal. We zoeken doorlopend nieuw talent.
export const RECRUITMENT_REVEAL_AT = new Date('2026-06-08T10:45:00+02:00')

// Volgende recruitment-overleg. Wijzig deze datum vóór elk overleg.
// De Slack-reminders (vrijdag 10:00 en maandag 09:15) firen alleen
// als we binnen 4 dagen vóór deze datum zitten.
export const NEXT_RECRUITMENT_MEETING = new Date('2026-06-08T11:00:00+02:00')

export function isBeforeReveal(now: Date = new Date()): boolean {
  return now < RECRUITMENT_REVEAL_AT
}

// Aantal kandidaat-slots dat in het formulier wordt getoond bij de eerste
// invul-ronde. Medewerkers kunnen er meer toevoegen via een "+"-knop.
export const INITIAL_CANDIDATE_SLOTS = 5

export const APPROACH_STATUSES = [
  { value: 'niet_benaderd', label: 'Nog niet benaderd', color: 'gray' },
  { value: 'benaderd', label: 'Benaderd', color: 'yellow' },
  { value: 'in_gesprek', label: 'In gesprek', color: 'blue' },
  { value: 'aangenomen', label: 'Aangenomen', color: 'green' },
  { value: 'afgewezen', label: 'Afgewezen / niet door', color: 'red' },
] as const

export const POSTING_OPTIONS = [
  { value: 'ja', label: 'Ja, graag', emoji: '🎉' },
  { value: 'ja_soms', label: 'Ja, af en toe', emoji: '👍' },
  { value: 'weet_niet', label: 'Weet ik nog niet', emoji: '🤔' },
  { value: 'nee', label: 'Liever niet', emoji: '🙅' },
] as const
