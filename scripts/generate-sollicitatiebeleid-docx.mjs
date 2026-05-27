// Genereert een Word-document (.docx) van het sollicitatiebeleid in een
// card-style layout, vergelijkbaar met de dashboard-view (zonder uitklap).
// Geen logo — bovenaan ruimte om zelf het Workx-logo in te plakken.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageOrientation, Footer, PageNumber,
} from 'docx'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ── Kleuren
const LIME = 'A8B900'      // Workx lime (afgezwakt voor print)
const LIME_BG = 'FAFFCE'    // Heel licht limey
const CYAN = '0EA5E9'
const CYAN_BG = 'E0F7FA'
const PURPLE = '9333EA'
const PURPLE_BG = 'F3E8FF'
const DARK = '2D2D2D'
const GRAY = '666666'
const LIGHT_GRAY = 'F3F4F6'
const BORDER = 'D1D5DB'

// ── Helpers
function txt(content, opts = {}) {
  return new TextRun({
    text: content,
    bold: opts.bold,
    italics: opts.italic,
    color: opts.color,
    size: opts.size,                    // half-points (24 = 12pt)
    font: opts.font || 'Calibri',
  })
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.alignment,
    spacing: { before: opts.spaceBefore ?? 0, after: opts.spaceAfter ?? 80 },
    indent: opts.indent,
  })
}

function emptyPara(after = 0) {
  return new Paragraph({ children: [new TextRun('')], spacing: { after } })
}

function cellBorders(color = BORDER) {
  const b = { style: BorderStyle.SINGLE, size: 4, color }
  return { top: b, bottom: b, left: b, right: b }
}

function shadedCell(content, shading, opts = {}) {
  return new TableCell({
    children: content,
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: shading },
    borders: cellBorders(opts.borderColor || shading),
    width: opts.width,
    margins: opts.margins || { top: 200, bottom: 200, left: 200, right: 200 },
    verticalAlign: opts.verticalAlign,
  })
}

// ── Ronde-card als 1-cel tabel met gekleurde achtergrond
function rondeCard({ nummer, korteTitel, titel, karakter, betrokkenen, duur, accentColor, bgColor }) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [9000],
    rows: [
      new TableRow({
        children: [
          shadedCell(
            [
              // Top: nummer-pil + karakter-badge
              para([
                txt(`RONDE ${nummer}`, { bold: true, color: accentColor, size: 18 }),
                txt('   '),
                txt(karakter, { color: GRAY, size: 16, italic: true }),
                ...(duur ? [txt(`   ·   ${duur}`, { color: GRAY, size: 16, italic: true })] : []),
              ]),
              // Korte titel groot
              para(txt(korteTitel, { bold: true, color: DARK, size: 32 }), { spaceAfter: 100 }),
              // Volledige titel
              para(txt(titel, { color: DARK, size: 22 }), { spaceAfter: 160 }),
              // Betrokkenen-regel
              para([
                txt('Betrokkenen: ', { bold: true, color: GRAY, size: 18 }),
                txt(betrokkenen.join(' + '), { color: DARK, size: 18 }),
              ]),
            ],
            bgColor,
            { borderColor: accentColor, margins: { top: 300, bottom: 300, left: 320, right: 320 } }
          ),
        ],
      }),
    ],
  })
}

// ── Overzichtstabel
function overzichtTable() {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      shadedCell([para(txt('Ronde', { bold: true, color: DARK, size: 20 }))], LIGHT_GRAY),
      shadedCell([para(txt('Gesprek', { bold: true, color: DARK, size: 20 }))], LIGHT_GRAY),
      shadedCell([para(txt('Betrokkenen', { bold: true, color: DARK, size: 20 }))], LIGHT_GRAY),
      shadedCell([para(txt('Karakter', { bold: true, color: DARK, size: 20 }))], LIGHT_GRAY),
    ],
  })

  const rows = [
    ['1', 'Kennismakingsgesprek', 'Maaike of Bas + 1 partner', 'Formeel / informatief'],
    ['2', 'Inhoudelijk selectiegesprek', 'Maaike of Bas + 1 partner', 'Formeel / toetsend'],
    ['3', 'Informeel gesprek met team', 'Twee medewerkers', 'Informeel / wederzijds'],
  ].map(r => new TableRow({
    children: r.map(v =>
      new TableCell({
        children: [para(txt(v, { color: DARK, size: 20 }))],
        borders: cellBorders(BORDER),
        margins: { top: 150, bottom: 150, left: 200, right: 200 },
      })
    ),
  }))

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [800, 3000, 3000, 2200],
    rows: [headerRow, ...rows],
  })
}

// ── Sectie-header met gele accent-streep
function sectionHeader(text) {
  return [
    para(txt(text, { bold: true, color: DARK, size: 28 }), { spaceBefore: 200, spaceAfter: 60 }),
    para([
      new TextRun({ text: '████', color: LIME, size: 12 }),
    ], { spaceAfter: 200 }),
  ]
}

