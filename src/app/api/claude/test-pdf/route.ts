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
 * GET /api/claude/test-pdf?docId=xxx
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const docId = req.nextUrl.searchParams.get('docId')
  if (!docId) return NextResponse.json({ error: 'docId parameter ontbreekt' }, { status: 400 })

  try {
    // Load document
    const doc = await prisma.aIDocument.findUnique({
      where: { id: docId },
      select: { id: true, name: true, fileType: true, fileSize: true, content: true, fileUrl: true },
    })
    if (!doc) return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })

    const info: Record<string, unknown> = {
      docId: doc.id,
      name: doc.name,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      contentLength: doc.content?.length ?? 0,
      hasFileUrl: !!doc.fileUrl,
      fileUrlPrefix: doc.fileUrl?.slice(0, 60) ?? null,
    }

    if (!doc.fileUrl) {
      return NextResponse.json({ ...info, error: 'Geen fileUrl in database — base64 data ontbreekt' })
    }

    // Extract base64
    const commaIdx = doc.fileUrl.indexOf(',')
    if (commaIdx === -1 || commaIdx > 100) {
      return NextResponse.json({ ...info, error: 'fileUrl is geen data URL (geen comma gevonden)' })
    }
    const base64Data = doc.fileUrl.slice(commaIdx + 1).replace(/[\s\r\n]/g, '')

    info.base64Length = base64Data.length
    info.base64First50 = base64Data.slice(0, 50)
    info.base64Last50 = base64Data.slice(-50)

    // Simple validation
    if (base64Data.length < 100) {
      return NextResponse.json({ ...info, error: 'Base64 data te kort' })
    }

    // Send to Claude API — simplest possible call, no streaming, no thinking
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 })

    const client = new Anthropic({ apiKey, timeout: 120000 })

    info.step = 'sending-to-api'

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

    // Extract text from response
    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    return NextResponse.json({
      ...info,
      step: 'done',
      success: true,
      model: response.model,
      usage: response.usage,
      stopReason: response.stop_reason,
      responseText,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      error: msg,
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    }, { status: 500 })
  }
}
