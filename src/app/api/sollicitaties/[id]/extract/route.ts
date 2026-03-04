import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== 'PARTNER' && user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { text } = body

  if (!text?.trim()) {
    return NextResponse.json({ error: 'Geen tekst om te analyseren' }, { status: 400 })
  }

  try {
    const anthropic = new Anthropic()

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Analyseer het volgende CV/sollicitatiebrief en extraheer de kerngegevens. Geef je antwoord ALLEEN als JSON object (geen markdown, geen uitleg).

JSON structuur:
{
  "naam": "Volledige naam",
  "email": "email@voorbeeld.nl",
  "telefoon": "06-12345678",
  "geboortedatum": "DD-MM-YYYY of null",
  "adres": "Volledig adres of null",
  "opleiding": "Samenvatting van opleidingen",
  "ervaring": "Samenvatting van werkervaring",
  "vaardigheden": "Kommagescheiden vaardigheden",
  "talen": "Kommagescheiden talen",
  "huidigeWerkgever": "Naam werkgever of null",
  "huidigeFunctie": "Huidige functie of null",
  "samenvatting": "Korte profielsamenvatting (2-3 zinnen)"
}

CV/Brief tekst:
${text}`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Parse JSON from response
    let extracted
    try {
      // Try direct parse first
      extracted = JSON.parse(responseText)
    } catch {
      // Try to find JSON in the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({ error: 'Kon gegevens niet extraheren uit CV' }, { status: 500 })
      }
    }

    // Update applicant with extracted data
    const applicant = await prisma.applicant.update({
      where: { id },
      data: {
        ...(extracted.naam && { naam: extracted.naam }),
        ...(extracted.email && { email: extracted.email }),
        ...(extracted.telefoon && { telefoon: extracted.telefoon }),
        ...(extracted.geboortedatum && { geboortedatum: extracted.geboortedatum }),
        ...(extracted.adres && { adres: extracted.adres }),
        ...(extracted.opleiding && { opleiding: extracted.opleiding }),
        ...(extracted.ervaring && { ervaring: extracted.ervaring }),
        ...(extracted.vaardigheden && { vaardigheden: extracted.vaardigheden }),
        ...(extracted.talen && { talen: extracted.talen }),
        ...(extracted.huidigeWerkgever && { huidigeWerkgever: extracted.huidigeWerkgever }),
        ...(extracted.huidigeFunctie && { huidigeFunctie: extracted.huidigeFunctie }),
        ...(extracted.samenvatting && { cvSummary: extracted.samenvatting }),
      },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        interviews: { orderBy: { datum: 'desc' } },
      },
    })

    return NextResponse.json(applicant)
  } catch (err) {
    console.error('[extract] CV extraction failed:', err)
    return NextResponse.json({ error: 'CV extractie mislukt' }, { status: 500 })
  }
}
