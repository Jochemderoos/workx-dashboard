import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Minimal test: send a PDF document block directly to Claude API.
 * No streaming, no complex logic — just a raw API call.
 *
 * GET /api/claude/test-pdf           → list your recent PDF documents
 * GET /api/claude/test-pdf?docId=xxx → test that specific document
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const docId = req.nextUrl.searchParams.get('docId')

  // No docId: list recent PDF documents so user can pick one
  if (!docId) {
    const docs = await prisma.aIDocument.findMany({
      where: { userId: session.user.id, fileType: 'pdf' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, fileType: true, fileSize: true, createdAt: true, content: true, fileUrl: true },
    })
    return NextResponse.json({
      message: 'Kies een document en open /api/claude/test-pdf?docId=ID',
      documents: docs.map(d => ({
        id: d.id,
        name: d.name,
        sizeMB: ((d.fileSize || 0) / (1024 * 1024)).toFixed(1),
        contentChars: d.content?.length ?? 0,
        hasBase64: !!d.fileUrl,
        testUrl: `/api/claude/test-pdf?docId=${d.id}`,
        createdAt: d.createdAt,
      })),
    })
  }

  const info: Record<string, unknown> = { docId }

  try {
    // Load document
    const doc = await prisma.aIDocument.findUnique({
      where: { id: docId },
      select: { id: true, name: true, fileType: true, fileSize: true, content: true, fileUrl: true },
    })
    if (!doc) return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })

    Object.assign(info, {
      name: doc.name,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      contentLength: doc.content?.length ?? 0,
      contentPreview: doc.content?.slice(0, 200) ?? null,
      hasFileUrl: !!doc.fileUrl,
      fileUrlPrefix: doc.fileUrl?.slice(0, 80) ?? null,
    })

    if (!doc.fileUrl) {
      return NextResponse.json({ ...info, error: 'Geen fileUrl in database — base64 data ontbreekt' })
    }

    // Extract base64
    const commaIdx = doc.fileUrl.indexOf(',')
    if (commaIdx === -1 || commaIdx > 100) {
      return NextResponse.json({ ...info, error: 'fileUrl is geen data URL (geen comma gevonden)' })
    }
    const rawBase64 = doc.fileUrl.slice(commaIdx + 1).replace(/[\s\r\n]/g, '')

    info.rawBase64Length = rawBase64.length
    info.rawBase64SizeMB = (rawBase64.length / (1024 * 1024)).toFixed(1)

    // Check for internal padding (corruption from chunked uploads)
    const internalPadding = (rawBase64.match(/=(?=[A-Za-z0-9+/])/g) || []).length
    info.internalPaddingChars = internalPadding
    info.hasCorruptedBase64 = internalPadding > 0

    // Re-encode through Buffer to fix corrupted base64 from chunked uploads
    const buffer = Buffer.from(rawBase64, 'base64')
    if (buffer.length < 100) {
      return NextResponse.json({ ...info, error: 'Buffer te klein na decode', bufferSize: buffer.length })
    }
    const base64Data = buffer.toString('base64')

    info.cleanBase64Length = base64Data.length
    info.bufferSize = buffer.length
    info.bufferSizeMB = (buffer.length / (1024 * 1024)).toFixed(1)

    // Send to Claude API — simplest possible call, no streaming, no thinking
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 })

    const client = new Anthropic({ apiKey, timeout: 120000 })

    info.step = 'sending-to-api'
    const startTime = Date.now()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
          } as any,
          { type: 'text', text: 'Wie is de verweerder in dit document? Geef alleen de naam.' },
        ],
      }],
    })

    const elapsed = Date.now() - startTime

    // Extract text from response
    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return NextResponse.json({
      ...info,
      step: 'done',
      success: true,
      elapsedMs: elapsed,
      model: response.model,
      usage: response.usage,
      stopReason: response.stop_reason,
      responseText,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ...info,
      error: msg,
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 })
  }
}
