import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip')

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface EditRequest {
  find: string
  replace: string
}

interface EditResult {
  find: string
  status: 'applied' | 'not_found'
}

/**
 * Decode XML entities to plain text for matching
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Encode plain text back to XML entities
 */
function encodeXmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Apply a find/replace within a single <w:p> paragraph XML block.
 *
 * Strategy:
 * 1. Extract all <w:r> runs and their <w:t> text elements
 * 2. Concatenate the plain text from all runs
 * 3. If the find-string appears in the concatenated text, determine which runs overlap
 * 4. Replace text in overlapping runs while preserving <w:rPr> formatting
 */
function applyEditToParagraph(paragraphXml: string, find: string, replace: string): { xml: string; applied: boolean } {
  // Extract all <w:r>...</w:r> runs with their positions
  const runRegex = /<w:r[ >][\s\S]*?<\/w:r>/g
  const runs: Array<{ fullMatch: string; startIndex: number; endIndex: number }> = []
  let match: RegExpExecArray | null

  while ((match = runRegex.exec(paragraphXml)) !== null) {
    runs.push({
      fullMatch: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    })
  }

  if (runs.length === 0) return { xml: paragraphXml, applied: false }

  // Extract text from each run's <w:t> elements
  const runTexts: string[] = runs.map(r => {
    const tMatches = r.fullMatch.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)
    if (!tMatches) return ''
    return tMatches.map(t => {
      const content = t.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
      return content ? decodeXmlEntities(content[1]) : ''
    }).join('')
  })

  const fullText = runTexts.join('')
  const findIndex = fullText.indexOf(find)

  if (findIndex === -1) return { xml: paragraphXml, applied: false }

  // Map character positions to runs
  // charPositions[i] = { runIndex, offsetInRun } for character i of fullText
  const charPositions: Array<{ runIndex: number; offsetInRun: number }> = []
  let charOffset = 0
  for (let ri = 0; ri < runTexts.length; ri++) {
    for (let ci = 0; ci < runTexts[ri].length; ci++) {
      charPositions.push({ runIndex: ri, offsetInRun: ci })
    }
  }

  const findEnd = findIndex + find.length

  // Determine which runs are affected
  const startRunIndex = charPositions[findIndex]?.runIndex ?? 0
  const endRunIndex = findEnd > 0 && findEnd <= charPositions.length
    ? charPositions[findEnd - 1]?.runIndex ?? (runs.length - 1)
    : startRunIndex

  // Build new paragraph XML
  let result = paragraphXml
  // Process runs in reverse order to maintain string positions
  for (let ri = runs.length - 1; ri >= 0; ri--) {
    if (ri < startRunIndex || ri > endRunIndex) continue

    const run = runs[ri]
    const runText = runTexts[ri]

    // Calculate which portion of this run's text is part of the find string
    let textBefore = ''
    let textAfter = ''

    if (ri === startRunIndex && ri === endRunIndex) {
      // Find string is entirely within this run
      const localStart = charPositions[findIndex].offsetInRun
      const localEnd = localStart + find.length
      textBefore = runText.substring(0, localStart)
      textAfter = runText.substring(localEnd)
    } else if (ri === startRunIndex) {
      // Start of find string
      const localStart = charPositions[findIndex].offsetInRun
      textBefore = runText.substring(0, localStart)
      textAfter = ''
    } else if (ri === endRunIndex) {
      // End of find string
      const localEnd = charPositions[findEnd - 1].offsetInRun + 1
      textBefore = ''
      textAfter = runText.substring(localEnd)
    } else {
      // Middle run — entire text is part of the find string, clear it
      textBefore = ''
      textAfter = ''
    }

    // Build new text for this run
    let newText: string
    if (ri === startRunIndex) {
      // Put the replacement text in the first affected run
      newText = textBefore + replace + textAfter
    } else {
      // Clear text from subsequent affected runs (formatting runs preserved but empty)
      newText = textBefore + textAfter
    }

    // Replace the <w:t> content in this run
    const newRunXml = replaceRunText(run.fullMatch, newText)
    result = result.substring(0, run.startIndex) + newRunXml + result.substring(run.endIndex)
  }

  return { xml: result, applied: true }
}

