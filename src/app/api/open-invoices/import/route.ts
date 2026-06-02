import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDebiteurenPDF, parseDebiteurenWord, matchAttorney } from '@/lib/parse-debiteuren-pdf'
import { notifyImport } from '@/lib/slack-import-notify'

async function requireManager() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return { error: NextResponse.json({ error: 'Geen toegang' }, { status: 403 }) }
  }
  return { session }
}

// POST - ontvangt tekst die client-side uit de PDF is gehaald (via pdfjs)
// en synchroniseert de OpenInvoice-tabel met de PDF-inhoud.
// Body: { text: string }
// Volledige replace: facturen die niet in de PDF zitten worden verwijderd
// (presumed betaald). reminderSentAt blijft behouden voor bestaande facturen.
export async function POST(req: NextRequest) {
  const guard = await requireManager()
  if (guard.error) return guard.error

  try {
    const body = await req.json()
    const text: string = typeof body?.text === 'string' ? body.text : ''
    const wordText: string = typeof body?.wordText === 'string' ? body.wordText : ''
    if (!text || text.length < 100) {
      return NextResponse.json({ error: 'Geen of te weinig tekst ontvangen' }, { status: 400 })
    }

    const parsed = parseDebiteurenPDF(text)
    if (parsed.length === 0 && !wordText) {
      return NextResponse.json({ error: 'Geen facturen gevonden in PDF (verkeerd rapport?).' }, { status: 400 })
    }

    // Word = master-bron voor welke facturen openstaan, bedragen en datums.
    // PDF = bron voor advocaat-uren-uitsplitsing per factuurnummer.
    const wordMap = wordText ? parseDebiteurenWord(wordText) : new Map()
    const pdfMap = new Map(parsed.map(p => [p.invoiceNumber, p]))

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    })

    let upserted = 0
    let removed = 0
    const newInvoiceNumbers = new Set<string>()

    // Bepaal de master-set facturen: alle in Word + alle in PDF (Word usually
    // is een superset). Voor de tweede uitzondering (alleen-PDF) blijven we
    // backward-compatible — geen Word geupload? Dan is PDF de master.
    const allInvoiceNumbers = new Set<string>([
      ...Array.from(wordMap.keys()),
      ...Array.from(pdfMap.keys()),
    ])

    for (const invoiceNumber of Array.from(allInvoiceNumbers)) {
      newInvoiceNumbers.add(invoiceNumber)
      const pdfData = pdfMap.get(invoiceNumber)
      const wordData = wordMap.get(invoiceNumber)

      // Lines uit PDF (alleen beschikbaar als factuur ook in PDF zat)
      const linesData = pdfData
        ? pdfData.lines.map(l => {
            const user = matchAttorney(l.attorneyName, users)
            return { ...l, userId: user?.id || null }
          })
        : []
      const matched = linesData.filter(l => l.userId)
      const primary = matched.length > 0
        ? matched.reduce((a, b) => (a.hours >= b.hours ? a : b))
        : null

      // Bedrag: Word is leidend (= open bedrag na deelbetalingen).
      // Voor records zonder Word: fallback op PDF totalIncl.
      const totalIncl = wordData?.openAmount ?? pdfData?.totalIncl ?? 0
      // Voor totalExcl/totalBtw: alleen uit PDF beschikbaar; anders berekenen
      const totalBtw = pdfData?.totalBtw ?? +(totalIncl * 0.21 / 1.21).toFixed(2)
      const totalExcl = pdfData?.totalExcl ?? +(totalIncl - totalBtw).toFixed(2)

      // bookYear/bookPeriod: PDF heeft Verkoopboek; anders uit Word-issueDate
      const issueDate = wordData?.issueDate ?? null
      const dueDate = wordData?.dueDate ?? null
      const bookYear = pdfData?.bookYear ?? (issueDate?.getFullYear() ?? new Date().getFullYear())
      const bookPeriod = pdfData?.bookPeriod ?? ((issueDate?.getMonth() ?? 0) + 1)

      const clientName = pdfData?.clientName || wordData?.clientName || null

      await prisma.openInvoice.upsert({
        where: { invoiceNumber },
        update: {
          bookYear,
          bookPeriod,
          projectCode: pdfData?.projectCode || null,
          projectName: pdfData?.projectName || null,
          clientName,
          issueDate,
          dueDate,
          totalExcl,
          totalIncl,
          totalBtw,
          primaryUserId: primary?.userId || null,
          reminderSentAt: null,
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
          invoiceNumber,
          bookYear,
          bookPeriod,
          projectCode: pdfData?.projectCode || null,
          projectName: pdfData?.projectName || null,
          clientName,
          issueDate,
          dueDate,
          totalExcl,
          totalIncl,
          totalBtw,
          primaryUserId: primary?.userId || null,
          reminderSentAt: null,
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

    const toRemove = await prisma.openInvoice.findMany({
      where: { invoiceNumber: { notIn: Array.from(newInvoiceNumbers) } },
      select: { id: true },
    })
    if (toRemove.length > 0) {
      await prisma.openInvoice.deleteMany({ where: { id: { in: toRemove.map(t => t.id) } } })
      removed = toRemove.length
    }

    // Slack DM naar Jochem / Hanna / Lotte (uploader uitgesloten) — niet-blokkerend
    const uploader = await prisma.user.findUnique({
      where: { id: guard.session!.user.id },
      select: { id: true, name: true },
    })
    if (uploader) {
      void notifyImport({
        uploaderId: uploader.id,
        uploaderName: uploader.name,
        type: 'debiteuren',
        summary: `${upserted} facturen bijgewerkt${removed > 0 ? `, ${removed} betaald (weg)` : ''}.`,
      })
    }

    return NextResponse.json({
      total: allInvoiceNumbers.size,
      pdfOnly: parsed.filter(p => !wordMap.has(p.invoiceNumber)).length,
      wordOnly: Array.from(wordMap.keys()).filter(inv => !pdfMap.has(inv)).length,
      upserted,
      removed,
      matchedDates: wordMap.size,
      unmatchedAttorneys: Array.from(new Set(
        parsed.flatMap(inv => inv.lines.map(l => l.attorneyName))
          .filter(name => !matchAttorney(name, users))
      )),
    })
  } catch (error) {
    console.error('Error importing open invoices:', error)
    return NextResponse.json({ error: 'Kon PDF niet verwerken' }, { status: 500 })
  }
}
