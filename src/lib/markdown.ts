/**
 * Markdown → HTML converter voor Claude AI responses
 * Ondersteunt: headings, bold, italic, strikethrough, code blocks, inline code,
 * links, lists, blockquotes, tables, details/summary, horizontal rules
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return ''

  // Split into lines for processing
  const lines = markdown.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeLines: string[] = []
  let inList = false
  let listType: 'ul' | 'ol' = 'ul'
  let inTable = false
  let tableRows: string[][] = []
  let tableAlignments: Array<'left' | 'center' | 'right' | 'default'> = []

  const closeList = () => {
    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>')
      inList = false
    }
  }

  const flushTable = () => {
    if (!inTable || tableRows.length === 0) return
    result.push('<div class="table-wrapper"><table>')
    // First row is header
    if (tableRows.length > 0) {
      result.push('<thead><tr>')
      for (let c = 0; c < tableRows[0].length; c++) {
        const align = tableAlignments[c] || 'default'
        const style = align !== 'default' ? ` style="text-align:${align}"` : ''
        result.push(`<th${style}>${processInline(tableRows[0][c].trim())}</th>`)
      }
      result.push('</tr></thead>')
    }
    // Remaining rows are body (skip alignment row at index 1 if it existed — already parsed)
    if (tableRows.length > 1) {
      result.push('<tbody>')
      for (let r = 1; r < tableRows.length; r++) {
        result.push('<tr>')
        for (let c = 0; c < tableRows[r].length; c++) {
          const align = tableAlignments[c] || 'default'
          const style = align !== 'default' ? ` style="text-align:${align}"` : ''
          result.push(`<td${style}>${processInline(tableRows[r][c].trim())}</td>`)
        }
        result.push('</tr>')
      }
      result.push('</tbody>')
    }
    result.push('</table></div>')
    inTable = false
    tableRows = []
    tableAlignments = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks (``` ... ```)
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        closeList()
        flushTable()
        inCodeBlock = true
        codeBlockLang = line.trim().slice(3).trim().replace(/[^a-zA-Z0-9_-]/g, '') // Sanitize: only safe chars
        codeLines = []
      } else {
        const escaped = escapeHtml(codeLines.join('\n'))
        result.push(
          `<div style="position:relative"><button class="code-copy-btn" style="position:absolute;top:6px;right:6px;padding:2px 8px;font-size:11px;border-radius:4px;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.1);cursor:pointer;z-index:1">Kopieer</button><pre class="code-block"><code${codeBlockLang ? ` class="language-${codeBlockLang}"` : ''}>${escaped}</code></pre></div>`
        )
        inCodeBlock = false
        codeBlockLang = ''
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Table detection: line contains | and is not a horizontal rule
    const isTableLine = line.includes('|') && !line.trim().match(/^[-*_]{3,}$/) && !line.trim().startsWith('>')
    const isAlignmentRow = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line.trim())

    if (isTableLine && !inTable) {
      // Check if next line is an alignment row (standard markdown table)
      const nextLine = i + 1 < lines.length ? lines[i + 1] : ''
      const nextIsAlignment = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(nextLine.trim())
      if (nextIsAlignment) {
        closeList()
        inTable = true
        // Parse header row
        const cells = parseTableRow(line)
        tableRows.push(cells)
        // Parse alignment row
        const alignCells = parseTableRow(nextLine)
        tableAlignments = alignCells.map(cell => {
          const trimmed = cell.trim()
          if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
          if (trimmed.endsWith(':')) return 'right'
          if (trimmed.startsWith(':')) return 'left'
          return 'default'
        })
        i++ // Skip alignment row
        continue
      }
    }

    if (inTable && isTableLine && !isAlignmentRow) {
      const cells = parseTableRow(line)
      tableRows.push(cells)
      continue
    }

    if (inTable && !isTableLine) {
      flushTable()
      // Fall through to process this line normally
    }

    // Empty line
    if (line.trim() === '') {
      closeList()
      flushTable()
      result.push('')
      continue
    }

    // Blockquotes
    if (line.trim().startsWith('> ')) {
      closeList()
      flushTable()
      const content = processInline(line.trim().slice(2))
      result.push(`<blockquote>${content}</blockquote>`)
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      closeList()
      flushTable()
      const level = headingMatch[1].length
      const content = processInline(headingMatch[2])
      result.push(`<h${level}>${content}</h${level}>`)
      continue
    }

    // Unordered list items
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (ulMatch) {
      flushTable()
      if (!inList || listType !== 'ul') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>')
        result.push('<ul>')
        inList = true
        listType = 'ul'
      }
      result.push(`<li>${processInline(ulMatch[2])}</li>`)
      continue
    }

    // Ordered list items
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/)
    if (olMatch) {
      flushTable()
      if (!inList || listType !== 'ol') {
        if (inList) result.push(listType === 'ul' ? '</ul>' : '</ol>')
        result.push('<ol>')
        inList = true
        listType = 'ol'
      }
      result.push(`<li>${processInline(olMatch[2])}</li>`)
      continue
    }

    // Horizontal rule
    if (line.trim().match(/^[-*_]{3,}$/)) {
      closeList()
      flushTable()
      result.push('<hr />')
      continue
    }

    // Details/summary blocks (collapsible sections)
    if (line.trim() === '<details>' || line.trim().startsWith('<details ')) {
      closeList()
      flushTable()
      result.push('<details class="source-details">')
      continue
    }
    if (line.trim() === '</details>') {
      result.push('</details>')
      continue
    }
    if (line.trim().startsWith('<summary>') && line.trim().endsWith('</summary>')) {
      const inner = line.trim().slice(9, -10)
      result.push(`<summary>${processInline(inner)}</summary>`)
      continue
    }

    // Regular paragraph
    closeList()
    flushTable()
    result.push(`<p>${processInline(line)}</p>`)
  }

  // Close any open blocks
  if (inCodeBlock) {
    const escaped = escapeHtml(codeLines.join('\n'))
    result.push(`<pre class="code-block"><code>${escaped}</code></pre>`)
  }
  closeList()
  flushTable()

  return result.join('\n')
}

/** Parse a markdown table row into cells */
function parseTableRow(line: string): string[] {
  // Remove leading/trailing pipes and split
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
  return trimmed.split('|')
}

/** Process inline markdown: bold, italic, strikethrough, code, links */
function processInline(text: string): string {
  let result = escapeHtml(text)

  // Inline code (must be first to prevent processing inside code)
  result = result.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')

  // Bold + italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links: [text](url) — filter dangerous URI schemes
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => {
      const trimmed = url.trim().toLowerCase()
      // Whitelist only safe URL schemes
      const scheme = trimmed.split(':')[0]
      if (scheme && !['http', 'https', 'mailto', 'tel'].includes(scheme) && trimmed.includes(':')) {
        return text // Strip the link, keep just the text
      }
      // Escape any remaining quotes in URL to prevent attribute breakout
      const safeUrl = url.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`
    }
  )

  return result
}
