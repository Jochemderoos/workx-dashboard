import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const SYSTEM_PROMPT = `Je bent de AI-assistent van Workx Advocaten, een gespecialiseerd arbeidsrechtadvocatenkantoor in Amsterdam.

## Kernregels
- Antwoord altijd in het Nederlands, tenzij expliciet anders gevraagd
- Bij juridische vragen: vermeld ALTIJD dat je antwoord geen juridisch advies is maar een informatieve analyse
- Verwijs naar relevante Nederlandse wetgeving met exacte artikelnummers (Boek 7 BW, Rv, WW, WAZO, etc.)
- Structureer lange antwoorden met kopjes en opsommingen
- Wees precies met citaten en bronvermeldingen

## Juridische bronnen
Bij het zoeken naar juridische informatie, gebruik bij voorkeur:
- **rechtspraak.nl** — voor recente uitspraken, vermeld altijd het ECLI-nummer
- **wetten.overheid.nl** — voor actuele wetteksten en parlementaire geschiedenis
- **uitspraken.rechtspraak.nl** — voor specifieke ECLI-uitspraken
- **kantonrechter.nl** — voor arbeidsrechtzaken
- **uwv.nl** — voor UWV-procedures en regelgeving
- **rijksoverheid.nl** — voor wet- en regelgeving arbeidsrecht

## Arbeidsrecht expertise
Workx Advocaten is gespecialiseerd in:
- Ontslagrecht (ontbinding kantonrechter, UWV, vaststellingsovereenkomsten)
- Arbeidsovereenkomstenrecht (contracten, bedingen, wijziging arbeidsvoorwaarden)
- Transitievergoeding en billijke vergoeding
- Concurrentie- en relatiebedingen
- Ziekte en re-integratie (Wet Verbetering Poortwachter, WIA)
- Collectief arbeidsrecht (CAO, OR, reorganisatie)
- Medezeggenschap

## Document analyse
Als documenten zijn bijgevoegd:
- Analyseer deze grondig en verwijs naar specifieke passages/clausules
- Identificeer ontbrekende bepalingen of risico's
- Vergelijk met gangbare praktijk en toepasselijke wetgeving
- Geef concrete aanbevelingen voor verbetering

## Berekeningen
Bij berekeningen (transitievergoeding, opzegtermijnen, verjaringstermijnen):
- Toon altijd de rekenmethode stap voor stap
- Vermeld het toepasselijke wetsartikel
- Geef aan welke aannames je hebt gemaakt`

