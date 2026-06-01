// Genereert "Way it Workx - wijzigingen rapport.docx" direct uit het markdown-bestand.
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} = require('docx')

const md = fs.readFileSync(path.join(__dirname, '..', 'wijzigingen-rapport.md'), 'utf-8')

// Verwijder frontmatter
let body = md.replace(/^---[\s\S]*?---\n/, '')

const lines = body.split('\n')
const children = []

// Titelblok
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'The Way it Workx', bold: true, size: 40 })],
  spacing: { after: 100 },
}))
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'Wijzigingen-rapport — Word (21 januari 2026) vs. Dashboard', italics: true, size: 24 })],
  spacing: { after: 400 },
}))

function renderInline(text) {
  // Parse **bold** and *italic*; rest is plain
  const runs = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)))
    const tok = m[0]
    if (tok.startsWith('**')) runs.push(new TextRun({ text: tok.slice(2, -2), bold: true }))
    else runs.push(new TextRun({ text: tok.slice(1, -1), italics: true }))
    last = regex.lastIndex
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)))
  return runs.length > 0 ? runs : [new TextRun(text)]
}

let inBullet = false

for (const raw of lines) {
  const line = raw.trimEnd()
  if (!line.trim()) {
    inBullet = false
    continue
  }

  // Horizontal rule
  if (line === '---') {
    children.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], spacing: { before: 200, after: 200 } }))
    continue
  }

  // Headings
  if (line.startsWith('# ')) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: renderInline(line.slice(2)),
      spacing: { before: 360, after: 160 },
    }))
    continue
  }
  if (line.startsWith('## ')) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: renderInline(line.slice(3)),
      spacing: { before: 280, after: 120 },
    }))
    continue
  }
  if (line.startsWith('### ')) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: renderInline(line.slice(4)),
      spacing: { before: 200, after: 100 },
    }))
    continue
  }

  // Bullet
  if (line.startsWith('- ')) {
    children.push(new Paragraph({
      bullet: { level: 0 },
      children: renderInline(line.slice(2)),
      spacing: { after: 60 },
    }))
    inBullet = true
    continue
  }

  // Indented bullets (2 spaces + -)
  if (/^  - /.test(line)) {
    children.push(new Paragraph({
      bullet: { level: 1 },
      children: renderInline(line.slice(4)),
      spacing: { after: 60 },
    }))
    inBullet = true
    continue
  }

  // Paragraph
  children.push(new Paragraph({
    children: renderInline(line),
    spacing: { after: 120 },
  }))
}

const doc = new Document({
  creator: 'Workx Dashboard',
  title: 'The Way it Workx - Wijzigingen rapport',
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 },
      },
    },
  },
  sections: [{ properties: {}, children }],
})

const outPath = 'C:\\Users\\quiri\\Downloads\\Way it Workx - wijzigingen rapport.docx'
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer)
  console.log('Saved:', outPath, '(' + buffer.length + ' bytes)')
})
