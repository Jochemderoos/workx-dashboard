// Word-export van een transitie-vergelijking (2 of 3 berekeningen naast elkaar).
// POST body: { ids: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun } from 'docx'

const fmt = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const { ids } = await req.json() as { ids: string[] }
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 3) {
      return NextResponse.json({ error: 'Selecteer 2 of 3 berekeningen' }, { status: 400 })
    }

    const calcs = await prisma.transitieCalculation.findMany({
      where: { id: { in: ids }, userId: session.user.id },
    })
    if (calcs.length < 2) {
      return NextResponse.json({ error: 'Berekeningen niet gevonden of geen toegang' }, { status: 404 })
    }

    // Sorteer in volgorde van ids
    const ordered = ids.map(id => calcs.find(c => c.id === id)).filter(Boolean) as typeof calcs
    const cols = ordered.length
    const effective = (c: typeof ordered[0]) => c.amount * ((c as any).multiplier ?? 1)
    const maxAmount = Math.max(...ordered.map(effective))

    const cell = (text: string, opts: { bold?: boolean; shading?: string; color?: string } = {}) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, color: opts.color })] })],
      ...(opts.shading ? { shading: { fill: opts.shading } } : {}),
    })

    // Maakt een rij met label-cell + n waarde-cells
    const row = (label: string, values: string[], opts: { bold?: boolean; shadeLabel?: string } = {}) => new TableRow({
      children: [
        cell(label, { bold: true, shading: opts.shadeLabel || 'F5F5F5' }),
        ...values.map(v => cell(v, { bold: opts.bold })),
      ],
    })

    // Hoofd-tabel: 1 label-kolom + N data-kolommen
    const header = new TableRow({
      tableHeader: true,
      children: [
        cell('', { shading: 'F9FF85' }),
        ...ordered.map(c => cell(c.employeeName || '—', { bold: true, shading: 'F9FF85' })),
      ],
    })

    const dataRows: TableRow[] = [
      header,
      row('Werkgever', ordered.map(c => c.employerName || '—')),
      row('Dienstverband', ordered.map(c => `${c.years}j ${c.months}m`)),
      row('Indienstdatum', ordered.map(c => new Date(c.startDate).toLocaleDateString('nl-NL'))),
      row('Einddatum', ordered.map(c => new Date(c.endDate).toLocaleDateString('nl-NL'))),
      row('Basissalaris p/m', ordered.map(c => fmt(c.salary))),
      row('Vakantiegeld', ordered.map(c => c.vacationMoney ? `${c.vacationPercent}%` : '—')),
      row('13e maand', ordered.map(c => c.thirteenthMonth ? 'Ja' : '—')),
      row('Bonus', ordered.map(c =>
        c.bonusType === 'fixed' ? fmt(c.bonusFixed)
        : c.bonusType === 'average' ? `Avg ${fmt(((c.bonusYear1 + c.bonusYear2 + c.bonusYear3) / 3))}/j`
        : '—',
      )),
      row('Overwerk p/j', ordered.map(c => c.overtime ? fmt(c.overtime) : '—')),
      row('Totaal bruto p/m', ordered.map(c => fmt(c.totalSalary)), { bold: true }),
      row('Jaarsalaris', ordered.map(c => fmt(c.yearlySalary)), { bold: true }),
      row('Wettelijke vergoeding', ordered.map(c => fmt(c.amount))),
      row('Factor', ordered.map(c => `${(c as any).multiplier ?? 1}×`)),
      // Highlight-rij voor het eindbedrag (na multiplier)
      new TableRow({
        children: [
          cell('Eindbedrag', { bold: true, shading: 'EDE9FE' }),
          ...ordered.map(c => cell(fmt(effective(c)), {
            bold: true,
            shading: effective(c) === maxAmount && ordered.length > 1 ? 'D8B4FE' : 'EDE9FE',
          })),
        ],
      }),
    ]

    const comparisonTable = new Table({
      rows: dataRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EFEFEF' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EFEFEF' },
      },
    })

    const children: (Paragraph | Table)[] = [
      new Paragraph({
        text: 'Vergelijking transitievergoedingen',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'Workx Advocaten — ', color: '888888' }),
          new TextRun({ text: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), color: '888888' }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
      comparisonTable,
    ]

    // Notities per berekening
    const withNotes = ordered.filter(c => c.notes && c.notes.trim())
    if (withNotes.length > 0) {
      children.push(
        new Paragraph({ text: 'Notities', heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 100 } }),
      )
      for (const c of withNotes) {
        children.push(
          new Paragraph({ children: [new TextRun({ text: c.employeeName || '—', bold: true })], spacing: { before: 100, after: 50 } }),
          new Paragraph({ text: c.notes || '', spacing: { after: 100 } }),
        )
      }
    }

    children.push(
      new Paragraph({ text: '', spacing: { before: 400 } }),
      new Paragraph({
        children: [new TextRun({
          text: `Vergelijking van ${ordered.length} berekeningen. Disclaimer: bedragen zijn indicatief, gebaseerd op de wettelijke regeling per 1 januari 2020. Maximum 2026: € 102.000 of jaarsalaris inclusief emolumenten — het hoogste van beide.`,
          italics: true,
          size: 18,
          color: '888888',
        })],
      }),
    )

    const doc = new Document({
      creator: 'Workx Dashboard',
      title: 'Vergelijking transitievergoedingen',
      sections: [{ children }],
    })
    const buffer = await Packer.toBuffer(doc)
    const fileName = `Vergelijking-transitie-${new Date().toISOString().slice(0, 10)}.docx`

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error('[transitie/compare-export] mislukt:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