// Allow up to 60 seconds for streaming responses (Vercel Pro)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: 'Niet geautoriseerd' }), { status: 401 })
  }

  const { conversationId, projectId, message, documentIds } = await req.json()

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: 'Bericht mag niet leeg zijn' }), { status: 400 })
  }

  const userId = session.user.id

  // Create or get conversation
  let convId = conversationId
  if (!convId) {
    const conversation = await prisma.aIConversation.create({
      data: {
        userId,
        projectId: projectId || null,
        title: message.slice(0, 80),
      },
    })
    convId = conversation.id
  }

  // Save user message
  await prisma.aIMessage.create({
    data: {
      conversationId: convId,
      role: 'user',
      content: message,
    },
  })

  // Get conversation history (last 30 messages)
  const history = await prisma.aIMessage.findMany({
    where: { conversationId: convId },
    orderBy: { createdAt: 'asc' },
    take: 30,
  })

  // Build context from documents
  let documentContext = ''
  if (documentIds?.length) {
    const docs = await prisma.aIDocument.findMany({
      where: { id: { in: documentIds }, userId },
    })
    for (const doc of docs) {
      if (doc.content) {
        documentContext += `\n\n--- Document: ${doc.name} ---\n${doc.content}\n--- Einde document ---`
      }
    }
  }

  // If project, also include project documents as context
  if (projectId) {
    const projectDocs = await prisma.aIDocument.findMany({
      where: { projectId, userId },
    })
    for (const doc of projectDocs) {
      if (doc.content && !documentIds?.includes(doc.id)) {
        documentContext += `\n\n--- Project document: ${doc.name} ---\n${doc.content}\n--- Einde document ---`
      }
    }
  }

  // Fetch active knowledge sources (Bronnen Manager)
  // Cap total to prevent exceeding token limits
  let sourcesContext = ''
  const MAX_SOURCES_TOTAL = 30000
  try {
    const activeSources = await prisma.aISource.findMany({
      where: { userId, isActive: true },
      select: {
        name: true,
        type: true,
        category: true,
        content: true,
        summary: true,
        isProcessed: true,
        description: true,
      },
    })
    let sourcesLength = 0
    for (const source of activeSources) {
      const knowledge = source.isProcessed && source.summary
        ? source.summary
        : source.content

      if (knowledge) {
        const label = source.isProcessed ? 'Verwerkte kennisbron' : 'Kennisbron (onverwerkt)'
        const maxPerSource = source.isProcessed ? 10000 : 5000
        const trimmedKnowledge = knowledge.slice(0, maxPerSource)
        if (sourcesLength + trimmedKnowledge.length > MAX_SOURCES_TOTAL) break
        sourcesLength += trimmedKnowledge.length
        sourcesContext += `\n\n--- ${label}: ${source.name} (${source.category}) ---\n${trimmedKnowledge}\n--- Einde bron ---`
      }
    }
  } catch {
    // Sources not available yet (table may not exist)
  }

  // Fetch Workx templates (only metadata, not full content — too large for chat context)
  let templatesContext = ''
  const MAX_TEMPLATES_TOTAL = 5000
  try {
    const templates = await prisma.aITemplate.findMany({
      where: { userId, isActive: true },
      select: {
        name: true,
        category: true,
        description: true,
        placeholders: true,
        instructions: true,
      },
    })
    let templatesLength = 0
    for (const template of templates) {
      let entry = `\n- **${template.name}** (${template.category})`
      if (template.description) entry += `: ${template.description}`
      if (template.placeholders) {
        try {
          const fields = JSON.parse(template.placeholders)
          if (fields.length > 0) entry += ` — Velden: ${fields.join(', ')}`
        } catch { /* skip */ }
      }
      if (templatesLength + entry.length > MAX_TEMPLATES_TOTAL) break
      templatesLength += entry.length
      templatesContext += entry
    }
  } catch {
    // Templates not available yet
  }

  let systemPrompt = SYSTEM_PROMPT
  if (sourcesContext) {
    systemPrompt += `\n\n## Beschikbare kennisbronnen\nDe volgende juridische bronnen zijn beschikbaar als referentiemateriaal. Gebruik deze kennis bij het beantwoorden van vragen over Nederlands arbeidsrecht:${sourcesContext}`
  }
  if (templatesContext) {
    systemPrompt += `\n\n## Beschikbare Templates\nDe volgende kantoorsjablonen zijn beschikbaar (gebruik de Templates tab om ze in te vullen):${templatesContext}`
  }
  if (documentContext) {
    systemPrompt += `\n\n## Bijgevoegde documenten\nDe volgende documenten zijn beschikbaar als context voor dit gesprek:${documentContext}`
  }

  // Build messages for Claude
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of history) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
    }
  }

  // Stream response via SSE
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
      }

      send('conversation_id', convId)

      try {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          console.error('ANTHROPIC_API_KEY is not set')
          send('error', 'API key niet geconfigureerd. Stel ANTHROPIC_API_KEY in op Vercel.')
          controller.close()
          return
        }

        const client = new Anthropic({ apiKey })

        let fullResponse = ''
        let hasWebSearch = false
        const citations: string[] = []

        console.log(`[chat] System prompt: ${systemPrompt.length} chars, Messages: ${messages.length}`)

        const response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8096,
          system: systemPrompt,
          messages,
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 5,
            },
          ],
          stream: true,
        })

        for await (const event of response) {
          if (event.type === 'content_block_start') {
            const blockType = (event.content_block as { type: string }).type
            if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
              hasWebSearch = true
              send('web_search_start', 'Zoeken op het web...')
            }
          }

          if (event.type === 'content_block_delta') {
            const deltaType = (event.delta as { type: string }).type
            if (deltaType === 'text_delta') {
              const textDelta = event.delta as { type: string; text: string }
              fullResponse += textDelta.text
              send('text', textDelta.text)
            }
            if (deltaType === 'citations_delta') {
              const citationDelta = event.delta as { type: string; citation?: { type?: string; url?: string; title?: string } }
              const citation = citationDelta.citation
              if (citation && citation.url) {
                const citationStr = JSON.stringify({ url: citation.url, title: citation.title || '' })
                if (!citations.includes(citationStr)) {
                  citations.push(citationStr)
                  send('citation', citationStr)
                }
              }
            }
          }
        }

        // Save assistant message
        await prisma.aIMessage.create({
          data: {
            conversationId: convId,
            role: 'assistant',
            content: fullResponse,
            hasWebSearch,
            citations: citations.length > 0 ? JSON.stringify(citations.map(c => JSON.parse(c))) : null,
          },
        })

        // Update conversation title if it's the first exchange
        if (history.length <= 1) {
          const titleSummary = message.slice(0, 80) + (message.length > 80 ? '...' : '')
          await prisma.aIConversation.update({
            where: { id: convId },
            data: { title: titleSummary },
          })
        }

        send('done', '')
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error('Claude chat error:', errMsg, error)
        send('error', `Fout: ${errMsg.slice(0, 200)}`)
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
