import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch expense declarations for current user (or all for admin/partner)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isManager = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

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

// POST - Create new expense declaration
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { employeeName, bankAccount, items, note, submit, holdingName } = body

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

    // Create declaration with items
    const declaration = await prisma.expenseDeclaration.create({
      data: {
        userId: session.user.id,
        employeeName,
        bankAccount,
        holdingName: holdingName || null,
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
