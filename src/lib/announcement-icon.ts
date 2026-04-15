// Eerste-match wint, dus volgorde = prioriteit.
// Concrete/feestelijke dingen bovenaan, abstracte/algemene termen onderin.
// Korte ambigue woorden (≤4 letters) vereisen een woordgrens om false positives te vermijden.
const ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  // --- Feestelijk / cadeaus / mijlpalen ---
  { keywords: ['cadeau', 'cadeautje', 'pakje', 'gift', 'verras'], icon: '🎁' },
  { keywords: ['lustrum', 'jubileum', 'mijlpaal', 'jubilaris'], icon: '🥂' },
  { keywords: ['jarig', 'verjaardag', 'birthday', 'gefeliciteerd', 'proficiat', 'felicitaties', 'feliciteren'], icon: '🎂' },
  { keywords: ['taart', 'gebak', 'cake'], icon: '🍰' },
  { keywords: ['bloem', 'boeket'], icon: '💐' },
  { keywords: ['champagne', 'proost', 'toosten', 'bubbels'], icon: '🥂' },
  { keywords: ['borrel', 'drinks', 'vrijmibo', 'vrimibo', 'feest', 'party'], icon: '🍻' },
  { keywords: ['pizza'], icon: '🍕' },
  { keywords: ['lunch', 'diner', 'restaurant', 'maaltijd'], icon: '🍽️' },
  { keywords: ['koffie', 'koffiebar', 'espresso', 'cappuccino'], icon: '☕' },

  // --- Mensen / nieuws ---
  { keywords: ['welkom', 'nieuwe collega', 'starter', 'introduce'], icon: '👋' },
  { keywords: ['baby', 'geboren', 'geboorte'], icon: '👶' },
  { keywords: ['trouwen', 'getrouwd', 'huwelijk', 'bruiloft'], icon: '💍' },

  // --- Werk: zaken & juridisch ---
  { keywords: ['rechtspraak', 'wetgeving', 'arrest', 'uitspraak', 'jurisprudentie', 'rechter'], icon: '⚖️' },
  { keywords: ['cliënt', 'client', 'klant'], icon: '🤝' },
  { keywords: ['dossier', 'casus', 'zaak'], icon: '📁' },
  { keywords: ['contract', 'overeenkomst', 'akte', 'document'], icon: '📄' },

  // --- Werk: financieel ---
  { keywords: ['factuur', 'declaratie', 'declareren', 'factureren', 'facturatie'], icon: '🧾' },
  { keywords: ['omzet', 'budget', 'financiën', 'bonus', 'salaris', 'euro'], icon: '💶' },

  // --- Agenda & herinneringen ---
  { keywords: ['vergader', 'meeting', 'overleg', 'bespreking', 'agenda'], icon: '📅' },
  { keywords: ['training', 'cursus', 'opleiding', 'workshop'], icon: '🎓' },
  { keywords: ['herinnering', 'reminder', 'vergeet', 'denk eraan', 'denk er aan', 'niet vergeten'], icon: '⏰' },

  // --- Afwezigheid ---
  { keywords: ['vakantie', 'verlof', 'afwezig'], icon: '🌴' },
  { keywords: ['ziek', 'griep', 'corona'], icon: '🤒' },

  // --- Locatie / gebouw ---
  { keywords: ['kantoor', 'pand', 'verhuizing', 'verhuizen'], icon: '🏢' },

  // --- IT ---
  { keywords: ['printer'], icon: '🖨️' },
  { keywords: ['computer', 'laptop', 'wifi', 'internet', 'storing', 'systeem'], icon: '💻' },
  { keywords: ['email', 'inbox'], icon: '📧' },
  { keywords: ['telefoon', 'bellen', 'gebeld'], icon: '📞' },

  // --- Reis / vervoer ---
  { keywords: ['parkeer', 'parkeren', 'auto'], icon: '🚗' },
  { keywords: ['fiets'], icon: '🚲' },
  { keywords: ['trein', 'ns-storing'], icon: '🚆' },

  // --- Weer ---
  { keywords: ['regen', 'sneeuw', 'storm', 'noodweer'], icon: '🌧️' },
  { keywords: ['mooi weer', 'zonnig'], icon: '☀️' },

  // --- Bedankt / urgent (laatst, want vaak losse termen in andere context) ---
  { keywords: ['bedankt', 'dankjewel', 'dank je', 'dank u'], icon: '🙏' },
  { keywords: ['urgent', 'spoed', 'asap'], icon: '🚨' },
]

export function getAnnouncementIcon(message: string, priority?: string): string {
  const lower = (message || '').toLowerCase()
  for (const rule of ICON_RULES) {
    for (const k of rule.keywords) {
      if (k.length <= 4) {
        // Korte woorden alleen op woordgrens matchen.
        const re = new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`, 'i')
        if (re.test(lower)) return rule.icon
      } else {
        if (lower.includes(k)) return rule.icon
      }
    }
  }
  return priority === 'urgent' ? '🚨' : '📢'
}
