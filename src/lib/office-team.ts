// Office-team — back office / admin. PersonKey is een stabiele lowercase id;
// naam en foto worden via team-photos opgezocht.

export interface OfficePerson {
  key: string
  name: string
  role: string
}

export const OFFICE_PEOPLE: OfficePerson[] = [
  { key: 'hanna', name: 'Hanna Blaauboer', role: 'Head of Office' },
  { key: 'lotte', name: 'Lotte van Sint Truiden', role: 'Office Assistant' },
  { key: 'bente', name: 'Bente Karels', role: 'Office Assistant' },
  { key: 'diyar', name: 'Diyar Wakkas', role: 'Werkstudent' },
]

export const OFFICE_PERSON_KEYS = OFFICE_PEOPLE.map(p => p.key)

// Wie mag het office-schema bewerken? ADMIN-rol, of een van de office-personen
// (op naam-match, voor gevallen waar Lotte/Bente/Diyar geen ADMIN-rol hebben).
export function canEditOffice(session: { user?: { name?: string | null; role?: string | null } } | null | undefined): boolean {
  if (!session?.user) return false
  if (session.user.role === 'ADMIN') return true
  const name = session.user.name?.toLowerCase() || ''
  return OFFICE_PEOPLE.some(p => p.name.toLowerCase() === name)
}