/**
 * Replace all <w:t> text content within a run with new text.
 * Preserves the run properties (<w:rPr>) and structure.
 */
function replaceRunText(runXml: string, newText: string): string {
  // Remove all existing <w:t> elements
  const withoutT = runXml.replace(/<w:t[^>]*>[\s\S]*?<\/w:t>/g, '')

  // Find where to insert the new <w:t> — after </w:rPr> or after <w:r...>
  const rPrEnd = withoutT.indexOf('</w:rPr>')
  const encoded = encodeXmlEntities(newText)
  // Use xml:space="preserve" to keep whitespace
  const tElement = `<w:t xml:space="preserve">${encoded}</w:t>`

  if (rPrEnd !== -1) {
    const insertPos = rPrEnd + '</w:rPr>'.length
    return withoutT.substring(0, insertPos) + tElement + withoutT.substring(insertPos)
  }

  // Insert before </w:r>
  const closeTag = withoutT.lastIndexOf('</w:r>')
  if (closeTag !== -1) {
    return withoutT.substring(0, closeTag) + tElement + withoutT.substring(closeTag)
  }

  return runXml // Fallback: return unchanged
}

// POST: apply edits to a DOCX document
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const { edits } = (await req.json()) as { edits: EditRequest[] }

    if (!edits?.length) {
      return NextResponse.json({ error: 'Geen wijzigingen opgegeven' }, { status: 400 })
    }

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

    if (document.fileType !== 'docx') {
      return NextResponse.json({ error: 'Alleen DOCX-bestanden kunnen worden bewerkt' }, { status: 400 })
    }

    if (!document.fileUrl) {
      return NextResponse.json({ error: 'Geen bestandsdata beschikbaar' }, { status: 400 })
    }

    // Extract base64 data from data URL
    const base64Match = document.fileUrl.match(/^data:[^;]+;base64,(.+)$/)
    if (!base64Match) {
      return NextResponse.json({ error: 'Ongeldig bestandsformaat' }, { status: 400 })
    }

    const buffer = Buffer.from(base64Match[1], 'base64')
    const zip = new AdmZip(buffer)

    // Read word/document.xml
    const docEntry = zip.getEntry('word/document.xml')
    if (!docEntry) {
      return NextResponse.json({ error: 'Ongeldig DOCX-bestand: document.xml niet gevonden' }, { status: 400 })
    }

    let docXml = docEntry.getData().toString('utf8')

    // Apply each edit
    const editResults: EditResult[] = []

    for (const edit of edits) {
      if (!edit.find || edit.replace === undefined) {
        editResults.push({ find: edit.find || '', status: 'not_found' })
        continue
      }

      // Find all <w:p> paragraphs and try to apply the edit
      let applied = false
      const paragraphRegex = /<w:p[ >][\s\S]*?<\/w:p>/g
      const paragraphs: Array<{ match: string; index: number }> = []
      let pMatch: RegExpExecArray | null

      while ((pMatch = paragraphRegex.exec(docXml)) !== null) {
        paragraphs.push({ match: pMatch[0], index: pMatch.index })
      }

      // Process paragraphs in reverse to maintain positions
      for (let i = paragraphs.length - 1; i >= 0; i--) {
        const para = paragraphs[i]
        const result = applyEditToParagraph(para.match, edit.find, edit.replace)
        if (result.applied) {
          docXml = docXml.substring(0, para.index) + result.xml + docXml.substring(para.index + para.match.length)
          applied = true
          break // Apply only the first occurrence per edit
        }
      }

      editResults.push({ find: edit.find, status: applied ? 'applied' : 'not_found' })
    }

    // Write modified XML back to ZIP
    zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'))

    // Generate modified DOCX
    const modifiedBuffer = zip.toBuffer()

    // Return as binary download with edit results header
    return new Response(modifiedBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(document.name.replace(/\.docx$/i, ''))}-bewerkt.docx"`,
        'X-Edit-Results': JSON.stringify(editResults),
      },
    })
  } catch (error) {
    console.error('[documents/modify] Error:', error)
    return NextResponse.json(
      { error: 'Er is een fout opgetreden bij het bewerken van het document' },
      { status: 500 }
    )
  }
}
