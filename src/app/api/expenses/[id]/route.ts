import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch single expense declaration
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const declaration = await prisma.expenseDeclaration.findUnique({
      where: { id: params.id },
      include: {
        items: {
          orderBy: { date: 'asc' },
        },
      },
    })

    if (!declaration) {
      return NextResponse.json({ error: 'Declaratie niet gevonden' }, { status: 404 })
    }

    // Check access
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isManager = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    if (declaration.userId !== session.user.id && !isManager) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    return NextResponse.json(declaration)
  } catch (error) {
    console.error('Error fetching expense declaration:', error)
    return NextResponse.json({ error: 'Kon declaratie niet ophalen' }, { status: 500 })
  }
}

// PUT - Update expense declaration
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const declaration = await prisma.expenseDeclaration.findUnique({
      where: { id: params.id },
    })

    if (!declaration) {
      return NextResponse.json({ error: 'Declaratie niet gevonden' }, { status: 404 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })
    const isManager = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    // Only owner can edit DRAFT, managers can approve/reject
    if (declaration.userId !== session.user.id && !isManager) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const { employeeName, bankAccount, items, note, action, holdingName } = body

    // Handle manager actions
    if (isManager && action) {
      if (action === 'approve') {
        const updated = await prisma.expenseDeclaration.update({
          where: { id: params.id },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedById: session.user.id,
          },
          include: { items: true },
        })
        return NextResponse.json(updated)
      }

      if (action === 'reject') {
        const updated = await prisma.expenseDeclaration.update({
          where: { id: params.id },
          data: {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectedById: session.user.id,
            rejectionNote: body.rejectionNote,
          },
          include: { items: true },
        })
        return NextResponse.json(updated)
      }

      if (action === 'paid') {
        const updated = await prisma.expenseDeclaration.update({
          where: { id: params.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
          include: { items: true },
        })
        return NextResponse.json(updated)
      }
    }

    // Regular update (only for DRAFT status)
    if (declaration.status !== 'DRAFT' && declaration.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Kan alleen concept-declaraties bewerken' },
        { status: 400 }
      )
    }

    // Calculate total
    const totalAmount = items?.reduce((sum: number, item: any) => sum + (item.amount || 0), 0) || 0

    // Delete existing items and create new ones
    await prisma.expenseItem.deleteMany({
      where: { declarationId: params.id },
    })

    const updated = await prisma.expenseDeclaration.update({
      where: { id: params.id },
      data: {
        employeeName: employeeName || declaration.employeeName,
        bankAccount: bankAccount || declaration.bankAccount,
        holdingName: holdingName !== undefined ? (holdingName || null) : declaration.holdingName,
        totalAmount,
        note,
        status: body.submit ? 'SUBMITTED' : declaration.status,
        submittedAt: body.submit ? new Date() : declaration.submittedAt,
        items: items ? {
          create: items.map((item: any) => ({
            description: item.description,
            date: new Date(item.date),
            amount: item.amount,
            attachmentUrl: item.attachmentUrl,
            attachmentName: item.attachmentName,
          })),
        } : undefined,
      },
      include: { items: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating expense declaration:', error)
    return NextResponse.json({ error: 'Kon declaratie niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Delete expense declaration (only DRAFT)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const declaration = await prisma.expenseDeclaration.findUnique({
      where: { id: params.id },
    })

    if (!declaration) {
      return NextResponse.json({ error: 'Declaratie niet gevonden' }, { status: 404 })
    }

    if (declaration.userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    if (declaration.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Kan alleen concept-declaraties verwijderen' },
        { status: 400 }
      )
    }

    await prisma.expenseDeclaration.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting expense declaration:', error)
    return NextResponse.json({ error: 'Kon declaratie niet verwijderen' }, { status: 500 })
  }
}
