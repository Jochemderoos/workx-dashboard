import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'Engels',
  nl: 'Nederlands',
  de: 'Duits',
  fr: 'Frans',
  es: 'Spaans',
}

// ── XML helpers ───────────────────────────────────────────────────

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

function encodeXmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Extract all paragraph texts from OOXML */
function extractParagraphTexts(xml: string): string[] {
  const texts: string[] = []
  const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g
  let match
  while ((match = pRegex.exec(xml)) !== null) {
    const parts: string[] = []
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g
    let tMatch
    while ((tMatch = tRegex.exec(match[0])) !== null) {
      parts.push(decodeXmlEntities(tMatch[1]))
    }
    texts.push(parts.join(''))
  }
  return texts
}

/** Replace paragraph texts. Translated text goes in first <w:t>, rest cleared. */
function replaceParagraphTexts(xml: string, translations: Map<number, string>): string {
  let pIndex = 0
  return xml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (pMatch) => {
    const idx = pIndex++
    const newText = translations.get(idx)
    if (newText === undefined) return pMatch

    let isFirst = true
    return pMatch.replace(/<w:t(\s[^>]*)?>([^<]*)<\/w:t>/g, (_tMatch, attrs: string | undefined) => {
      if (isFirst) {
        isFirst = false
        const attrStr = attrs || ''
        const newAttrs = attrStr.includes('xml:space') ? attrStr : ' xml:space="preserve"'
        return `<w:t${newAttrs}>${encodeXmlEntities(newText)}</w:t>`
      }
      return `<w:t${attrs || ''}></w:t>`
    })
  })
}

// ── Claude API ────────────────────────────────────────────────────

async function callClaude(prompt: string, maxTokens = 16384): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const maxRetries = 3
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (response.ok) {
      const data = await response.json()
      return data.content[0].text
    }

    if ((response.status === 429 || response.status === 500 || response.status === 529) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
      continue
    }

    const errText = await response.text()
    throw new Error(`Claude API error: ${response.status} – ${errText}`)
  }
  throw new Error('Max retries exceeded')
}

