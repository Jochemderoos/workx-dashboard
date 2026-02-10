import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'
import { anonymizeText } from '@/lib/anonymize'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM_PROMPT = `Je bent de AI-assistent van Workx Advocaten, een gespecialiseerd arbeidsrechtadvocatenkantoor in Amsterdam.

## Kernregels
- Antwoord altijd in het Nederlands, tenzij expliciet anders gevraagd
- Bij juridische vragen: vermeld ALTIJD dat je antwoord geen juridisch advies is maar een informatieve analyse
- Verwijs naar relevante Nederlandse wetgeving met exacte artikelnummers (Boek 7 BW, Rv, WW, WAZO, etc.)
- Wees precies met citaten en bronvermeldingen

## Opmaak en stijl
Schrijf als een professionele jurist. Gebruik deze opmaakregels:
- Gebruik genummerde paragrafen (1., 1.1, 1.2, 2., etc.) voor structuur, geen markdown-kopjes (geen # of ##)
- Gebruik GEEN **vetgedrukte woorden** in lopende zinnen. Alleen de paragraaftitel mag vet zijn.
- Gebruik GEEN markdown-tabellen met | tekens. Presenteer gegevens als genummerde opsommingen of als korte alinea's.
- Gebruik een zakelijke, bondige schrijfstijl zoals in een juridisch memo of adviesbrief
- Begin met een korte samenvatting of conclusie, gevolgd door de onderbouwing
- Verwijs naar wetsartikelen inline (bijv. "op grond van art. 7:669 lid 3 sub g BW")
- Eindig waar relevant met een concrete conclusie of aanbeveling

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
- Geef aan welke aannames je hebt gemaakt

## Proceskosten-calculator (2025 tarieven)
Gebruik deze tarieven wanneer de gebruiker vraagt om een proceskostenberekening:

**Griffierecht 2025:**
- Onvermogenden: €90
- Natuurlijke personen: €241 (vordering ≤€12.500), €649 (vordering >€12.500)
- Rechtspersonen: €688 (vordering ≤€12.500), €2.889 (vordering >€12.500)
- Hoger beroep: €361 (onvermogend), €862 (natuurlijk persoon), €6.077 (rechtspersoon)
- Kort geding: zelfde als dagvaarding
- Verzoekschrift arbeid (art. 7:685 BW): €90 (onvermogend), €241 (natuurlijk persoon), €688 (rechtspersoon)

**Salaris gemachtigde (liquidatietarief kantonrechter 2025):**
- Per punt: €200 (vordering ≤€12.500), €400 (vordering €12.500-€25.000), €500 (vordering €25.000-€100.000)
- Dagvaarding/verzoekschrift = 1 punt, conclusie/akte = 1 punt, zitting = 1 punt, repliek/dupliek = 0.5 punt

**Salaris advocaat (liquidatietarief rechtbank 2025):**
- Tarief II (onbepaald/€12.500-€60.000): €621/punt
- Tarief III (€60.000-€200.000): €1.086/punt
- Tarief IV (€200.000-€400.000): €1.552/punt

**Nakosten:** €178 (zonder betekening), €273 (met betekening)
**Explootkosten dagvaarding:** ca. €115-€130 (verschilt per deurwaarder)

Presenteer berekeningen altijd in een overzichtelijke genummerde opsomming (geen markdown-tabellen).

## Betrouwbaarheidsindicator
Sluit ELK antwoord af met een betrouwbaarheidsindicator op de LAATSTE regel in exact dit formaat:
%%CONFIDENCE:hoog%% of %%CONFIDENCE:gemiddeld%% of %%CONFIDENCE:laag%%
Regels:
- **hoog**: je antwoord is gebaseerd op duidelijke wettekst, vaste rechtspraak of eenduidige feiten
- **gemiddeld**: er is interpretatieruimte, tegenstrijdige rechtspraak, of je mist mogelijk relevante feiten
- **laag**: de vraag valt buiten je expertise, er zijn onvoldoende gegevens, of de juridische situatie is zeer onzeker
Voeg GEEN toelichting toe na de %%CONFIDENCE%% tag — die wordt automatisch verwerkt.`

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

  const { conversationId, projectId, message, documentIds, anonymize, model: requestedModel } = await req.json()

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

    // Build context from documents — use native PDF support when available
    let documentContext = ''
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentBlocks: any[] = []  // Native document blocks for Claude API
    let hasDocxAttachments = false

    if (documentIds?.length) {
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
        // Track DOCX attachments for edit instructions
        if (doc.fileType === 'docx') hasDocxAttachments = true
        // Prefer native PDF support: send base64 PDF directly to Claude
        if (doc.fileType === 'pdf' && doc.fileUrl?.startsWith('data:application/pdf;base64,')) {
          const base64Data = doc.fileUrl.split(',')[1]
          documentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            title: doc.name,
          })
        } else if (doc.content) {
          // Fallback for text files and docs without fileUrl — include document ID for DOCX editing
          documentContext += `\n\n--- Document: ${doc.name} (id: ${doc.id}) ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
        }
      }
    }

    if (projectId) {
      const projectDocs = await prisma.aIDocument.findMany({
        where: { projectId },
        take: 20,
      })
      for (const doc of projectDocs) {
        if (documentIds?.includes(doc.id)) continue
        if (doc.fileType === 'docx') hasDocxAttachments = true
        if (doc.fileType === 'pdf' && doc.fileUrl?.startsWith('data:application/pdf;base64,')) {
          if (documentBlocks.length >= 5) break  // Max 5 PDF attachments
          const base64Data = doc.fileUrl.split(',')[1]
          documentBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
            title: doc.name,
          })
        } else if (doc.content) {
          if (documentContext.length > 200000) break
          documentContext += `\n\n--- ${doc.name} (id: ${doc.id}) ---\n${doc.content.slice(0, 20000)}\n--- Einde ---`
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

    // Fetch knowledge sources — include all processed summaries
    let sourcesContext = ''
    const usedSourceNames: Array<{ name: string; category: string }> = []
    try {
      // Include all active sources (shared within the firm, not user-scoped)
      const activeSources = await prisma.aISource.findMany({
        where: { isActive: true, isProcessed: true },
        select: { name: true, category: true, summary: true },
      })
      let len = 0
      for (const source of activeSources) {
        if (source.summary) {
          const trimmed = source.summary.slice(0, 8000)
          if (len + trimmed.length > 50000) break
          len += trimmed.length
          sourcesContext += `\n\n--- ${source.name} (${source.category}) ---\n${trimmed}`
          usedSourceNames.push({ name: source.name, category: source.category })
        }
      }
    } catch { /* sources not available */ }

    // Fetch project context from previous conversations (chat memory)
    let projectMemory = ''
    if (projectId) {
      try {
        // Get summaries from other conversations in this project (excluding current)
        const otherConvs = await prisma.aIConversation.findMany({
          where: {
            projectId,
            ...(convId ? { id: { not: convId } } : {}),
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            title: true,
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 2, // Last exchange from each conversation
              select: { role: true, content: true },
            },
          },
        })
        for (const conv of otherConvs) {
          if (conv.messages.length > 0) {
            const lastMsg = conv.messages.find(m => m.role === 'assistant')
            if (lastMsg) {
              projectMemory += `\n\n### ${conv.title}\n${lastMsg.content.slice(0, 1000)}${lastMsg.content.length > 1000 ? '...' : ''}`
            }
          }
        }
      } catch { /* project memory not critical */ }
    }

    // Build system prompt
    let systemPrompt = SYSTEM_PROMPT
    if (projectMemory) {
      systemPrompt += `\n\n## Dossiergeheugen — Eerdere gesprekken in dit project\nHieronder staan samenvattingen van eerdere gesprekken in dit dossier. Gebruik deze context om consistent te antwoorden en niet te herhalen wat al besproken is.${projectMemory}`
    }
    if (anonymize) {
      systemPrompt += `\n\n## Privacy — Geanonimiseerde gegevens
BELANGRIJK: In dit gesprek zijn persoonsgegevens geanonimiseerd ter bescherming van de privacy.
Gebruik ALTIJD dezelfde placeholders ([Persoon-1], [Bedrijf-1], [BSN-1], etc.) in je antwoord.
Vraag NIET naar de echte namen of gegevens.`
    }
    if (sourcesContext) {
      systemPrompt += `\n\n## Kennisbronnen van Workx Advocaten
De volgende interne kennisbronnen zijn beschikbaar. Gebruik deze ACTIEF bij het beantwoorden van vragen:
- Verwijs naar relevante informatie uit deze bronnen waar toepasselijk
- Combineer interne kennis met externe bronnen (wetgeving, rechtspraak, web search)
- Vermeld welke kennisbron je hebt gebruikt in je antwoord${sourcesContext}`
    }
    if (documentContext) {
      systemPrompt += `\n\n## Documenten${documentContext}`
    }
    if (hasDocxAttachments) {
      systemPrompt += `\n\n## Word-document bewerking
Wanneer de gebruiker vraagt om wijzigingen in een bijgevoegd Word-document (DOCX), geef dan:
1. Een menselijke uitleg van de wijzigingen die je voorstelt
2. Een gestructureerd bewerkingsblok in EXACT dit formaat:

%%DOCX_EDITS%%
{
  "documentId": "<het document ID zoals vermeld bij het document hierboven>",
  "documentName": "<bestandsnaam>",
  "edits": [
    { "find": "<EXACTE originele tekst uit het document>", "replace": "<nieuwe tekst>" }
  ]
}
%%END_DOCX_EDITS%%

BELANGRIJK:
- De "find" tekst moet EXACT overeenkomen met tekst in het originele document, inclusief hoofdletters en leestekens
- Gebruik zo lang mogelijke fragmenten om uniek te matchen (minimaal een halve zin)
- Geef meerdere find/replace paren voor meerdere wijzigingen
- Zet het bewerkingsblok ALTIJD aan het einde van je antwoord, NA de uitleg
- Gebruik GEEN markdown-opmaak binnen het JSON-blok`
    }

    // Build messages — ensure alternating user/assistant roles (required by Claude API)
    // When a previous request failed, assistant messages may be missing, causing
    // consecutive user messages. We merge those to prevent API errors.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgs: Array<{ role: 'user' | 'assistant'; content: any }> = []
    for (let i = 0; i < history.length; i++) {
      const msg = history[i]
      if (msg.role !== 'user' && msg.role !== 'assistant') continue

      const isLastUserMsg = msg.role === 'user' && i === history.length - 1
      const content = (isLastUserMsg && anonymize) ? messageForClaude : msg.content

      // Merge consecutive user messages (can happen if previous assistant response failed)
      const prev = msgs[msgs.length - 1]
      if (prev && prev.role === msg.role && msg.role === 'user') {
        // Append to previous user message
        if (typeof prev.content === 'string') {
          prev.content = prev.content + '\n\n' + content
        }
        // If this merged msg is also the last one and has doc blocks, upgrade to multipart
        if (isLastUserMsg && documentBlocks.length > 0) {
          prev.content = [
            ...documentBlocks,
            { type: 'text', text: prev.content },
          ]
        }
        continue
      }

      // Attach PDF document blocks to the last user message
      if (isLastUserMsg && documentBlocks.length > 0) {
        msgs.push({
          role: 'user',
          content: [
            ...documentBlocks,
            { type: 'text', text: content },
          ],
        })
      } else {
        msgs.push({ role: msg.role as 'user' | 'assistant', content })
      }
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 })
    }

    // Web search always available — Claude decides when to search (like Claude.ai)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: any[] = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5,
    }]

    // Rechtspraak tools always available — direct API access to Dutch case law
    tools.push({
      name: 'search_rechtspraak',
      description: 'Doorzoek rechtspraak.nl voor Nederlandse rechterlijke uitspraken. Retourneert ECLI-nummers, samenvattingen en links naar uitspraken. Gebruik dit als de gebruiker vraagt naar jurisprudentie, uitspraken, of specifieke rechtszaken.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Zoektermen, bijv. "ontslag op staande voet billijke vergoeding"' },
          max: { type: 'number', description: 'Maximum aantal resultaten (1-20)', default: 5 },
        },
        required: ['query'],
      },
    })
    tools.push({
      name: 'get_rechtspraak_ruling',
      description: 'Haal de volledige tekst van een uitspraak op via het ECLI-nummer. Gebruik dit om een specifieke uitspraak in detail te lezen.',
      input_schema: {
        type: 'object',
        properties: {
          ecli: { type: 'string', description: 'ECLI-nummer, bijv. "ECLI:NL:HR:2023:1234"' },
        },
        required: ['ecli'],
      },
    })

    const client = new Anthropic({ apiKey, timeout: 120000 })
    console.log(`[chat] Streaming: ${systemPrompt.length} chars, ${msgs.length} messages, tools=${tools.length}`)

    // Stream the response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let fullText = ''
        let hasWebSearch = false
        const citations: Array<{ url: string; title: string }> = []

        try {
          // Model selection: default Sonnet, optionally Opus for deep analysis
          const modelId = requestedModel === 'opus' ? 'claude-opus-4-6' : 'claude-sonnet-4-5-20250929'
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const streamParams: any = {
            model: modelId,
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
          let finalMessage = await anthropicStream.finalMessage()

          // Extract citations from any response (web search results, etc.)
          const extractCitations = (message: typeof finalMessage) => {
            for (const block of message.content) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const b = block as any
              if (b.type === 'text' && Array.isArray(b.citations)) {
                for (const cite of b.citations) {
                  if (cite.url && !citations.some(c => c.url === cite.url)) {
                    citations.push({ url: cite.url, title: cite.title || '' })
                  }
                }
              }
            }
          }

          // Extract citations from initial response (important: web search citations live here)
          extractCitations(finalMessage)

          // Handle tool use: execute rechtspraak tools and continue (multi-round loop)
          let toolRound = 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let loopMsgs: Array<{ role: 'user' | 'assistant'; content: any }> = [...msgs]

          while (finalMessage.stop_reason === 'tool_use' && toolRound < 3) {
            toolRound++
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolUseBlocks = finalMessage.content.filter((b: any) => b.type === 'tool_use')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolResults: any[] = []

            for (const toolBlock of toolUseBlocks) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const tb = toolBlock as any
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: `Rechtspraak.nl doorzoeken... (${toolRound})` })}\n\n`))

              try {
                let resultText = ''
                // 15 second timeout for external API calls
                const fetchTimeout = AbortSignal.timeout(15000)

                if (tb.name === 'search_rechtspraak') {
                  const params = new URLSearchParams({ q: tb.input.query, max: String(tb.input.max || 5), return: 'DOC', sort: 'DESC' })
                  const searchRes = await fetch(`https://data.rechtspraak.nl/uitspraken/zoeken?${params}`, {
                    headers: { Accept: 'application/xml' },
                    signal: fetchTimeout,
                  })
                  if (!searchRes.ok) throw new Error(`Rechtspraak API error: ${searchRes.status}`)
                  resultText = (await searchRes.text()).slice(0, 15000)
                } else if (tb.name === 'get_rechtspraak_ruling') {
                  const contentRes = await fetch(`https://data.rechtspraak.nl/uitspraken/content?id=${encodeURIComponent(tb.input.ecli)}`, {
                    headers: { Accept: 'application/xml' },
                    signal: fetchTimeout,
                  })
                  if (!contentRes.ok) throw new Error(`Rechtspraak API error: ${contentRes.status}`)
                  resultText = (await contentRes.text()).slice(0, 30000)
                }
                toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: resultText || 'Geen resultaten gevonden' })
              } catch (toolErr) {
                const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool failed'
                console.error(`[chat] Tool ${tb.name} error:`, errMsg)
                toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: `Fout bij ophalen: ${errMsg}. Beantwoord de vraag op basis van je eigen kennis.`, is_error: true })
              }
            }

            // Continue conversation with tool results
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'Resultaten analyseren...' })}\n\n`))
            loopMsgs = [
              ...loopMsgs,
              { role: 'assistant' as const, content: finalMessage.content },
              { role: 'user' as const, content: toolResults },
            ]
            const continueStream = client.messages.stream({
              model: modelId,
              max_tokens: 16000,
              system: systemPrompt,
              messages: loopMsgs,
              thinking: { type: 'enabled' as const, budget_tokens: 10000 },
              tools,
            })

            // Stream thinking events for the continuation too
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            continueStream.on('streamEvent' as any, (event: any) => {
              try {
                if (event.type === 'content_block_start' && event.content_block?.type === 'thinking') {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking_start' })}\n\n`))
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'Claude analyseert resultaten...' })}\n\n`))
                }
                if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && event.delta.thinking) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'thinking', text: event.delta.thinking })}\n\n`))
                }
              } catch { /* ignore */ }
            })

            continueStream.on('text', (text) => {
              fullText += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`))
            })

            // Detect web search in continuation
            continueStream.on('contentBlock', (block) => {
              const blockType = (block as { type: string }).type
              if (blockType === 'web_search_tool_use' || blockType === 'server_tool_use') {
                hasWebSearch = true
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'status', text: 'AI Search...' })}\n\n`))
              }
            })

            finalMessage = await continueStream.finalMessage()
            extractCitations(finalMessage)
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

          // Send final event with citations and source names
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            hasWebSearch,
            citations,
            sources: usedSourceNames,
            model: modelId,
          })}\n\n`))

        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)
          console.error('[chat] Stream error:', errMsg)

          // Save partial response or error placeholder to keep history alternation intact
          // Without this, the next request would have consecutive user messages → API error
          try {
            const errorContent = fullText || `[Fout: ${errMsg.slice(0, 200)}]`
            await prisma.aIMessage.create({
              data: { conversationId: convId, role: 'assistant', content: errorContent },
            })
          } catch { /* DB save not critical here */ }

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
