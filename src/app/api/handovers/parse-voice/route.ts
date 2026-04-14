import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { transcript, teamMembers } = await req.json()
  if (!transcript) return NextResponse.json({ error: 'Geen transcript' }, { status: 400 })

  const client = new Anthropic()

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Je bent een assistent voor een advocatenkantoor. Structureer de volgende ingesproken tekst in overdracht-cases (dossiers).

Beschikbare teamleden als waarnemer: ${teamMembers.join(', ')}

Ingesproken tekst:
"${transcript}"

Geef het resultaat als JSON array met objecten:
[
  {
    "dossiernaam": "korte naam van de zaak",
    "contactpersoon": "naam contactpersoon of null",
    "beschrijving": "wat er moet gebeuren / status",
    "waarnemers": "Voornaam Achternaam" (komma-gescheiden als meerdere, moet exact matchen met beschikbare teamleden)
  }
]

Regels:
- Gebruik de exacte namen uit de teamleden-lijst voor waarnemers
- Als geen waarnemer genoemd, laat waarnemers leeg
- Beschrijving moet beknopt maar volledig zijn
- Dossiernaam moet een herkenbare korte naam zijn
- Geef ALLEEN de JSON array terug, geen andere tekst`
    }]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // Extract JSON from response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const cases = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    return NextResponse.json({ cases })
  } catch {
    return NextResponse.json({ error: 'Kon transcript niet verwerken', raw: text }, { status: 500 })
  }
}
