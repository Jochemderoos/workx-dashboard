// Word-vergelijking TV ↔ variant zonder iets op te slaan.
// Zelfde look & feel als de PDF (logo, addressering, gele resultaatband).

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle,
  TextRun, AlignmentType,
} from 'docx'
import {
  fmt, buildHeader, buildTaglineAndDivider, buildTitle, buildSectionHeader,
  buildResultBand, buildDisclaimer, buildFooter, partySubtitle,
} from '@/lib/transitie-word'

interface CalcShape {
  employerName?: string | null
  employeeName: string
  startDate: string
  endDate: string
  years: number
  months: number
  days?: number
  totalSalary: number
  yearlySalary: number
  amount: number
  multiplier?: number
  clientParty?: string | null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const { base, variant } = await req.json() as { base: CalcShape; variant: CalcShape }
    if (!base || !variant) {
      return NextResponse.json({ error: 'base en variant verplicht' }, { status: 400 })
    }

    const tvMult = base.multiplier ?? 1
    const varMult = variant.multiplier ?? 1
    const tvAmount = base.amount * tvMult
    const variantAmount = variant.amount * varMult
    const diff = variantAmount - tvAmount

    const clientParty = variant.clientParty || base.clientParty
    const sub = partySubtitle(clientParty)

    // Twee-koloms vergelijkings-tabel met TV en variant
    const labelCell = (text: string) => new TableCell({
      width: { size: 28, type: WidthType.PERCENTAGE },
      shading: { fill: 'F5F5F5' },
      margins: { top: 120, bottom: 120, left: 140, right: 80 },
      children: [new Paragraph({ children: [new TextRun({ text, color: '646464', size: 18 })] })],
    })
    const dataCell = (text: string, opts: { bold?: boolean; fill?: string; color?: string } = {}) => new TableCell({
      width: { size: 36, type: WidthType.PERCENTAGE },
      shading: opts.fill ? { fill: opts.fill } : undefined,
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color || '232323', size: 20 })] })],
    })

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          shading: { fill: 'F9FF85' },
          margins: { top: 160, bottom: 160, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: '', size: 18 })] })],
        }),
        new TableCell({
          shading: { fill: 'F9FF85' },
          margins: { top: 160, bottom: 160, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: 'Transitievergoeding', bold: true, color: '232323', size: 22 })] })],
        }),
        new TableCell({
          shading: { fill: 'F9FF85' },
          margins: { top: 160, bottom: 160, left: 140, right: 140 },
          children: [new Paragraph({ children: [new TextRun({ text: varMult !== 1 ? 'Beëindigingsvergoeding' : 'Aangepaste TV', bold: true, color: '232323', size: 22 })] })],
        }),
      ],
    })

    const dataRow = (label: string, tvVal: string, varVal: string, opts: { highlight?: boolean } = {}) =>
      new TableRow({
        children: [
          labelCell(label),
          dataCell(tvVal, { bold: opts.highlight }),
          dataCell(varVal, { bold: opts.highlight, fill: opts.highlight && varMult !== 1 ? 'FDE68A' : undefined }),
        ],
      })

    const tableRows: TableRow[] = [
      headerRow,
      dataRow('Werkgever', base.employerName || '—', variant.employerName || '—'),
      dataRow('Werknemer', base.employeeName, variant.employeeName),
      dataRow('Indienstdatum', new Date(base.startDate).toLocaleDateString('nl-NL'), new Date(variant.startDate).toLocaleDateString('nl-NL')),
      dataRow('Einddatum', new Date(base.endDate).toLocaleDateString('nl-NL'), new Date(variant.endDate).toLocaleDateString('nl-NL')),
      dataRow('Dienstverband', `${base.years}j ${base.months}m${base.days ? ` ${base.days}d` : ''}`, `${variant.years}j ${variant.months}m${variant.days ? ` ${variant.days}d` : ''}`),
      dataRow('Bruto p/m', fmt(base.totalSalary), fmt(variant.totalSalary)),
      dataRow('Jaarsalaris', fmt(base.yearlySalary), fmt(variant.yearlySalary)),
      dataRow('Factor', `${tvMult}×`, `${varMult}×`),
      dataRow('Eindbedrag', fmt(tvAmount), fmt(variantAmount), { highlight: true }),
    ]

    if (diff !== 0) {
      tableRows.push(new TableRow({
        children: [
          labelCell('Verschil'),
          dataCell('—', { color: '888888' }),
          dataCell(`${diff > 0 ? '+' : ''}${fmt(diff)}`, { bold: true, color: diff > 0 ? '15803D' : 'B91C1C' }),
        ],
      }))
    }

    const comparisonTable = new Table({
      rows: tableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'E0E0E0' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'EFEFEF' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'EFEFEF' },
      },
    })

    const children: (Paragraph | Table)[] = [
      buildHeader({
        employerName: variant.employerName || base.employerName,
        employeeName: variant.employeeName || base.employeeName,
        partySubtitle: sub,
      }),
      ...buildTaglineAndDivider(),
      ...buildTitle('Vergelijking', varMult !== 1 ? 'Vergoedingen' : 'Transitievergoeding'),

      buildSectionHeader('Overzicht'),
      comparisonTable,

      buildSectionHeader('Uitkomst'),
      buildResultBand(
        varMult !== 1 ? 'Beëindigingsvergoeding' : 'Aangepaste TV',
        fmt(variantAmount),
      ),

      ...buildDisclaimer('Disclaimer: bedragen zijn indicatief. De wettelijke transitievergoeding (art. 7:673 BW) is 1/3 maandsalaris per dienstjaar. Een bedrag boven dit wettelijk minimum wordt aangeduid als beëindigingsvergoeding. Maximum 2026: € 102.000 of jaarsalaris indien hoger. Aan deze berekening kunnen geen rechten worden ontleend.'),
      ...buildFooter(),
    ]

    const doc = new Document({
      creator: 'Workx Dashboard',
      title: 'Vergelijking vergoedingen',
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children,
      }],
    })
    const buffer = await Packer.toBuffer(doc)
    const employeeSlug = (variant.employeeName || 'vergelijking').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    const fileName = `Vergelijking-vergoedingen-${employeeSlug}-${new Date().toISOString().slice(0, 10)}.docx`
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (e) {
    console.error('whatif-export failed', e)
    return NextResponse.json({ error: 'Export mislukt' }, { status: 500 })
  }
}
