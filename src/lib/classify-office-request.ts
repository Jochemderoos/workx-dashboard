// Classificeer een Office-verzoek in een van de bestaande categorieën via
// Claude Haiku. Snel (~500ms) en goedkoop (~$0,0005/req). Faalt stil →
// returnt 'Overig' (of null als die niet bestaat).

import Anthropic from '@anthropic-ai/sdk'

// Domein-context per default-categorie. Helpt Claude om 'e-mail'/'website'
// niet als Overig te markeren. Custom categorieën van Hanna krijgen geen
// hints maar worden gewoon doorgegeven.
const CATEGORY_HINTS: Record<string, string> = {
  IT: 'computer/laptop-problemen, software, accounts, e-mail (Outlook/Gmail/Workx-mail), wachtwoorden, VPN, Office 365, netwerk, BaseNet, Doxflow, telefoon/mobiel-tech',
  Website: 'workxadvocaten.nl, cookies, pagina toevoegen/wijzigen, contactformulier, blog, SEO, hosting, domein',
  Printen: 'printer, kopiëren, scannen, toner, papier, drukwerk extern, briefpapier, enveloppen',
  Marketing: 'LinkedIn, social media, advertenties, nieuwsbrief-mail extern, brochures, evenementen-promo',
  Catering: 'lunch, broodjes, koffie, thee, drinken, borrel, taart, diner, kantoor-eten',
  Kantoorbenodigdheden: 'pen, papier, notitieblok, agenda, postit, bestelling kantoorartikelen, meubels, kabels, batterijen',
  Overig: 'echt alleen als geen van de andere categorieën past',
}

function buildSystemPrompt(categoryNames: string[]): string {
  const lines = ['Je classificeert verzoeken aan het Office-team van een advocatenkantoor.']
  lines.push('')
  lines.push('Beschikbare categorieën met voorbeelden:')
  for (const name of categoryNames) {
    const hint = CATEGORY_HINTS[name]
    lines.push(`- ${name}${hint ? `: ${hint}` : ''}`)
  }
  lines.push('')
  lines.push('REGELS:')
  lines.push('1. Kies de SPECIFIEKE categorie die past. Vermijd "Overig" altijd als er ook maar één concrete categorie redelijk past.')
  lines.push('2. "E-mail" of "mail" valt onder IT (tenzij het over externe nieuwsbrief gaat, dan Marketing).')
  lines.push('3. "Website" valt onder Website.')
  lines.push('4. Print/printer/scannen valt onder Printen.')
  lines.push('5. Antwoord met ALLEEN de exacte categorienaam zoals hierboven. Geen quotes, geen punt, geen extra woorden.')
  return lines.join('\n')
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function classifyOfficeRequest(
  title: string,
  description: string | null,
  categoryNames: string[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[classify] ANTHROPIC_API_KEY ontbreekt — fallback')
    return null
  }
  if (categoryNames.length === 0) return null

  const fallback = categoryNames.includes('Overig') ? 'Overig' : categoryNames[categoryNames.length - 1]
  const text = [title, description].filter(Boolean).join(' — ').slice(0, 800)
  const system = buildSystemPrompt(categoryNames)

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      system,
      messages: [{ role: 'user', content: `Verzoek: ${text}` }],
    })
    const raw = resp.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      // Strip quotes, leading/trailing punctuation, eventuele afsluitende punt
      .replace(/^["'`]+|["'`.,;:!?]+$/g, '')
      .trim()

    console.log(`[classify] in="${text.slice(0, 80)}" → out="${raw}"`)

    // 1. Exacte match (case-insensitive)
    let match = categoryNames.find(n => n.toLowerCase() === raw.toLowerCase())
    // 2. Normalize-match (zonder spaties/diakrieten)
    if (!match) {
      const target = normalize(raw)
      match = categoryNames.find(n => normalize(n) === target)
    }
    // 3. AI noemt 'IT' als 'ICT' of vice versa — substring match
    if (!match) {
      const r = raw.toLowerCase()
      match = categoryNames.find(n => r.includes(n.toLowerCase()) || n.toLowerCase().includes(r))
    }

    return match || fallback
  } catch (err) {
    console.error('[classify] failed', err)
    return fallback
  }
}
