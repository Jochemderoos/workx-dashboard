// Zaken constants - can be used client-side

// Experience year labels
export const EXPERIENCE_LABELS: Record<number, string> = {
  0: 'Juridisch medewerker',
  1: '1e jaars',
  2: '2e jaars',
  3: '3e jaars',
  4: '4e jaars',
  5: '5e jaars',
  6: '6e jaars',
  7: '7e jaars',
  8: '8+ jaars',
}

// Urgency config
export const URGENCY_CONFIG = {
  LOW: { label: 'Laag', color: '#22c55e', bgColor: 'bg-green-500/10', textColor: 'text-green-400' },
  NORMAL: { label: 'Normaal', color: '#3b82f6', bgColor: 'bg-blue-500/10', textColor: 'text-blue-400' },
  HIGH: { label: 'Hoog', color: '#f59e0b', bgColor: 'bg-amber-500/10', textColor: 'text-amber-400' },
  URGENT: { label: 'Urgent', color: '#ef4444', bgColor: 'bg-red-500/10', textColor: 'text-red-400' },
}

// Start method labels
export const START_METHOD_LABELS = {
  CONTACT_CLIENT: 'Neem contact op met klant',
  INFO_FROM_PARTNER: 'Vraag info bij partner',
}
