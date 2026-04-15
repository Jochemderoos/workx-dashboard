const ICON_RULES: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['borrel', 'drinks', 'vrijmibo', 'feest', 'party', 'champagne', 'proost'], icon: '🍻' },
  { keywords: ['lunch', 'eten', 'diner', 'restaurant'], icon: '🍽️' },
  { keywords: ['pizza'], icon: '🍕' },
  { keywords: ['taart', 'gebak', 'cake'], icon: '🍰' },
  { keywords: ['koffie', 'koffiebar', 'espresso', 'cappuccino'], icon: '☕' },
  { keywords: ['jarig', 'verjaardag', 'birthday', 'gefeliciteerd', 'proficiat', 'felicitaties'], icon: '🎂' },
  { keywords: ['urgent', 'spoed', 'asap', 'direct'], icon: '🚨' },
  { keywords: ['vakantie', 'verlof', 'vrij', 'weg', 'afwezig', 'vrije dag'], icon: '🌴' },
  { keywords: ['ziek', 'corona', 'griep', 'thuis'], icon: '🤒' },
  { keywords: ['vergader', 'meeting', 'overleg', 'bespreking', 'agenda'], icon: '📅' },
  { keywords: ['training', 'cursus', 'opleiding', 'workshop', 'studie'], icon: '🎓' },
  { keywords: ['email', 'mail', 'inbox'], icon: '📧' },
  { keywords: ['kantoor', 'pand', 'gebouw', 'verhuizing', 'verhuizen'], icon: '🏢' },
  { keywords: ['printer', 'print'], icon: '🖨️' },
  { keywords: ['it ', 'computer', 'laptop', 'wifi', 'internet', 'systeem', 'storing'], icon: '💻' },
  { keywords: ['wet', 'recht', 'rechtspraak', 'wetgeving', 'arrest', 'uitspraak', 'jurisprudentie'], icon: '⚖️' },
  { keywords: ['cliënt', 'client', 'klant'], icon: '🤝' },
  { keywords: ['zaak', 'dossier', 'casus', 'matter'], icon: '📁' },
  { keywords: ['factuur', 'declaratie', 'declareren', 'factureren', 'facturatie'], icon: '🧾' },
  { keywords: ['euro', 'omzet', 'budget', 'financiën', 'geld', 'bonus', 'salaris'], icon: '💶' },
  { keywords: ['bedankt', 'dank', 'thanks', 'top'], icon: '🙏' },
  { keywords: ['herinnering', 'reminder', 'vergeet', 'denk eraan', 'denk er aan'], icon: '⏰' },
  { keywords: ['sluiten', 'gesloten', 'dicht', 'closing', 'afsluiten'], icon: '🔒' },
  { keywords: ['nieuw', 'nieuws', 'welkom', 'introduce', 'starter'], icon: '👋' },
  { keywords: ['cadeau', 'gift', 'verras'], icon: '🎁' },
  { keywords: ['bloem'], icon: '💐' },
  { keywords: ['document', 'contract', 'overeenkomst', 'akte'], icon: '📄' },
  { keywords: ['telefoon', 'bellen', 'gebeld'], icon: '📞' },
  { keywords: ['auto', 'parkeer', 'parkeren'], icon: '🚗' },
  { keywords: ['fiets'], icon: '🚲' },
  { keywords: ['trein', 'ns', 'reis'], icon: '🚆' },
  { keywords: ['weer', 'regen', 'sneeuw', 'storm'], icon: '🌧️' },
  { keywords: ['zon', 'mooi weer'], icon: '☀️' },
]

export function getAnnouncementIcon(message: string, priority?: string): string {
  const lower = (message || '').toLowerCase()
  for (const rule of ICON_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return rule.icon
    }
  }
  return priority === 'urgent' ? '🚨' : '📢'
}
