// Export de Verantwoordelijk-lijst als Word-document.
// Layout: per hoofdstuk een heading, daaronder tabel met taken + verantwoordelijken.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Document, Packer, Paragraph, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, TextRun } from 'docx'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!me || (me.role !== 'PARTNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const chapters = await prisma.partnerTaskChapter.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      tasks: {
        orderBy: { sortOrder: 'asc' },
        include: {
          assignments: { include: { user: { select: { name: true } } } },
        },
      },
    },
  })

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: 'Verantwoordelijk — Workx',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: `Geëxporteerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ]

  for (const chapter of chapters) {
    children.push(new Paragraph({
      text: chapter.name,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
    }))

    if (chapter.tasks.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Geen taken in dit hoofdstuk.', italics: true, color: '888888' })],
        spacing: { after: 200 },
      }))
      continue
    }

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Taak', bold: true })] })],
            shading: { fill: 'F9FF85' },
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: 'Verantwoordelijk', bold: true })] })],
            shading: { fill: 'F9FF85' },
          }),
        ],
      }),
    ]

    for (const task of chapter.tasks) {
      const names = task.assignments.length > 0
        ? task.assignments.map(a => a.user.name).join(', ')
        : '—'
      rows.push(new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: task.task })],
          }),
          new TableCell({
            children: [new Paragraph({ text: names })],
          }),
        ],
      }))
    }

    children.push(new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'D4D4D4' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E5E5' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E5E5' },
      },
    }))
  }

  const doc = new Document({
    creator: 'Workx Dashboard',
    title: 'Verantwoordelijk',
    sections: [{ children }],
  })

  const buffer = await Packer.toBuffer(doc)
  const fileName = `Verantwoordelijk-${new Date().toISOString().slice(0, 10)}.docx`

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
