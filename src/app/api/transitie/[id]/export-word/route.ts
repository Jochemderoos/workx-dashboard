// Word-export van een enkele transitievergoeding — zelfde look & feel als PDF.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Document, Packer, Paragraph } from 'docx'
import {
  fmt, buildHeader, buildTaglineAndDivider, buildTitle, buildInfoStrip,
  buildSectionHeader, buildKeyValueTable, buildResultBand, buildDisclaimer,
  buildFooter, partySubtitle,
} from '@/lib/transitie-word'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const calc = await prisma.transitieCalculation.findUnique({ where: { id: params.id } })
  if (!calc) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
  if (calc.userId !== session.user.id) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  const startDate = new Date(calc.startDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
  const endDate = new Date(calc.endDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

  const mult = (calc as any).multiplier ?? 1
  const isVariant = mult !== 1
  const effectiveAmount = calc.amount * mult
  const clientParty = (calc as any).clientParty as string | null

  const bonusMonthly =
    calc.bonusType === 'fixed' ? calc.bonusFixed
    : calc.bonusType === 'average' ? ((calc.bonusYear1 + calc.bonusYear2 + calc.bonusYear3) / 3) / 12
    : 0

  const kvRows = [
    { label: 'Bruto maandsalaris', value: fmt(calc.salary) },
    { label: 'Vakantiegeld', value: calc.vacationMoney ? `${calc.vacationPercent}% (${fmt(calc.salary * (calc.vacationPercent / 100))})` : '—' },
    { label: '13e maand', value: calc.thirteenthMonth ? `Ja (${fmt(calc.salary / 12)})` : 'Nee' },
    { label: 'Bonus per maand', value: bonusMonthly > 0 ? fmt(bonusMonthly) : '—' },
    { label: 'Overige bonus (per maand)', value: calc.bonusOther ? fmt(calc.bonusOther / 12) : '—' },
    { label: 'Overwerk per maand', value: calc.overtime ? fmt(calc.overtime / 12) : '—' },
    { label: 'Overige emolumenten', value: calc.other ? fmt(calc.other / 12) : '—' },
    { label: 'Totaal bruto maandsalaris', value: fmt(calc.totalSalary), highlight: true },
    { label: 'Jaarsalaris', value: fmt(calc.yearlySalary) },
    { label: 'Pensioen-/AOW-leeftijd bereikt', value: calc.isPensionAge ? 'Ja' : 'Nee' },
  ]

  if (isVariant) {
    kvRows.push({ label: 'Factor', value: `${mult}×` })
  }

  const resultLabel = isVariant ? 'Beëindigingsvergoeding' : 'Transitievergoeding'

  const children = [
    buildHeader({
      employerName: calc.employerName,
      employeeName: calc.employeeName,
      partySubtitle: partySubtitle(clientParty),
    }),
    ...buildTaglineAndDivider(),
    ...buildTitle('Berekening van de', resultLabel),

    buildSectionHeader('Dienstverband'),
    buildInfoStrip([
      { label: 'Datum in dienst', value: startDate },
      { label: 'Datum uit dienst', value: endDate },
      { label: 'Duur', value: `${calc.years} jaar, ${calc.months} maand${(calc as any).days ? ` ${(calc as any).days} dagen` : ''}` },
    ]),

    buildSectionHeader('Salariscomponenten'),
    buildKeyValueTable(kvRows),

    new Paragraph({ spacing: { before: 200, after: 200 }, children: [] }),
    buildResultBand(resultLabel, fmt(effectiveAmount)),

    ...(isVariant ? [new Paragraph({
      spacing: { before: 120 },
      children: [],
    })] : []),

    ...(calc.notes && calc.notes.trim() ? [
      buildSectionHeader('Notitie'),
      new Paragraph({ children: [{ text: calc.notes } as any] }),
    ] : []),

    ...buildDisclaimer('Disclaimer: deze berekening is indicatief. Aan deze berekening kunnen geen rechten worden ontleend. De wettelijke transitievergoeding (art. 7:673 BW) is 1/3 maandsalaris per dienstjaar. Maximum 2026: € 102.000 of jaarsalaris indien hoger.'),
    ...buildFooter(),
  ]

  const doc = new Document({
    creator: 'Workx Dashboard',
    title: `Berekening ${resultLabel}`,
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  })
  const buffer = await Packer.toBuffer(doc)
  const employeeSlug = (calc.employeeName || 'berekening').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const docTitle = isVariant ? 'Beeindigingsvergoeding' : 'Transitievergoeding'
  const fileName = `${docTitle}-${employeeSlug}-${new Date().toISOString().slice(0, 10)}.docx`

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
