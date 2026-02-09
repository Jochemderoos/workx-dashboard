import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { anonymizeText } from '@/lib/anonymize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

// GET: load messages for an existing conversation
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is verplicht' }, { status: 400 })
  }

  // Verify user owns or is member of the conversation's project
  const conversation = await prisma.aIConversation.findFirst({
    where: {
      id: conversationId,
      OR: [
        { userId: session.user.id },
        { project: { members: { some: { userId: session.user.id } } } },
      ],
    },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Gesprek niet gevonden' }, { status: 404 })
  }

  const messages = await prisma.aIMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      content: true,
      hasWebSearch: true,
      citations: true,
      createdAt: true,
    },
  })

  // Parse citations from JSON string (with safe parsing)
  const parsed = messages.map(m => {
    let parsedCitations = null
    if (m.citations) {
      try { parsedCitations = JSON.parse(m.citations as string) } catch { /* ignore malformed */ }
    }
    return { ...m, citations: parsedCitations }
  })

  return NextResponse.json({ messages: parsed })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { conversationId, projectId, message, documentIds, anonymize } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Bericht mag niet leeg zijn' }, { status: 400 })
  }

  const userId = session.user.id

  try {
    // Verify projectId access if provided
    if (projectId) {
      const projectAccess = await prisma.aIProject.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId },
            { members: { some: { userId } } },
          ],
        },
      })
      if (!projectAccess) {
        return NextResponse.json({ error: 'Geen toegang tot dit project' }, { status: 403 })
      }
    }

    // Create or get conversation (with ownership check)
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
    } else {
      // H2 fix: verify user owns or is member of the conversation
      const convAccess = await prisma.aIConversation.findFirst({
        where: {
          id: convId,
          OR: [
            { userId },
            { project: { members: { some: { userId } } } },
          ],
        },
      })
      if (!convAccess) {
        return NextResponse.json({ error: 'Geen toegang tot dit gesprek' }, { status: 403 })
      }
    }

    // Save user message (always store ORIGINAL, unanonymized content)
    await prisma.aIMessage.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: message,
      },
    })

    // Get conversation history (last 30 messages — fetch newest, then reverse)
    const historyDesc = await prisma.aIMessage.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    const history = historyDesc.reverse()

    // Build context from documents
    let documentContext = ''
    if (documentIds?.length) {
      // Allow documents the user owns OR that belong to a shared project
      const docs = await prisma.aIDocument.findMany({
        where: {
          id: { in: documentIds },
          OR: [
            { userId },
            { project: { members: { some: { userId } } } },
          ],
        },
      })
      for (const doc of docs) {
        if (doc.content) {
          documentContext += `\n\n--- Document: ${doc.name} ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    if (projectId) {
      // Include project documents (auth already verified above)
      // Limit total document context to 200K chars to avoid exceeding context window
      const projectDocs = await prisma.aIDocument.findMany({
        where: { projectId },
        take: 20,
      })
      for (const doc of projectDocs) {
        if (doc.content && !documentIds?.includes(doc.id)) {
          if (documentContext.length > 200000) break
          documentContext += `\n\n--- ${doc.name} ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    // Anonymize message and document context if requested
    let messageForClaude = message
    if (anonymize) {
      const anonMessage = anonymizeText(message)
      messageForClaude = anonMessage.text
      if (documentContext) {
        const anonDocs = anonymizeText(documentContext)
        documentContext = anonDocs.text
      }
    }

    // Fetch knowledge sources — only processed summaries
    let sourcesContext = ''
    try {
      const activeSources = await prisma.aISource.findMany({
        where: { userId, isActive: true, isProcessed: true },
        select: { name: true, category: true, summary: true },
      })
      let len = 0
      for (const source of activeSources) {
        if (source.summary) {
          const trimmed = source.summary.slice(0, 3000)
          if (len + trimmed.length > 6000) break
          len += trimmed.length
          sourcesContext += `\n\n--- ${source.name} ---\n${trimmed}`
        }
      }
    } catch { /* sources not available */ }

    // Build system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (anonymize) {
      systemPrompt += `\n\n## Privacy — Geanonimiseerde gegevens
BELANGRIJK: In dit gesprek zijn persoonsgegevens geanonimiseerd ter bescherming van de privacy.
Gebruik ALTIJD dezelfde placeholders ([Persoon-1], [Bedrijf-1], [BSN-1], etc.) in je antwoord.
Vraag NIET naar de echte namen of gegevens.`
    }
    if (sourcesContext) {
      systemPrompt += `\n\n## Kennisbronnen${sourcesContext}`
    }
    if (documentContext) {
      systemPrompt += `\n\n## Documenten${documentContext}`
    }

    // Build messages — use anonymized version of the LAST user message
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (let i = 0; i < history.length; i++) {
      const msg = history[i]
      if (msg.role === 'user' || msg.role === 'assistant') {
        // For the last user message, use anonymized version if applicable
        const isLastUserMsg = msg.role === 'user' && i === history.length - 1 && anonymize
        const content = isLastUserMsg ? messageForClaude : msg.content
        msgs.push({ role: msg.role as 'user' | 'assistant', content })
      }
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Only enable web search when user explicitly asks for it
    const lowerMsg = message.toLowerCase()
    const wantsSearch = /zoek|search|rechtspraak|ecli|uitspraak|actueel|recent|nieuws|jurisprudentie/.test(lowerMsg)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = wantsSearch ? [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 2,
    }] : []

    const client = new Anthropic({ apiKey, timeout: 55000 })
    console.log(`[chat] Streaming: ${systemPrompt.length} chars, ${msgs.length} messages, search=${wantsSearch}`)

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ''
        let hasWebSearch = false
        const citations: Array<{ url: string; title: string }> = []

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const streamParams: any = {
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 16000,
            system: systemPrompt,
            messages: msgs,
            thinking: {
              type: 'enabled',
              budget_tokens: 10000,
            },
            ...(tools.length > 0 ? { tools } : {}),
          }

          const anthropicStream = client.messages.stream(streamParams)

          // Send conversationId immediately
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', conversationId: convId })}\n\n`))

          // Stream thinking and text via raw stream events
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          anthropicStream.on('streamEvent' as any, (event: any) => {
            try {
              if (event.type === 'content_block_start') {
                if (event.content_block?.type === 'thinking') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                }
              }
              if (event.type === 'content_block_delta') {
                if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                }
              }
            } catch { /* ignore thinking stream errors */ }
          })

          anthropicStream.on('text', (text) => {
            fullText += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
          })

          // Listen for content blocks for web search detection
          anthropicStream.on('contentBlock', (block) => {
            const blockType = (block as { type: string }).type
            if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
              hasWebSearch = true
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
            }
          })

          // Wait for the full response
          const finalMessage = await anthropicStream.finalMessage()

          // Extract citations from the final message
          for (const block of finalMessage.content) {
            if (block.type === 'text' && 'citations' in block && Array.isArray((block as { citations?: unknown[] }).citations)) {
              for (const cite of (block as { citations: Array<{ type: string; url?: string; title?: string }> }).citations) {
                if (cite.url && !citations.some(c => c.url === cite.url)) {
                  citations.push({ url: cite.url, title: cite.title || '' })
                }
              }
            }
          }

          // Save assistant message to database
          await prisma.aIMessage.create({
            data: {
              conversationId: convId,
              role: 'assistant',
              content: fullText,
              hasWebSearch,
              citations: citations.length > 0 ? JSON.stringify(citations) : null,
            },
          })

          // Update conversation title
          if (history.length <= 1) {
            await prisma.aIConversation.update({
              where: { id: convId },
              data: { title: message.slice(0, 80) + (message.length > 80 ? '...' : '') },
            })
          }

          // Send final event with citations
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            hasWebSearch,
            citations,
          })}\n\n`))

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error('[chat] Stream error:', errMsg)

          let userError = errMsg.slice(0, 500)
          if (errMsg.includes('timeout') || errMsg.includes('abort')) {
            userError = 'Claude had meer tijd nodig dan verwacht. Probeer een kortere of eenvoudigere vraag.'
          } else if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
            userError = 'Even rustig aan — te veel verzoeken tegelijk. Wacht een minuut en probeer het opnieuw.'
          } else if (errMsg.includes('overloaded') || errMsg.includes('529')) {
            userError = 'Claude is momenteel overbelast. Probeer het over een paar seconden opnieuw.'
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: userError })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[chat] Error:', errMsg)
    return NextResponse.json({ error: 'Er is een interne fout opgetreden. Probeer het opnieuw.' }, { status: 500 })
  }
}
