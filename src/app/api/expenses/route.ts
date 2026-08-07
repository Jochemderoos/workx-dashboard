import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageExpenses } from '@/lib/office-team'

// GET - Fetch expense declarations for current user (or all for admin/partner)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    })

    const isManager = canManageExpenses(currentUser)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const userId = searchParams.get('userId')

    // Build where clause
    const where: any = {}

    if (!isManager) {
      // Regular employees can only see their own declarations
      where.userId = session.user.id
    } else if (userId) {
      where.userId = userId
    }

    if (status) {
      where.status = status
    }

    const declarations = await prisma.expenseDeclaration.findMany({
      where,
      include: {
        items: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            description: true,
            date: true,
            amount: true,
            attachmentName: true,
            expenseType: true,
            kilometers: true,
            chargeToClient: true,
            // NOTE: attachmentUrl deliberately excluded - base64 data is too large for list responses.
            // Fetch individual declaration via GET /api/expenses/[id] to get full attachment data.
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(declarations)
  } catch (error) {
    console.error('Error fetching expense declarations:', error)
    return NextResponse.json({ error: 'Kon declaraties niet ophalen' }, { status: 500 })
  }
}

// Generate next invoice number: WX-YYYY-NNN
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `WX-${year}-`

  // Find highest existing invoice number for this year
  const latest = await prisma.expenseDeclaration.findFirst({
    where: {
      invoiceNumber: { startsWith: prefix },
    },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  })

  let nextNum = 1
  if (latest?.invoiceNumber) {
    const numPart = latest.invoiceNumber.replace(prefix, '')
    nextNum = (parseInt(numPart, 10) || 0) + 1
  }

  return `${prefix}${String(nextNum).padStart(3, '0')}`
}

// POST - Create new expense declaration
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { employeeName, bankAccount, items, note, submit, holdingName, invoiceNumber } = body

    if (!employeeName || !bankAccount) {
      return NextResponse.json(
        { error: 'Naam en rekeningnummer zijn verplicht' },
        { status: 400 }
      )
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Voeg minimaal één factuur toe' },
        { status: 400 }
      )
    }

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)

    // Auto-generate invoice number when submitting (if not manually provided)
    const finalInvoiceNumber = submit && !invoiceNumber
      ? await generateInvoiceNumber()
      : (invoiceNumber || null)

    // Create declaration with items
    const declaration = await prisma.expenseDeclaration.create({
      data: {
        userId: session.user.id,
        employeeName,
        bankAccount,
        holdingName: holdingName || null,
        invoiceNumber: finalInvoiceNumber,
        totalAmount,
        note,
        status: submit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: submit ? new Date() : null,
        items: {
          create: items.map((item: any) => ({
            description: item.description,
            date: new Date(item.date),
            amount: item.amount,
            attachmentUrl: item.attachmentUrl,
            attachmentName: item.attachmentName,
            expenseType: item.expenseType || null,
            kilometers: item.kilometers || null,
            chargeToClient: item.chargeToClient || null,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return NextResponse.json(declaration, { status: 201 })
  } catch (error) {
    console.error('Error creating expense declaration:', error)
    return NextResponse.json({ error: 'Kon declaratie niet aanmaken' }, { status: 500 })
  }
}
