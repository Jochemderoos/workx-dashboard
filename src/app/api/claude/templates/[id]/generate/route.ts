import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Generate a filled-in template using Claude
 *
 * POST body: { prompt: string, data?: Record<string, string> }
 *
 * Claude receives the original template content + user instructions,
 * and generates a filled-in version while maintaining the document structure.
 */

const TEMPLATE_FILL_PROMPT = `Je bent een juridisch documentassistent voor Workx Advocaten (arbeidsrecht, Amsterdam).

Je taak is om een juridisch template in te vullen op basis van de gegevens die je krijgt.

## Regels
- Behoud de EXACTE structuur en opbouw van het originele template
- Vul alle invulvelden in met de verstrekte gegevens
- Als een gegeven ontbreekt, markeer het als [INVULLEN: omschrijving]
- Gebruik correcte juridische terminologie
- Houd rekening met geldende wet- en regelgeving
- Datums in het formaat "1 januari 2025"
- Bedragen in het formaat "€ 5.000,00 bruto" (met euroteken, komma voor decimalen)
- Schrijf in het Nederlands
- Bij een vaststellingsovereenkomst: check transitievergoeding-berekening
- Bij een dagvaarding: check termijnen en formele eisen
- Geef het ingevulde document terug als tekst, klaar om te kopiëren

## Formatting
Gebruik markdown voor structuur:
- # voor hoofdtitels
- ## voor subtitels
- **vet** voor partijnamen en bedragen
- Nummering voor artikelen (1., 2., etc.)
- Onderaan een kort notitieblok met eventuele aandachtspunten`

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { prompt, data } = await req.json()

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Instructies zijn verplicht' }, { status: 400 })
  }

  // Templates are shared within the firm — any authenticated user can generate
  const template = await prisma.aITemplate.findFirst({
    where: { id: params.id },
  })

  if (!template) {
    return NextResponse.json({ error: 'Template niet gevonden' }, { status: 404 })
  }

  if (!template.content) {
    return NextResponse.json({ error: 'Template heeft geen content' }, { status: 400 })
  }

  // Build the user message with template + instructions
  let userMessage = `## Template: ${template.name}\n\n`
  userMessage += `### Origineel template:\n\n${template.content.slice(0, 50000)}\n\n`

  if (template.instructions) {
    userMessage += `### Template-specifieke instructies:\n${template.instructions}\n\n`
  }

  if (data && Object.keys(data).length > 0) {
    userMessage += `### Gegevens om in te vullen:\n`
    for (const [key, value] of Object.entries(data)) {
      userMessage += `- **${key}**: ${value}\n`
    }
    userMessage += '\n'
  }

  userMessage += `### Gebruikersinstructies:\n${prompt}\n\n`
  userMessage += `Vul het template volledig in op basis van bovenstaande gegevens. Behoud de structuur en opbouw van het origineel.`

  // Stream response
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }

      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

        let fullResponse = ''

        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8096,
          system: TEMPLATE_FILL_PROMPT,
          messages: [{ role: 'user', content: userMessage }],
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_delta') {
            const deltaType = (event.delta as { type: string }).type
            if (deltaType === 'text_delta') {
              const textDelta = event.delta as { type: string; text: string }
              fullResponse += textDelta.text
              send('text', textDelta.text)
            }
          }
        }

        // Update usage count
        await prisma.aITemplate.update({
          where: { id: template.id },
          data: { usageCount: { increment: 1 } },
        })

        send('done', JSON.stringify({
          templateName: template.name,
          generatedLength: fullResponse.length,
        }))
      } catch (error) {
        console.error('Template generation error:', error)
        send('error', 'Fout bij het genereren van het document.')
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
