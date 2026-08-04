import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseDebiteurenPDF, parseDebiteurenWord, matchAttorney } from '@/lib/parse-debiteuren-pdf'
import { notifyImport } from '@/lib/slack-import-notify'

// PDF + Word parsing kan veel facturen tegelijk verwerken — verhoog de timeout
// boven Vercel's default 10s. 5 minuten is genoeg en is het maximum voor Pro.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

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
// (presumed betaald). Voor facturen die WEL nog in de upload zitten wordt
// reminderSentAt gereset naar null — de UI rekent erop dat een nieuwe
// upload de aangeschreven-status laat vervallen zodat advocaten een
// volgende ronde aanschrijven kunnen.
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

    // Bepaal de master-set facturen: alle in Word + alle in PDF.
    const allInvoiceNumbers = new Set<string>([
      ...Array.from(wordMap.keys()),
      ...Array.from(pdfMap.keys()),
    ])

    // Bouw alle factuur-data + lines in-memory voordat we de DB raken.
    interface InvoiceData {
      invoiceNumber: string
      bookYear: number
      bookPeriod: number
      projectCode: string | null
      projectName: string | null
      clientName: string | null
      issueDate: Date | null
      dueDate: Date | null
      totalExcl: number
      totalIncl: number
      totalBtw: number
      primaryUserId: string | null
      lines: Array<{ attorneyName: string; userId: string | null; hours: number; hourlyRate: number; amount: number }>
    }
    const invoiceDataMap = new Map<string, InvoiceData>()
    for (const invoiceNumber of Array.from(allInvoiceNumbers)) {
      const pdfData = pdfMap.get(invoiceNumber)
      const wordData = wordMap.get(invoiceNumber)
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
      const totalIncl = wordData?.openAmount ?? pdfData?.totalIncl ?? 0
      const totalBtw = pdfData?.totalBtw ?? +(totalIncl * 0.21 / 1.21).toFixed(2)
      const totalExcl = pdfData?.totalExcl ?? +(totalIncl - totalBtw).toFixed(2)
      const issueDate = wordData?.issueDate ?? null
      const dueDate = wordData?.dueDate ?? null
      const bookYear = pdfData?.bookYear ?? (issueDate?.getFullYear() ?? new Date().getFullYear())
      const bookPeriod = pdfData?.bookPeriod ?? ((issueDate?.getMonth() ?? 0) + 1)
      const clientName = pdfData?.clientName || wordData?.clientName || null

      invoiceDataMap.set(invoiceNumber, {
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
        lines: linesData,
      })
    }

    // 1 query: bestaande OpenInvoices opzoeken op invoiceNumber
    const existing = await prisma.openInvoice.findMany({
      where: { invoiceNumber: { in: Array.from(allInvoiceNumbers) } },
      select: { id: true, invoiceNumber: true },
    })
    const existingByNumber = new Map(existing.map(e => [e.invoiceNumber, e.id]))

    let upserted = 0

    // Bulk: maak nieuwe OpenInvoices aan met createMany (zonder lines — die in een 2e stap)
    const toCreate = Array.from(invoiceDataMap.values()).filter(d => !existingByNumber.has(d.invoiceNumber))
    if (toCreate.length > 0) {
      await prisma.openInvoice.createMany({
        data: toCreate.map(d => ({
          invoiceNumber: d.invoiceNumber,
          bookYear: d.bookYear,
          bookPeriod: d.bookPeriod,
          projectCode: d.projectCode,
          projectName: d.projectName,
          clientName: d.clientName,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          totalExcl: d.totalExcl,
          totalIncl: d.totalIncl,
          totalBtw: d.totalBtw,
          primaryUserId: d.primaryUserId,
          reminderSentAt: null,
        })),
      })
      upserted += toCreate.length
      // Re-fetch om id's te krijgen van nieuw aangemaakte rijen
      const newRows = await prisma.openInvoice.findMany({
        where: { invoiceNumber: { in: toCreate.map(d => d.invoiceNumber) } },
        select: { id: true, invoiceNumber: true },
      })
      for (const r of newRows) existingByNumber.set(r.invoiceNumber, r.id)
    }

    // Bulk: update bestaande OpenInvoices (parallel in chunks)
    const toUpdate = Array.from(invoiceDataMap.values()).filter(d => existingByNumber.has(d.invoiceNumber))
    const CHUNK = 25
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK)
      await Promise.all(chunk.map(d => prisma.openInvoice.update({
        where: { invoiceNumber: d.invoiceNumber },
        data: {
          bookYear: d.bookYear,
          bookPeriod: d.bookPeriod,
          projectCode: d.projectCode,
          projectName: d.projectName,
          clientName: d.clientName,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
          totalExcl: d.totalExcl,
          totalIncl: d.totalIncl,
          totalBtw: d.totalBtw,
          primaryUserId: d.primaryUserId,
          // Factuur staat nog steeds open in de nieuwe upload — reset de
          // "aangeschreven"-status zodat advocaten zien dat er opnieuw actie
          // nodig kan zijn. UI verwacht dit gedrag expliciet
          // (zie comment in debiteuren/page.tsx isReminderDue / needsAction).
          reminderSentAt: null,
        },
      })))
      upserted += chunk.length
    }

    // Bulk lines: 1 deleteMany voor alle lines van betrokken facturen,
    // dan 1 createMany met alle nieuwe lines.
    const allInvoiceIds = Array.from(existingByNumber.values())
    if (allInvoiceIds.length > 0) {
      await prisma.openInvoiceLine.deleteMany({
        where: { invoiceId: { in: allInvoiceIds } },
      })
      const newLines: Array<{
        invoiceId: string; attorneyName: string; userId: string | null; hours: number; hourlyRate: number; amount: number
      }> = []
      for (const d of Array.from(invoiceDataMap.values())) {
        const invoiceId = existingByNumber.get(d.invoiceNumber)
        if (!invoiceId) continue
        for (const l of d.lines) {
          newLines.push({
            invoiceId,
            attorneyName: l.attorneyName,
            userId: l.userId,
            hours: l.hours,
            hourlyRate: l.hourlyRate,
            amount: l.amount,
          })
        }
      }
      if (newLines.length > 0) {
        await prisma.openInvoiceLine.createMany({ data: newLines })
      }
    }

    // Bulk remove: facturen die niet meer in de upload zitten (presumed betaald).
    let removed = 0
    const toRemoveResult = await prisma.openInvoice.deleteMany({
      where: { invoiceNumber: { notIn: Array.from(allInvoiceNumbers) } },
    })
    removed = toRemoveResult.count

    // Melding naar Jochem / Hanna / Lotte / Bente (uploader uitgesloten) — niet-blokkerend
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