// ── Data
const RONDES = [
  {
    nummer: 1,
    korteTitel: 'Kennismaking',
    titel: 'Kennismaking en introductie',
    karakter: 'Formeel / informatief',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    accentColor: CYAN,
    bgColor: CYAN_BG,
  },
  {
    nummer: 2,
    korteTitel: 'Vakinhoud',
    titel: 'Inhoudelijk selectiegesprek',
    karakter: 'Formeel / toetsend',
    betrokkenen: ['Maaike of Bas', 'Andere partner'],
    accentColor: LIME,
    bgColor: LIME_BG,
  },
  {
    nummer: 3,
    korteTitel: 'Teamfit',
    titel: 'Informeel gesprek met het team',
    karakter: 'Informeel / wederzijds',
    duur: '30–60 min',
    betrokkenen: ['Twee medewerkers'],
    accentColor: PURPLE,
    bgColor: PURPLE_BG,
  },
]

// ── Bouw document
const children = [
  // Bovenaan ruimte voor logo (3 lege regels)
  emptyPara(0),
  emptyPara(0),
  emptyPara(120),

  // Subtitle pil
  para(txt('SOLLICITATIEBELEID', { bold: true, color: LIME, size: 18 }),
    { alignment: AlignmentType.CENTER, spaceAfter: 120 }),

  // Grote titel
  para(txt('Selectieprocedure in drie gespreksrondes',
    { bold: true, color: DARK, size: 44 }),
    { alignment: AlignmentType.CENTER, spaceAfter: 180 }),

  // Subtitel
  para(txt(
    'Onze gestructureerde manier om kandidaten zorgvuldig, consistent en respectvol te beoordelen.',
    { color: GRAY, size: 22, italic: true }),
    { alignment: AlignmentType.CENTER, spaceAfter: 400 }),

  // ── 3 RONDE-CARDS onder elkaar
  ...RONDES.flatMap((r, i) => [
    rondeCard(r),
    emptyPara(i < RONDES.length - 1 ? 180 : 300),
  ]),

  // ── Inleiding
  ...sectionHeader('Inleiding en doelstelling'),
  para(txt(
    'Dit beleidsdocument beschrijft de gestructureerde sollicitatieprocedure van Workx. Het doel is om op een zorgvuldige, consistente en respectvolle wijze te beoordelen of een kandidaat aansluit bij de professionele standaarden, de werkcultuur en de inhoudelijke eisen van het kantoor. Alle kandidaten worden op gelijke wijze beoordeeld en ervaringen worden intern geborgd.',
    { color: DARK, size: 22 })),

  // ── Overzicht
  ...sectionHeader('Overzicht van de procedure'),
  overzichtTable(),
  emptyPara(300),

  // ── Besluitvorming als card
  ...sectionHeader('Besluitvorming en afronding'),
  para(txt(
    'Na het derde gesprek vindt een intern overleg plaats tussen de partners. De volgende punten worden besproken:',
    { color: DARK, size: 22 }), { spaceAfter: 120 }),
  para([txt('•  ', { color: LIME, bold: true, size: 22 }), txt('Inhoudelijke geschiktheid (op basis van gesprek 2)', { color: DARK, size: 22 })], { indent: { left: 240 } }),
  para([txt('•  ', { color: LIME, bold: true, size: 22 }), txt('Persoonlijke fit en motivatie (op basis van gesprekken 1 en 3)', { color: DARK, size: 22 })], { indent: { left: 240 } }),
  para([txt('•  ', { color: LIME, bold: true, size: 22 }), txt('Eventuele openstaande vragen of aandachtspunten', { color: DARK, size: 22 })], { indent: { left: 240 }, spaceAfter: 200 }),

  para(txt(
    'Workx informeert de kandidaat kort na de laatste twee gesprekken over de uitkomst. Bij een positief besluit wordt een aanbod gedaan.',
    { color: DARK, size: 22 }), { spaceAfter: 200 }),

  // Uitgangspunt-card (lime achtergrond)
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          shadedCell(
            [
              para(txt('UITGANGSPUNT', { bold: true, color: LIME, size: 18 }), { spaceAfter: 80 }),
              para(txt(
                'Jaarcontract dat bij wederzijdse positieve ervaring tijdig wordt omgezet in contract voor onbepaalde tijd. In uitzonderingsgevallen kan besloten worden om direct een contract voor onbepaalde tijd aan te bieden.',
                { color: DARK, size: 22 })),
            ],
            LIME_BG,
            { borderColor: LIME, margins: { top: 250, bottom: 250, left: 300, right: 300 } }
          ),
        ],
      }),
    ],
  }),
]

const doc = new Document({
  creator: 'Workx Advocaten',
  title: 'Sollicitatiebeleid Workx',
  description: 'Selectieprocedure in drie gespreksrondes',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22 } },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: { top: 1000, bottom: 1200, left: 1100, right: 1100 },
        size: { orientation: PageOrientation.PORTRAIT },
      },
    },
    footers: {
      default: new Footer({
        children: [
          para([
            txt('Workx Advocaten  ·  Herengracht 448, 1017 CA Amsterdam  ·  +31 (0)20 308 03 20  ·  info@workxadvocaten.nl',
              { color: GRAY, size: 14 }),
          ], { alignment: AlignmentType.CENTER }),
        ],
      }),
    },
    children,
  }],
})

const buf = await Packer.toBuffer(doc)
const outPath = path.join(os.homedir(), 'Downloads', 'Workx-Sollicitatiebeleid.docx')
fs.writeFileSync(outPath, buf)
console.log('✅ Word opgeslagen:', outPath, `(${(buf.length / 1024).toFixed(1)} KB)`)
