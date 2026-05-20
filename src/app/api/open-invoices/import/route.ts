import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDebiteurenPDF, matchAttorney } from '@/lib/parse-debiteuren-pdf'
import { PDFParse } from 'pdf-parse'

async function requireManager() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

// POST - upload BaseNet PDF → parse + synchroniseer database
// Volledige replace: facturen die niet in nieuwe PDF zitten worden verwijderd
// (presumed betaald). reminderSentAt wordt behouden voor bestaande facturen.
export async function POST(req: NextRequest) {
  const guard = await requireManager()
  if (guard.error) return guard.error

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    }
    const ab = await file.arrayBuffer()
    const parser = new PDFParse({ data: new Uint8Array(ab) })
    const pdfData = await parser.getText()
    const parsed = parseDebiteurenPDF(pdfData.text)

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'Geen facturen gevonden in PDF (verkeerd rapport?).' }, { status: 400 })
    }

    // Match advocaten op user-id
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    // Bestaande facturen ophalen (om reminderSentAt te bewaren)
    const existing = await prisma.openInvoice.findMany({
      select: { invoiceNumber: true, reminderSentAt: true },
    })
    const existingMap = new Map(existing.map(e => [e.invoiceNumber, e.reminderSentAt]))

    let upserted = 0
    let removed = 0
    const newInvoiceNumbers = new Set<string>()

    for (const inv of parsed) {
      newInvoiceNumbers.add(inv.invoiceNumber)

      // Lines: match users + bepaal primary
      const linesData = inv.lines.map(l => {
        const user = matchAttorney(l.attorneyName, users)
        return { ...l, userId: user?.id || null }
      })
      // Primary = advocaat met meeste uren (met matched userId)
      const matched = linesData.filter(l => l.userId)
      const primary = matched.length > 0
        ? matched.reduce((a, b) => (a.hours >= b.hours ? a : b))
        : null

      const previousReminder = existingMap.get(inv.invoiceNumber) || null

      // Upsert: bestaande factuur updaten, anders nieuw
      await prisma.openInvoice.upsert({
        where: { invoiceNumber: inv.invoiceNumber },
        update: {
          bookYear: inv.bookYear,
          bookPeriod: inv.bookPeriod,
          projectCode: inv.projectCode || null,
          projectName: inv.projectName || null,
          clientName: inv.clientName || null,
          totalExcl: inv.totalExcl,
          totalIncl: inv.totalIncl,
          totalBtw: inv.totalBtw,
          primaryUserId: primary?.userId || null,
          lines: {
            deleteMany: {},
            create: linesData.map(l => ({
              attorneyName: l.attorneyName,
              userId: l.userId,
              hours: l.hours,
              hourlyRate: l.hourlyRate,
              amount: l.amount,
            })),
          },
        },
        create: {
          invoiceNumber: inv.invoiceNumber,
          bookYear: inv.bookYear,
          bookPeriod: inv.bookPeriod,
          projectCode: inv.projectCode || null,
          projectName: inv.projectName || null,
          clientName: inv.clientName || null,
          totalExcl: inv.totalExcl,
          totalIncl: inv.totalIncl,
          totalBtw: inv.totalBtw,
          primaryUserId: primary?.userId || null,
          reminderSentAt: previousReminder,
          lines: {
            create: linesData.map(l => ({
              attorneyName: l.attorneyName,
              userId: l.userId,
              hours: l.hours,
              hourlyRate: l.hourlyRate,
              amount: l.amount,
            })),
          },
        },
      })
      upserted++
    }

    // Facturen die niet meer in PDF zitten = waarschijnlijk betaald → verwijderen
    const toRemove = await prisma.openInvoice.findMany({
      where: { invoiceNumber: { notIn: Array.from(newInvoiceNumbers) } },
      select: { id: true },
    })
    if (toRemove.length > 0) {
      await prisma.openInvoice.deleteMany({ where: { id: { in: toRemove.map(t => t.id) } } })
      removed = toRemove.length
    }

    return NextResponse.json({
      total: parsed.length,
      upserted,
      removed,
      unmatchedAttorneys: Array.from(new Set(
        parsed.flatMap(inv => inv.lines.map(l => l.attorneyName))
          .filter(name => !matchAttorney(name, users))
      )),
    })
  } catch (error) {
    console.error('Error importing open invoices PDF:', error)
    return NextResponse.json({ error: 'Kon PDF niet verwerken' }, { status: 500 })
  }
}
