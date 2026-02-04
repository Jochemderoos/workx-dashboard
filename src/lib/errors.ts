// Centralized error messages (Dutch)
export const ERROR_MESSAGES = {
  // Auth errors
  UNAUTHORIZED: 'Niet geautoriseerd',
  FORBIDDEN: 'Geen toegang',
  INVALID_CREDENTIALS: 'Ongeldige inloggegevens',
  SESSION_EXPIRED: 'Sessie verlopen',

  // Not found
  NOT_FOUND: 'Niet gevonden',
  USER_NOT_FOUND: 'Gebruiker niet gevonden',
  RESOURCE_NOT_FOUND: 'Resource niet gevonden',

  // Validation
  INVALID_INPUT: 'Ongeldige invoer',
  MISSING_REQUIRED: 'Verplichte velden ontbreken',
  INVALID_FORMAT: 'Ongeldig formaat',

  // Server errors
  INTERNAL_ERROR: 'Server fout',
  DATABASE_ERROR: 'Database fout',

  // Common operations
  FAILED_TO_FETCH: 'Kon gegevens niet ophalen',
  FAILED_TO_CREATE: 'Kon niet aanmaken',
  FAILED_TO_UPDATE: 'Kon niet bijwerken',
  FAILED_TO_DELETE: 'Kon niet verwijderen',
} as const

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES
