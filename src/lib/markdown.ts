/**
 * Simpele markdown → HTML converter voor Claude AI responses
 * Ondersteunt: headings, bold, italic, code blocks, inline code, links, lists, blockquotes
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks (``` ... ```)
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>')
          inList = false
        }
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

    // Empty line
    if (line.trim() === '') {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      result.push('')
      continue
    }

    // Blockquotes
    if (line.trim().startsWith('> ')) {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      const content = processInline(line.trim().slice(2))
      result.push(`<blockquote>${content}</blockquote>`)
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      const level = headingMatch[1].length
      const content = processInline(headingMatch[2])
      result.push(`<h${level}>${content}</h${level}>`)
      continue
    }

    // Unordered list items
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/)
    if (ulMatch) {
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
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>')
        inList = false
      }
      result.push('<hr />')
      continue
    }

    // Details/summary blocks (collapsible sections)
    if (line.trim() === '<details>' || line.trim().startsWith('<details ')) {
      if (inList) { result.push(listType === 'ul' ? '</ul>' : '</ol>'); inList = false }
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
    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>')
      inList = false
    }
    result.push(`<p>${processInline(line)}</p>`)
  }

  // Close any open blocks
  if (inCodeBlock) {
    const escaped = escapeHtml(codeLines.join('\n'))
    result.push(`<pre class="code-block"><code>${escaped}</code></pre>`)
  }
  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>')
  }

  return result.join('\n')
}

/** Process inline markdown: bold, italic, code, links */
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
