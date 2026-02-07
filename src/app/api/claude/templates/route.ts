import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const ALLOWED_EXTENSIONS = ['docx', 'pdf', 'txt', 'md']
const MAX_SIZE = 25 * 1024 * 1024 // 25MB

const TEMPLATE_ANALYSIS_PROMPT = `Je bent een documentanalist voor Workx Advocaten (arbeidsrechtadvocatenkantoor, Amsterdam).

Analyseer het volgende documenttemplate en geef:

1. **Beschrijving**: Korte beschrijving van dit template (1-2 zinnen)
2. **Invulvelden**: Lijst van alle velden die moeten worden ingevuld (bijv. naam partij, datum, functie, salaris, etc.)
3. **Instructies**: Instructies voor het correct invullen van dit template

Geef het resultaat als JSON in dit formaat:
{
  "description": "Beschrijving van het template",
  "placeholders": ["veld1", "veld2", "veld3"],
  "instructions": "Instructies voor het invullen..."
}

Geef ALLEEN de JSON terug, geen andere tekst.`

// GET: lijst alle templates
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const templates = await prisma.aITemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      fileType: true,
      fileSize: true,
      placeholders: true,
      isActive: true,
      usageCount: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json(templates)
}

// POST: template uploaden
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const name = formData.get('name') as string
  const category = (formData.get('category') as string) || 'arbeidsrecht'

  if (!file) {
    return NextResponse.json({ error: 'Geen bestand geselecteerd' }, { status: 400 })
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `Bestandstype .${ext} niet ondersteund. Toegestaan: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Bestand is te groot (max 25MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Store original file as base64 (to preserve formatting, logo, styles)
  const mimeType = ext === 'docx'
    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : ext === 'pdf'
      ? 'application/pdf'
      : 'text/plain'
  const fileBase64 = `data:${mimeType};base64,${buffer.toString('base64')}`

  // Extract text content
  let textContent = ''
  if (ext === 'txt' || ext === 'md') {
    textContent = buffer.toString('utf-8')
  } else if (ext === 'pdf') {
    try {
      const { PDFParse } = await import('pdf-parse')
      const uint8 = new Uint8Array(buffer)
      const parser = new PDFParse(uint8)
      const rawText = await parser.getText()
      textContent = typeof rawText === 'string' ? rawText : String(rawText)
    } catch {
      textContent = '[PDF tekst kon niet worden geëxtraheerd]'
    }
  } else if (ext === 'docx') {
    try {
      // @ts-expect-error adm-zip types
      const AdmZip = (await import('adm-zip')).default
      const zip = new AdmZip(buffer)
      const docEntry = zip.getEntry('word/document.xml')
      if (docEntry) {
        const xml = docEntry.getData().toString('utf-8')
        textContent = xml
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<\/w:p>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      }
    } catch {
      textContent = '[DOCX tekst kon niet worden geëxtraheerd]'
    }
  }

  // Analyze template with Claude to find placeholders
  let description = ''
  let placeholders = '[]'
  let instructions = ''

  if (textContent && textContent.length > 50) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: TEMPLATE_ANALYSIS_PROMPT,
        messages: [{
          role: 'user',
          content: `Analyseer dit Workx Advocaten template:\n\nBestandsnaam: ${file.name}\n\n---\n\n${textContent.slice(0, 30000)}`,
        }],
      })

      const textBlock = response.content.find(b => b.type === 'text')
      if (textBlock && textBlock.type === 'text') {
        try {
          // Extract JSON from response (may have markdown code blocks)
          const jsonStr = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const analysis = JSON.parse(jsonStr)
          description = analysis.description || ''
          placeholders = JSON.stringify(analysis.placeholders || [])
          instructions = analysis.instructions || ''
        } catch {
          description = textBlock.text.slice(0, 200)
        }
      }
    } catch {
      // Continue without analysis
    }
  }

  const template = await prisma.aITemplate.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      category,
      description,
      fileType: ext,
      fileSize: file.size,
      content: textContent || null,
      fileBase64,
      placeholders,
      instructions,
      isActive: true,
    },
  })

  return NextResponse.json({
    id: template.id,
    name: template.name,
    category: template.category,
    description: template.description,
    fileType: template.fileType,
    fileSize: template.fileSize,
    placeholders: template.placeholders,
    isActive: template.isActive,
    usageCount: template.usageCount,
    createdAt: template.createdAt,
  }, { status: 201 })
}