// ── POST handler ──────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const { targetLanguage } = (await req.json()) as { targetLanguage: string }
    if (!targetLanguage || !LANGUAGE_NAMES[targetLanguage]) {
      return NextResponse.json({ error: 'Ongeldige doeltaal' }, { status: 400 })
    }

    const taalNaam = LANGUAGE_NAMES[targetLanguage]

    // Load document
    const document = await prisma.aIDocument.findFirst({
      where: {
        id: params.id,
        OR: [
          { userId: session.user.id },
          { project: { members: { some: { userId: session.user.id } } } },
        ],
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    if (!document.fileUrl) {
      return NextResponse.json({ error: 'Geen bestandsdata beschikbaar' }, { status: 400 })
    }

    const base64Match = document.fileUrl.match(/^data:[^;]+;base64,(.+)$/)
    if (!base64Match) {
      return NextResponse.json({ error: 'Ongeldig bestandsformaat' }, { status: 400 })
    }

    const buffer = Buffer.from(base64Match[1], 'base64')
    const outputName = document.name.replace(/\.[^.]+$/i, '') + `-${taalNaam}.docx`

    // ── DOCX: style-preserving translation ──
    if (document.fileType === 'docx') {
      const zip = new AdmZip(buffer)

      // Find all XML files with translatable text
      const xmlFiles: string[] = []
      for (const entry of zip.getEntries()) {
        const name = entry.entryName
        if (
          name === 'word/document.xml' ||
          /^word\/header\d*\.xml$/.test(name) ||
          /^word\/footer\d*\.xml$/.test(name) ||
          name === 'word/footnotes.xml' ||
          name === 'word/endnotes.xml'
        ) {
          xmlFiles.push(name)
        }
      }

      // Collect non-empty paragraph texts across all XML files
      const allParagraphs: { file: string; globalIndex: number; localIndex: number; text: string }[] = []
      const fileXmls: Record<string, string> = {}

      for (const file of xmlFiles) {
        const xml = zip.readAsText(file)
        fileXmls[file] = xml
        const texts = extractParagraphTexts(xml)
        for (let i = 0; i < texts.length; i++) {
          if (texts[i].trim()) {
            allParagraphs.push({
              file,
              globalIndex: allParagraphs.length,
              localIndex: i,
              text: texts[i],
            })
          }
        }
      }

      if (allParagraphs.length === 0) {
        return NextResponse.json({ error: 'Geen tekst gevonden in het document' }, { status: 400 })
      }

      // Translate in chunks
      const chunkSize = 100
      const translatedTexts: string[] = []

      for (let i = 0; i < allParagraphs.length; i += chunkSize) {
        const chunk = allParagraphs.slice(i, i + chunkSize)
        const textsJson = JSON.stringify(chunk.map((p) => p.text))

        const prompt = `Je bent een professionele vertaler. Vertaal elk item in de onderstaande JSON-array naar het ${taalNaam}.

REGELS:
- Retourneer ALLEEN een JSON-array met exact evenveel items als de input.
- Behoud de volgorde exact.
- Vertaal elk item volledig en professioneel.
- Gebruik professioneel juridisch taalgebruik waar van toepassing.
- Geef GEEN uitleg, GEEN markdown, ALLEEN de JSON-array.

INPUT:
${textsJson}`

        const result = await callClaude(prompt)
        const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const arrayStart = cleaned.indexOf('[')
        const arrayEnd = cleaned.lastIndexOf(']')
        if (arrayStart === -1 || arrayEnd === -1) {
          throw new Error('Kon vertaling niet verwerken')
        }
        const parsed = JSON.parse(cleaned.substring(arrayStart, arrayEnd + 1))
        if (!Array.isArray(parsed) || parsed.length !== chunk.length) {
          throw new Error(`Vertaling gaf ${parsed.length} items, verwacht ${chunk.length}`)
        }
        translatedTexts.push(...parsed)

        if (i + chunkSize < allParagraphs.length) {
          await new Promise((r) => setTimeout(r, 500))
        }
      }

      // Replace texts in XML files
      for (const file of xmlFiles) {
        const fileParagraphs = allParagraphs.filter((p) => p.file === file)
        if (fileParagraphs.length === 0) continue

        const translationMap = new Map<number, string>()
        for (const p of fileParagraphs) {
          translationMap.set(p.localIndex, translatedTexts[p.globalIndex])
        }

        const updatedXml = replaceParagraphTexts(fileXmls[file], translationMap)
        const entry = zip.getEntry(file)
        if (entry) {
          zip.updateFile(entry, Buffer.from(updatedXml, 'utf-8'))
        }
      }

      const modifiedBuffer = zip.toBuffer()

      return new Response(modifiedBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(outputName)}"`,
        },
      })
    }

    // ── PDF/TXT: extract text, translate, return as text ──
    const textContent = document.content || ''
    if (!textContent.trim()) {
      return NextResponse.json({ error: 'Geen tekst gevonden in het document' }, { status: 400 })
    }

    const translatePrompt = `Vertaal het volledige onderstaande document naar het ${taalNaam}.
Behoud de originele structuur, alinea's, koppen en opmaak exact.
Geef ALLEEN de vertaalde tekst terug zonder commentaar of uitleg.
Gebruik professioneel juridisch taalgebruik waar van toepassing.

---

${textContent}`

    const translation = await callClaude(translatePrompt)

    // Generate DOCX from translated text using the docx library
    const { generateDocx } = await import('@/lib/export-docx')
    const blob = await generateDocx(translation)
    const arrayBuffer = await blob.arrayBuffer()

    return new Response(Buffer.from(arrayBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(outputName)}"`,
      },
    })
  } catch (error) {
    console.error('[documents/translate] Error:', error)
    const message = error instanceof Error ? error.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
