import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const maxDuration = 120

/**
 * End-to-end chat test endpoint.
 *
 * Tests the full chat pipeline:
 * 1. Sends a simple message to /api/claude/chat
 * 2. Reads the SSE stream for response
 * 3. Falls back to DB polling if stream doesn't deliver
 * 4. Returns test results with timing
 *
 * Usage: GET /api/claude/test-chat
 * Optional: ?projectId=xxx to test with a specific project's documents
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('projectId')
  const testMessage = searchParams.get('message') || 'Wat is de opzegtermijn bij een arbeidsovereenkomst voor onbepaalde tijd?'

  const startTime = Date.now()
  const log: string[] = []
  const addLog = (msg: string) => {
    log.push(`[${((Date.now() - startTime) / 1000).toFixed(1)}s] ${msg}`)
  }

  addLog('Test gestart')

  try {
    // Step 1: Send chat request
    addLog(`Bericht versturen: "${testMessage.slice(0, 50)}..."`)
    const chatResponse = await fetch(new URL('/api/claude/chat', req.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        message: testMessage,
        projectId: projectId || undefined,
        model: 'sonnet',
        useKnowledgeSources: false,
      }),
    })

    if (!chatResponse.ok) {
      const errText = await chatResponse.text()
      addLog(`Chat request mislukt: ${chatResponse.status} — ${errText.slice(0, 200)}`)
      return NextResponse.json({ success: false, error: `Chat request failed: ${chatResponse.status}`, log })
    }

    const convId = chatResponse.headers.get('X-Conversation-Id')
    addLog(`Stream gestart. Conversation ID: ${convId}`)

    if (!chatResponse.body) {
      addLog('Geen response body')
      return NextResponse.json({ success: false, error: 'No response body', log })
    }

    // Step 2: Read the SSE stream
    const reader = chatResponse.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let streamedText = ''
    let finished = false
    let eventTypes: string[] = []

    // Hard timeout for stream reading: 15 seconds
    const streamTimeout = setTimeout(() => {
      if (!finished && !streamedText) {
        addLog('Stream timeout na 15s — schakel over naar polling')
        try { reader.cancel() } catch { /* ignore */ }
      }
    }, 15000)

    try {
      while (true) {
        let done = false, value: Uint8Array | undefined
        try {
          const result = await reader.read()
          done = result.done
          value = result.value
        } catch { break }
        if (done || finished) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            eventTypes.push(event.type)
            if (event.type === 'delta' && event.text) {
              streamedText += event.text
            } else if (event.type === 'done') {
              finished = true
              addLog(`Stream klaar! ${streamedText.length} chars ontvangen via stream`)
            } else if (event.type === 'error') {
              addLog(`Stream error: ${event.error}`)
              finished = true
            }
          } catch { /* parse error */ }
        }
        if (finished) break
      }
    } catch {
      addLog('Stream leesfout')
    }
    clearTimeout(streamTimeout)

    addLog(`Stream events ontvangen: ${eventTypes.join(', ')}`)

    // Step 3: If no streamed content, poll DB
    if (!finished && !streamedText && convId) {
      addLog('Geen stream inhoud — start DB polling...')
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const pollResp = await fetch(new URL(`/api/claude/conversations/${convId}`, req.url).toString(), {
            headers: { 'Cookie': req.headers.get('cookie') || '' },
          })
          if (!pollResp.ok) continue
          const data = await pollResp.json()
          const msgs = data.messages || []
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === 'assistant' && lastMsg.content?.length > 10) {
            streamedText = lastMsg.content
            finished = true
            addLog(`Antwoord gevonden via polling na ${(attempt + 1) * 2}s (${streamedText.length} chars)`)
            break
          }
          addLog(`Poll ${attempt}: ${msgs.length} berichten, laatste rol: ${lastMsg?.role || 'geen'}`)
        } catch { /* ignore */ }
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

    if (finished && streamedText.length > 10) {
      addLog(`Test GESLAAGD in ${totalTime}s`)
      return NextResponse.json({
        success: true,
        totalTimeSeconds: parseFloat(totalTime),
        responseLength: streamedText.length,
        responsePreview: streamedText.slice(0, 300),
        conversationId: convId,
        streamEvents: eventTypes,
        log,
      })
    } else {
      addLog(`Test MISLUKT na ${totalTime}s — geen antwoord ontvangen`)
      return NextResponse.json({
        success: false,
        totalTimeSeconds: parseFloat(totalTime),
        responseLength: streamedText.length,
        conversationId: convId,
        streamEvents: eventTypes,
        error: 'Geen antwoord ontvangen binnen timeout',
        log,
      })
    }
  } catch (err) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
    addLog(`Test fout na ${totalTime}s: ${err instanceof Error ? err.message : 'Onbekende fout'}`)
    return NextResponse.json({
      success: false,
      totalTimeSeconds: parseFloat(totalTime),
      error: err instanceof Error ? err.message : 'Onbekende fout',
      log,
    })
  }
}
