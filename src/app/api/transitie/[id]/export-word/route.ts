// Export een transitievergoeding-berekening als Word-document.
// Bewerkbaar bestand — handig voor advies-notities of basis voor groter advies.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun } from 'docx'

const fmt = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const calc = await prisma.transitieCalculation.findUnique({
    where: { id: params.id },
  })
  if (!calc) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  if (calc.userId !== session.user.id) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const startDate = new Date(calc.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const endDate = new Date(calc.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  const cell = (text: string, bold = false, shading?: string) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    ...(shading ? { shading: { fill: shading } } : {}),
  })

  const tableSimple = (rows: [string, string][]) => new Table({
    rows: rows.map(([k, v]) => new TableRow({
      children: [
        cell(k),
        cell(v, true),
      ],
    })),
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

  const mult = (calc as any).multiplier ?? 1
  const isBeeindigingsvergoeding = mult !== 1
  const docTitle = isBeeindigingsvergoeding ? 'Beëindigingsvergoeding' : 'Transitievergoeding'

  const clientParty = (calc as any).clientParty as string | null
  const partySubtitle =
    clientParty === 'werknemer' ? 'Berekening opgesteld ten behoeve van de werknemer' :
    clientParty === 'werkgever' ? 'Berekening opgesteld ten behoeve van de werkgever' :
    clientParty === 'beide' ? 'Berekening voor beide partijen' :
    null

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: `Berekening ${docTitle.toLowerCase()}`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Workx Advocaten — ', color: '888888' }),
        new TextRun({ text: new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), color: '888888' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: partySubtitle ? 120 : 400 },
    }),
    ...(partySubtitle ? [new Paragraph({
      children: [new TextRun({ text: partySubtitle, italics: true, color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })] : []),

    new Paragraph({ text: 'Partijen', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } }),
    tableSimple([
      ['Werkgever', calc.employerName || '—'],
      ['Werknemer', calc.employeeName],
    ]),

    new Paragraph({ text: 'Dienstverband', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
    tableSimple([
      ['Indienstdatum', startDate],
      ['Einddatum', endDate],
      ['Duur', `${calc.years} jaar, ${calc.months} maand${(calc as any).days ? `, ${(calc as any).days} dag(en)` : ''}`],
      ['Pensioen-/AOW-leeftijd bereikt', calc.isPensionAge ? 'Ja' : 'Nee'],
    ]),

    new Paragraph({ text: 'Salaris (bruto per maand)', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
    tableSimple([
      ['Basissalaris', fmt(calc.salary)],
      ['Vakantiegeld', calc.vacationMoney ? `${calc.vacationPercent}% (${fmt(calc.salary * (calc.vacationPercent / 100))})` : '—'],
      ['13e maand', calc.thirteenthMonth ? fmt(calc.salary / 12) : '—'],
      ['Bonus', calc.bonusType === 'fixed' ? fmt(calc.bonusFixed) : calc.bonusType === 'average' ? fmt(((calc.bonusYear1 + calc.bonusYear2 + calc.bonusYear3) / 3) / 12) : '—'],
      ['Overige bonus (gemiddeld)', calc.bonusOther ? fmt(calc.bonusOther / 12) : '—'],
      ['Overwerk (gemiddeld)', calc.overtime ? fmt(calc.overtime / 12) : '—'],
      ['Overige toeslagen', calc.other ? fmt(calc.other / 12) : '—'],
      ['Totaal bruto per maand', fmt(calc.totalSalary)],
      ['Jaarsalaris (12× maandloon)', fmt(calc.yearlySalary)],
    ]),

    new Paragraph({ text: 'Wettelijke transitievergoeding', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
    tableSimple([
      ['Vergoeding vóór maximum', fmt(calc.amountBeforeMax)],
      ['Toegepast maximum (wettelijk)', fmt(calc.amount)],
      ...((calc as any).multiplier && (calc as any).multiplier !== 1 ? [
        ['Factor / opslag', `${(calc as any).multiplier}×`] as [string, string],
        ['Eindbedrag (na factor)', fmt(calc.amount * (calc as any).multiplier)] as [string, string],
      ] : []),
    ]),
  ]

  if (calc.notes && calc.notes.trim()) {
    children.push(
      new Paragraph({ text: 'Notitie', heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 } }),
      new Paragraph({ text: calc.notes, spacing: { after: 200 } }),
    )
  }

  children.push(
    new Paragraph({ text: '', spacing: { before: 400 } }),
    new Paragraph({
      children: [new TextRun({
        text: 'Disclaimer: Deze berekening is indicatief, gebaseerd op de wettelijke regeling per 1 januari 2020. Maximum 2026: € 102.000 of jaarsalaris inclusief emolumenten — het hoogste van beide.',
        italics: true,
        size: 18,
        color: '888888',
      })],
    }),
  )

  const doc = new Document({
    creator: 'Workx Dashboard',
    title: 'Berekening transitievergoeding',
    sections: [{ children }],
  })
  const buffer = await Packer.toBuffer(doc)
  const employeeSlug = (calc.employeeName || 'berekening').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const fileName = `Transitievergoeding-${employeeSlug}-${new Date().toISOString().slice(0, 10)}.docx`

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
