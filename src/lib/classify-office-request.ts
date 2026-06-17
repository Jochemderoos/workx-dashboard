// Classificeer een Office-verzoek in een van de bestaande categorieën via
// Claude Haiku. Snel (~500ms) en goedkoop (~$0,0005/req). Faalt stil →
// returnt 'Overig' (of null als die niet bestaat).

import Anthropic from '@anthropic-ai/sdk'

export async function classifyOfficeRequest(
  title: string,
  description: string | null,
  categoryNames: string[],
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (categoryNames.length === 0) return null

  const fallback = categoryNames.includes('Overig') ? 'Overig' : categoryNames[categoryNames.length - 1]
  const text = [title, description].filter(Boolean).join(' — ').slice(0, 800)

  const system = [
    'Je classificeert verzoeken aan het Office-team van een advocatenkantoor.',
    `Beschikbare categorieën: ${categoryNames.join(', ')}.`,
    'Antwoord met ALLEEN de naam van de meest passende categorie (exact zoals gegeven). Geen toelichting, geen quotes, geen punctuation.',
    `Bij twijfel: ${fallback}.`,
  ].join(' ')

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      system,
      messages: [{ role: 'user', content: `Verzoek: ${text}` }],
    })
    const out = resp.content
      .filter(c => c.type === 'text')
      .map(c => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
    // Match op exacte naam (case-insensitive)
    const match = categoryNames.find(n => n.toLowerCase() === out.toLowerCase())
    return match || fallback
  } catch (err) {
    console.error('classifyOfficeRequest failed', err)
    return fallback
  }
}
