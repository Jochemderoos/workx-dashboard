/**
 * Generate a real .docx file from markdown content using the `docx` library.
 * Produces native Office Open XML that opens correctly in all Word versions.
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, UnderlineType,
} from 'docx'

const BRAND_COLOR = '1a3a5c'

/** Simple markdown-to-docx paragraph converter */
export async function generateDocx(markdownContent: string): Promise<Blob> {
  const lines = markdownContent.split('\n')
  const children: (Paragraph | Table)[] = []
  const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: 'WORKX ADVOCATEN', bold: true, size: 18, color: BRAND_COLOR, font: 'Calibri' })],
    spacing: { after: 40 },
  }))
  children.push(new Paragraph({
    children: [new TextRun({ text: date, size: 18, color: '888888', font: 'Calibri' })],
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR } },
  }))
  children.push(new Paragraph({ spacing: { after: 120 } }))

  let inCodeBlock = false
  let codeLines: string[] = []
  let inBlockquote = false
  let blockquoteLines: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let listDepth = 0

  const flushBlockquote = () => {
    if (blockquoteLines.length > 0) {
      children.push(new Paragraph({
        children: parseInlineFormatting(blockquoteLines.join(' ')),
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: BRAND_COLOR } },
        spacing: { before: 120, after: 120 },
      }))
      blockquoteLines = []
    }
    inBlockquote = false
  }

  const flushTable = () => {
    if (tableRows.length > 0) {
      const rows = tableRows.map((cells, rowIdx) =>
        new TableRow({
          children: cells.map(cell =>
            new TableCell({
              children: [new Paragraph({
                children: parseInlineFormatting(cell.trim()),
                spacing: { before: 40, after: 40 },
              })],
              width: { size: Math.floor(100 / cells.length), type: WidthType.PERCENTAGE },
              shading: rowIdx === 0 ? { fill: 'f0f4f8' } : undefined,
            })
          ),
        })
      )
      const borderDef = { style: BorderStyle.SINGLE, size: 1, color: 'bbbbbb' }
      children.push(new Table({
        rows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: borderDef,
          bottom: borderDef,
          left: borderDef,
          right: borderDef,
          insideHorizontal: borderDef,
          insideVertical: borderDef,
        },
      }))
      children.push(new Paragraph({ spacing: { after: 120 } }))
      tableRows = []
    }
    inTable = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        children.push(new Paragraph({
          children: [new TextRun({
            text: codeLines.join('\n'),
            font: 'Consolas',
            size: 19,
          })],
          shading: { fill: 'f4f4f4' },
          spacing: { before: 80, after: 80 },
        }))
        codeLines = []
        inCodeBlock = false
      } else {
        flushBlockquote()
        flushTable()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Table rows
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Skip separator rows (|---|---|)
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue
      flushBlockquote()
      inTable = true
      const cells = line.trim().slice(1, -1).split('|')
      tableRows.push(cells)
      continue
    } else if (inTable) {
      flushTable()
    }

    // Blockquotes
    if (line.trimStart().startsWith('>')) {
      const content = line.replace(/^>\s*/, '')
      inBlockquote = true
      blockquoteLines.push(content)
      continue
    } else if (inBlockquote) {
      flushBlockquote()
    }

    // Empty line
    if (line.trim() === '') {
      children.push(new Paragraph({ spacing: { after: 80 } }))
      continue
    }

    // Headings
    const h1Match = line.match(/^# (.+)/)
    if (h1Match) {
      children.push(new Paragraph({
        children: [new TextRun({ text: h1Match[1], bold: true, size: 32, color: BRAND_COLOR, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BRAND_COLOR } },
      }))
      continue
    }

    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      children.push(new Paragraph({
        children: [new TextRun({ text: h2Match[1], bold: true, size: 26, color: BRAND_COLOR, font: 'Calibri' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
      }))
      continue
    }

    const h3Match = line.match(/^### (.+)/)
    if (h3Match) {
      children.push(new Paragraph({
        children: [new TextRun({ text: h3Match[1], bold: true, size: 22, color: '333333', font: 'Calibri' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 60 },
      }))
      continue
    }

    const h4Match = line.match(/^####+ (.+)/)
    if (h4Match) {
      children.push(new Paragraph({
        children: [new TextRun({ text: h4Match[1], bold: true, size: 22, color: '444444', font: 'Calibri' })],
        heading: HeadingLevel.HEADING_4,
        spacing: { before: 100, after: 40 },
      }))
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' } },
        spacing: { before: 160, after: 160 },
      }))
      continue
    }

    // List items
    const ulMatch = line.match(/^(\s*)[-*] (.+)/)
    if (ulMatch) {
      listDepth = Math.floor((ulMatch[1] || '').length / 2)
      children.push(new Paragraph({
        children: parseInlineFormatting(ulMatch[2]),
        bullet: { level: listDepth },
        spacing: { before: 20, after: 40 },
      }))
      continue
    }

    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/)
    if (olMatch) {
      listDepth = Math.floor((olMatch[1] || '').length / 2)
      children.push(new Paragraph({
        children: parseInlineFormatting(olMatch[2]),
        numbering: { reference: 'default-numbering', level: listDepth },
        spacing: { before: 20, after: 40 },
      }))
      continue
    }

    // Details/summary (flatten for Word)
    if (line.trim().startsWith('<details>') || line.trim().startsWith('</details>')) continue
    const summaryMatch = line.match(/<summary>(.+?)<\/summary>/)
    if (summaryMatch) {
      children.push(new Paragraph({
        children: [new TextRun({ text: summaryMatch[1], bold: true, size: 22, color: BRAND_COLOR, font: 'Calibri' })],
        spacing: { before: 120, after: 40 },
      }))
      continue
    }

    // Regular paragraph
    children.push(new Paragraph({
      children: parseInlineFormatting(line),
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 80 },
    }))
  }

  // Flush remaining
  flushBlockquote()
  flushTable()

  // Footer
  children.push(new Paragraph({ spacing: { before: 280 }, border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' } } }))
  children.push(new Paragraph({
    children: [new TextRun({
      text: 'Dit document is gegenereerd met behulp van AI en vormt geen juridisch advies. Raadpleeg uw advocaat voor een op uw situatie toegespitst advies.',
      italics: true,
      size: 16,
      color: '999999',
      font: 'Calibri',
    })],
  }))

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [
          { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START },
          { level: 1, format: 'lowerLetter', text: '%2)', alignment: AlignmentType.START },
          { level: 2, format: 'lowerRoman', text: '%3.', alignment: AlignmentType.START },
        ],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1152, left: 1440 }, // 1 inch = 1440 twips
        },
      },
      children,
    }],
  })

  return await Packer.toBlob(doc)
}

