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
  { key: 'diyar', name: 'Diyar Wakkas', role: 'Juridisch medewerker' },
]

export const OFFICE_PERSON_KEYS = OFFICE_PEOPLE.map(p => p.key)

// Wie mag het office-schema bewerken? ADMIN of PARTNER-rol, of een van de
// office-personen op naam-match (voor Lotte/Bente/Diyar zonder ADMIN-rol).
// Partners hebben edit-rechten zodat ze bij afwezigheid van office-team ook
// kunnen bijwerken én voor testdoeleinden.
export function canEditOffice(session: { user?: { name?: string | null; role?: string | null } } | null | undefined): boolean {
  if (!session?.user) return false
  if (session.user.role === 'ADMIN' || session.user.role === 'PARTNER') return true
  const name = session.user.name?.toLowerCase() || ''
  return OFFICE_PEOPLE.some(p => p.name.toLowerCase() === name)
}

// Wie mag ALLE declaraties zien én beheren (het Overzicht: markeren als betaald,
// PDF/bijlage downloaden, verwijderen)? Naast ADMIN/PARTNER ook het back-office
// finance-team (Hanna, Lotte, Bente) op naam-match — zij verwerken declaraties
// namens iedereen. Diyar (juridisch medewerker) valt hier bewust buiten.
// Let op: privacygevoelig (IBAN's + bedragen van alle collega's).
export const EXPENSE_MANAGER_KEYS = ['hanna', 'lotte', 'bente'] as const

const EXPENSE_MANAGER_NAMES = OFFICE_PEOPLE
  .filter(p => (EXPENSE_MANAGER_KEYS as readonly string[]).includes(p.key))
  .map(p => p.name.toLowerCase())

export function canManageExpenses(user: { name?: string | null; role?: string | null } | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'PARTNER') return true
  const name = user.name?.trim().toLowerCase() || ''
  return EXPENSE_MANAGER_NAMES.includes(name)
}
