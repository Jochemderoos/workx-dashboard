// Gedeelde Word-bouwblokken voor transitie-exports.
// Doel: alle Word-documenten (single, compare, whatif) krijgen exact dezelfde
// look & feel als de PDF — logo, addressee-header, gele resultaat-band en
// Workx-footer.

import fs from 'fs'
import path from 'path'
import {
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  TextRun,
  ImageRun,
  AlignmentType,
  HeadingLevel,
} from 'docx'

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

const SOFT_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'E5E5E5' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'EFEFEF' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'EFEFEF' },
}

let cachedLogo: Buffer | null = null
function getLogoBuffer(): Buffer | null {
  if (cachedLogo) return cachedLogo
  try {
    cachedLogo = fs.readFileSync(path.join(process.cwd(), 'public', 'workx-logo.png'))
    return cachedLogo
  } catch {
    return null
  }
}

export const fmt = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

const greyText = (text: string, size = 18) =>
  new TextRun({ text, color: '787878', size })

const darkText = (text: string, opts: { bold?: boolean; size?: number } = {}) =>
  new TextRun({ text, color: '232323', bold: opts.bold, size: opts.size ?? 20 })

// === HEADER: logo links + adressering rechts ===
export function buildHeader(opts: {
  employerName?: string | null
  employeeName?: string | null
  partySubtitle?: string | null
}): Table {
  const logoBuf = getLogoBuffer()
  const logoChildren = logoBuf
    ? [new Paragraph({ children: [new ImageRun({
        data: logoBuf,
        transformation: { width: 130, height: 76 },
      } as any)] })]
    : [new Paragraph({ children: [new TextRun({ text: 'WORKX', bold: true, size: 36, color: '232323' })] })]

  const infoRows: Paragraph[] = [
    new Paragraph({ spacing: { after: 60 }, children: [
      greyText('Aan          '), darkText(opts.employerName || '—'),
    ]}),
    new Paragraph({ spacing: { after: 60 }, children: [
      greyText('Datum       '), darkText(new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })),
    ]}),
    new Paragraph({ spacing: { after: 60 }, children: [
      greyText('Betreft     '), darkText(opts.employeeName || '—'),
    ]}),
  ]
  if (opts.partySubtitle) {
    infoRows.push(new Paragraph({ spacing: { after: 60 }, children: [
      greyText('Voor         '), darkText(opts.partySubtitle),
    ]}))
  }

  return new Table({
    rows: [new TableRow({
      children: [
        new TableCell({ width: { size: 35, type: WidthType.PERCENTAGE }, children: logoChildren, borders: NO_BORDER }),
        new TableCell({ width: { size: 65, type: WidthType.PERCENTAGE }, children: infoRows, borders: NO_BORDER }),
      ],
    })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
  })
}

// Subtitle "Gemaakt met de Workx App" + divider lijn
export function buildTaglineAndDivider(): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [new TextRun({ text: 'Gemaakt met de Workx App', italics: true, color: 'A0A0A0', size: 16 })],
    }),
    new Paragraph({
      border: { bottom: { color: 'D0D0D0', size: 6, space: 1, style: BorderStyle.SINGLE } },
      spacing: { after: 200 },
    }),
  ]
}

// Title: pretitle + grote titel + accent-streep
export function buildTitle(pretitle: string, title: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 100, after: 80 },
      children: [new TextRun({ text: pretitle.toUpperCase(), color: '787878', size: 18 })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 44, color: '232323' })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { color: '232323', size: 12, space: 1, style: BorderStyle.SINGLE } },
      // Korte accent-streep: lege paragraaf met onderlijn — beperken met smalle indent
      indent: { right: 9000 }, // ~20mm
    }),
  ]
}

// Lichte info-strip (dienstverband)
export function buildInfoStrip(items: { label: string; value: string }[]): Table {
  return new Table({
    rows: [new TableRow({
      children: items.map(it => new TableCell({
        shading: { fill: 'FAFAFA' },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        borders: NO_BORDER,
        children: [
          new Paragraph({ spacing: { after: 40 }, children: [greyText(it.label, 16)] }),
          new Paragraph({ children: [darkText(it.value, { bold: true, size: 22 })] }),
        ],
      })),
    })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
  })
}

// Salaris-componenten tabel — label-links, waarde-rechts, geen randen
export function buildKeyValueTable(rows: { label: string; value: string; highlight?: boolean }[]): Table {
  return new Table({
    rows: rows.map(r => new TableRow({
      children: [
        new TableCell({
          width: { size: 60, type: WidthType.PERCENTAGE },
          shading: r.highlight ? { fill: 'F5F5F5' } : undefined,
          margins: { top: 140, bottom: 140, left: 80, right: 80 },
          borders: SOFT_BORDER,
          children: [new Paragraph({ children: [new TextRun({ text: r.label, color: '646464', size: 20 })] })],
        }),
        new TableCell({
          width: { size: 40, type: WidthType.PERCENTAGE },
          shading: r.highlight ? { fill: 'F5F5F5' } : undefined,
          margins: { top: 140, bottom: 140, left: 80, right: 80 },
          borders: SOFT_BORDER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: r.value, color: '232323', bold: r.highlight, size: 20 })],
          })],
        }),
      ],
    })),
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SOFT_BORDER,
  })
}

// Section header
export function buildSectionHeader(label: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    children: [new TextRun({ text: label, bold: true, color: '3C3C3C', size: 22 })],
  })
}

// Gele resultaat-band — label links, bedrag rechts, beide vertikaal gecentreerd
export function buildResultBand(label: string, amount: string): Table {
  return new Table({
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 55, type: WidthType.PERCENTAGE },
          shading: { fill: 'F9FF85' },
          margins: { top: 320, bottom: 320, left: 280, right: 80 },
          borders: NO_BORDER,
          children: [new Paragraph({ children: [
            new TextRun({ text: label.toUpperCase(), bold: true, color: '232323', size: 22 }),
          ] })],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { fill: 'F9FF85' },
          margins: { top: 320, bottom: 320, left: 80, right: 280 },
          borders: NO_BORDER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: amount, bold: true, color: '232323', size: 36 })],
          })],
        }),
      ],
    })],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDER,
  })
}

// Disclaimer + footer
export function buildDisclaimer(text: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200, after: 120 },
      border: { top: { color: 'D0D0D0', size: 6, space: 1, style: BorderStyle.SINGLE } },
    }),
    new Paragraph({
      children: [new TextRun({ text, italics: true, color: '8C8C8C', size: 14 })],
    }),
  ]
}

export function buildFooter(): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 200 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: 'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
        color: '6E6E6E',
        size: 14,
      })],
    }),
  ]
}

export function partySubtitle(clientParty?: string | null): string | null {
  if (clientParty === 'werknemer') return 'Opgesteld voor de werknemer'
  if (clientParty === 'werkgever') return 'Opgesteld voor de werkgever'
  if (clientParty === 'beide') return 'Opgesteld voor beide partijen'
  return null
}
