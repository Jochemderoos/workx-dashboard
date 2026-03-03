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

async function callClaude(prompt: string, maxTokens = 8192): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[translate] Claude API ${response.status}:`, errText.substring(0, 300))
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content[0].text
}

// ── POST handler ──────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[translate] Start – doc:', params.id)

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
    console.log('[translate] Taal:', taalNaam)

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
      console.log('[translate] Document niet gevonden')
      return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
    }

    console.log('[translate] Document gevonden:', document.name, 'type:', document.fileType, 'fileUrl:', document.fileUrl ? 'ja' : 'nee', 'content:', document.content?.length || 0, 'chars')

    const outputName = document.name.replace(/\.[^.]+$/i, '') + `-${taalNaam}.docx`

    // ── DOCX: style-preserving translation ──
    if (document.fileType === 'docx' && document.fileUrl) {
      const base64Match = document.fileUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (!base64Match) {
        return NextResponse.json({ error: 'Ongeldig bestandsformaat' }, { status: 400 })
      }

      const buffer = Buffer.from(base64Match[1], 'base64')
      console.log('[translate] DOCX buffer:', buffer.length, 'bytes')

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

      console.log('[translate] XML files:', xmlFiles)

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

      console.log('[translate] Paragraphs to translate:', allParagraphs.length)

      if (allParagraphs.length === 0) {
        return NextResponse.json({ error: 'Geen tekst gevonden in het document' }, { status: 400 })
      }

      // Delimiter-based format avoids JSON escaping issues with quotes in text
      const DELIM = '¶¶¶'

      const translateChunk = async (texts: string[]): Promise<string[]> => {
        const numbered = texts.map((t, i) => `[${i}] ${t}`).join('\n')
        const prompt = `Vertaal elke genummerde regel hieronder naar het ${taalNaam}.
Geef elke vertaling op een aparte regel, gescheiden door exact "${DELIM}" op een eigen regel.
Geef GEEN nummers, GEEN uitleg, ALLEEN de vertalingen gescheiden door ${DELIM}.
Gebruik professioneel juridisch taalgebruik waar van toepassing.

${numbered}`

        const result = await callClaude(prompt, 8192)
        const parts = result.split(DELIM).map((s) => s.trim()).filter((s) => s.length > 0)
        if (parts.length !== texts.length) {
          console.error(`[translate] Chunk mismatch: got ${parts.length}, expected ${texts.length}`)
          // Pad or truncate to match
          while (parts.length < texts.length) parts.push(texts[parts.length])
          if (parts.length > texts.length) parts.length = texts.length
        }
        return parts
      }

      // Process in parallel chunks of 30
      const chunkSize = 30
      const chunks: string[][] = []
      for (let i = 0; i < allParagraphs.length; i += chunkSize) {
        chunks.push(allParagraphs.slice(i, i + chunkSize).map((p) => p.text))
      }

      console.log('[translate] Translating', allParagraphs.length, 'paragraphs in', chunks.length, 'chunks')
      const chunkResults = await Promise.all(chunks.map((c) => translateChunk(c)))
      const translatedTexts = chunkResults.flat()
      console.log('[translate] Done, got', translatedTexts.length, 'translations')

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
      const docxBase64 = modifiedBuffer.toString('base64')
      console.log('[translate] DOCX done, base64 size:', docxBase64.length)

      return NextResponse.json({ docxBase64, fileName: outputName })
    }

    // ── PDF/TXT: extract text, translate, return as DOCX ──
    const textContent = document.content || ''
    if (!textContent.trim()) {
      return NextResponse.json({ error: 'Geen tekst gevonden in het document' }, { status: 400 })
    }

    console.log('[translate] PDF/TXT mode, content:', textContent.length, 'chars')

    const translatePrompt = `Vertaal het volledige onderstaande document naar het ${taalNaam}.
Behoud de originele structuur, alinea's, koppen en opmaak exact.
Geef ALLEEN de vertaalde tekst terug zonder commentaar of uitleg.
Gebruik professioneel juridisch taalgebruik waar van toepassing.

---

${textContent}`

    const translation = await callClaude(translatePrompt)
    console.log('[translate] Translation done:', translation.length, 'chars')

    return NextResponse.json({ translation, fileName: outputName })
  } catch (error) {
    console.error('[translate] Error:', error)
    const message = error instanceof Error ? error.message : 'Onbekende fout bij vertaling'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
