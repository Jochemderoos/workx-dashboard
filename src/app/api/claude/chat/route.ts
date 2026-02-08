import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { conversationId, projectId, message, documentIds } = await req.json()

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Bericht mag niet leeg zijn' }, { status: 400 })
  }

  const userId = session.user.id

  try {
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
          documentContext += `\n\n--- Document: ${doc.name} ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    if (projectId) {
      const projectDocs = await prisma.aIDocument.findMany({
        where: { projectId, userId },
      })
      for (const doc of projectDocs) {
        if (doc.content && !documentIds?.includes(doc.id)) {
          documentContext += `\n\n--- ${doc.name} ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
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
    if (sourcesContext) {
      systemPrompt += `\n\n## Kennisbronnen${sourcesContext}`
    }
    if (documentContext) {
      systemPrompt += `\n\n## Documenten${documentContext}`
    }

    // Build messages
    const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
    for (const msg of history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        msgs.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Call Claude (non-streaming for reliability)
    const client = new Anthropic({ apiKey })
    console.log(`[chat] Prompt: ${systemPrompt.length} chars, ${msgs.length} messages`)

    let response
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: msgs,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 2,
          },
        ],
      }, {
        timeout: 50000, // 50s timeout — leave 10s buffer for Vercel's 60s limit
      })
    } catch (apiErr) {
      const msg = apiErr instanceof Error ? apiErr.message : String(apiErr)
      console.error('[chat] Claude API error:', msg)
      if (msg.includes('timeout') || msg.includes('abort')) {
        return NextResponse.json({
          error: 'Claude had meer tijd nodig dan verwacht. Probeer een kortere of eenvoudigere vraag.',
        }, { status: 504 })
      }
      if (msg.includes('rate_limit') || msg.includes('429')) {
        return NextResponse.json({
          error: 'Even rustig aan — te veel verzoeken tegelijk. Wacht een minuut en probeer het opnieuw.',
        }, { status: 429 })
      }
      if (msg.includes('overloaded') || msg.includes('529')) {
        return NextResponse.json({
          error: 'Claude is momenteel overbelast. Probeer het over een paar seconden opnieuw.',
        }, { status: 503 })
      }
      throw apiErr
    }

    // Extract text and citations from response
    let fullText = ''
    let hasWebSearch = false
    const citations: Array<{ url: string; title: string }> = []

    for (const block of response.content) {
      if (block.type === 'text') {
        fullText += block.text
        // Check for citations in the block
        if ('citations' in block && Array.isArray((block as { citations?: unknown[] }).citations)) {
          for (const cite of (block as { citations: Array<{ type: string; url?: string; title?: string }> }).citations) {
            if (cite.url && !citations.some(c => c.url === cite.url)) {
              citations.push({ url: cite.url, title: cite.title || '' })
            }
          }
        }
      }
      const blockType = (block as { type: string }).type
      if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
        hasWebSearch = true
      }
    }

    // Save assistant message
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

    return NextResponse.json({
      conversationId: convId,
      content: fullText,
      hasWebSearch,
      citations,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('[chat] Error:', errMsg)
    return NextResponse.json({ error: errMsg.slice(0, 500) }, { status: 500 })
  }
}