/** Parse inline markdown formatting (bold, italic, code, links) into TextRun array */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = []
  // Strip HTML tags that might leak through
  text = text.replace(/<\/?(?:strong|em|code|a|span|div|p|br)\s*[^>]*>/gi, '')

  // Pattern: **bold**, *italic*, `code`, [link](url), ***bold italic***
  const pattern = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size: 22, font: 'Calibri' }))
    }

    if (match[2]) {
      // ***bold italic***
      runs.push(new TextRun({ text: match[2], bold: true, italics: true, size: 22, font: 'Calibri' }))
    } else if (match[3]) {
      // **bold**
      runs.push(new TextRun({ text: match[3], bold: true, size: 22, font: 'Calibri' }))
    } else if (match[4]) {
      // *italic*
      runs.push(new TextRun({ text: match[4], italics: true, size: 22, font: 'Calibri' }))
    } else if (match[5]) {
      // `code`
      runs.push(new TextRun({ text: match[5], font: 'Consolas', size: 19 }))
    } else if (match[6] && match[7]) {
      // [link](url)
      runs.push(new TextRun({
        text: match[6],
        color: BRAND_COLOR,
        underline: { type: UnderlineType.SINGLE },
        size: 22,
        font: 'Calibri',
      }))
    }

    lastIndex = match.index + match[0].length
  }

  // Remaining text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size: 22, font: 'Calibri' }))
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: text || '', size: 22, font: 'Calibri' }))
  }

  return runs
}
