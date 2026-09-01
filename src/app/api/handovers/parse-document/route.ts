import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import { htmlNaarTekst } from '@/lib/docx-tekst'

// Word/Excel is groot genoeg voor een overdracht; hierboven is het vrijwel
// zeker geen overdrachtsdocument meer.
const MAX_BYTES = 8 * 1024 * 1024

// Voorkomt dat een enorm document het model-venster vult; een overdracht van
// deze lengte is in de praktijk al ruim.
const MAX_TEKENS = 60_000

export const runtime = 'nodejs'
// Een overdrachtsdocument kan tientallen dossiers bevatten; die omzetten duurt
// langer dan de standaard-limiet van een serverless functie.
export const maxDuration = 300

/** Haalt platte tekst uit een Word-, Excel- of tekstbestand. */
async function leesDocument(bestandsnaam: string, buffer: Buffer): Promise<string> {
  const naam = bestandsnaam.toLowerCase()

  if (naam.endsWith('.docx')) {
    // Via HTML in plaats van extractRawText: overdrachten staan meestal in een
    // tabel, en extractRawText gooit de kolomindeling weg. Zie docx-tekst.ts.
    const { value } = await mammoth.convertToHtml({ buffer })
    return htmlNaarTekst(value)
  }

  if (naam.endsWith('.doc')) {
    // Het oude binaire Word-formaat; mammoth leest alleen .docx.
    throw new Error(
      'Dit is een oud .doc-bestand. Open het in Word en kies "Opslaan als" → .docx, dan lukt het wel.'
    )
  }

  if (naam.endsWith('.xlsx') || naam.endsWith('.xls') || naam.endsWith('.csv')) {
    const werkboek = XLSX.read(buffer, { type: 'buffer' })
    // Elk tabblad als CSV; kolomkoppen blijven zo staan, wat het model helpt
    // te zien welke kolom het dossier is en welke de waarnemer.
    return werkboek.SheetNames
      .map(naam => {
        const blad = werkboek.Sheets[naam]
        return `--- Tabblad: ${naam} ---\n${XLSX.utils.sheet_to_csv(blad)}`
      })
      .join('\n\n')
  }

  if (naam.endsWith('.txt') || naam.endsWith('.md')) {
    return buffer.toString('utf8')
  }

  throw new Error('Alleen Word (.docx), Excel (.xlsx, .xls), CSV of tekst worden ondersteund.')
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

    const formData = await req.formData()
    const bestand = formData.get('file')
    const teamLedenRuw = formData.get('teamMembers')

    if (!bestand || typeof bestand === 'string') {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }
    if (bestand.size === 0) {
      return NextResponse.json({ error: 'Het bestand is leeg' }, { status: 400 })
    }
    if (bestand.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Bestand is te groot (maximaal 8 MB)' }, { status: 400 })
    }

    const teamLeden: string[] = teamLedenRuw && typeof teamLedenRuw === 'string'
      ? JSON.parse(teamLedenRuw)
      : []

    const buffer = Buffer.from(await bestand.arrayBuffer())

    let tekst: string
    try {
      tekst = await leesDocument(bestand.name, buffer)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Kon het bestand niet lezen' }, { status: 400 })
    }

    tekst = tekst.trim()
    if (!tekst) {
      return NextResponse.json(
        { error: 'Er staat geen leesbare tekst in dit bestand' },
        { status: 400 }
      )
    }
    const afgekapt = tekst.length > MAX_TEKENS
    if (afgekapt) tekst = tekst.slice(0, MAX_TEKENS)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Streamen omdat een overdracht met tientallen dossiers een lang antwoord
    // oplevert; zonder streamen loopt de HTTP-verbinding het risico te
    // verlopen voordat het antwoord compleet is.
    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 32000,
      messages: [{
        role: 'user',
        content: `Je bent een assistent voor een advocatenkantoor. Hieronder staat een overdrachtsdocument (uit Word of Excel) waarin een advocaat zijn of haar dossiers overdraagt aan collega's tijdens afwezigheid. Zet dit om in gestructureerde overdracht-cases.

Beschikbare teamleden als waarnemer: ${teamLeden.join(', ')}

Document:
"""
${tekst}
"""

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
- Neem ALLEEN informatie over die daadwerkelijk in het document staat. Verzin niets: geen dossiers, geen namen, geen data, geen bedragen.
- Gebruik de exacte namen uit de teamleden-lijst voor waarnemers. Staat er een naam in het document die niet in de lijst voorkomt, laat waarnemers dan leeg.
- Als er geen waarnemer bij een dossier genoemd wordt, laat waarnemers leeg.
- Kopregels, inleidende tekst en lege rijen zijn geen dossier — sla die over.
- Beschrijving beknopt maar volledig, in het Nederlands.
- Geef ALLEEN de JSON array terug, geen andere tekst.`
      }]
    })

    const response = await stream.finalMessage()
    const text = response.content.find(b => b.type === 'text')
    const antwoord = text && text.type === 'text' ? text.text : ''

    const jsonMatch = antwoord.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('parse-document: geen JSON in response:', antwoord.slice(0, 500))
      return NextResponse.json({ error: 'Kon geen dossiers herkennen in dit document' }, { status: 422 })
    }

    let cases: unknown
    try {
      cases = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'Kon geen dossiers herkennen in dit document' }, { status: 422 })
    }

    return NextResponse.json({ cases, afgekapt })
  } catch (error: any) {
    console.error('parse-document error:', error?.message || error)
    return NextResponse.json({ error: `Fout: ${error?.message || 'onbekend'}` }, { status: 500 })
  }
}
