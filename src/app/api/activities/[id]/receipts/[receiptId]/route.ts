import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT - Bonnetje beschrijving/bedrag bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; receiptId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { description, amount } = body

    const data: Record<string, unknown> = {}
    if (description !== undefined) data.description = description || null
    if (amount !== undefined) data.amount = amount !== null && amount !== '' ? parseFloat(amount) : null

    const receipt = await prisma.receipt.update({
      where: { id: params.receiptId },
      data,
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(receipt)
  } catch (error) {
    console.error('Error updating receipt:', error)
    return NextResponse.json({ error: 'Kon bonnetje niet bijwerken' }, { status: 500 })
  }
}

// DELETE - Bonnetje verwijderen (eigen bonnetje of admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; receiptId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const receipt = await prisma.receipt.findUnique({
      where: { id: params.receiptId },
      select: { uploadedById: true },
    })

    if (!receipt) {
      return NextResponse.json({ error: 'Bonnetje niet gevonden' }, { status: 404 })
    }

    // Check permissie
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isUploader = receipt.uploadedById === session.user.id
    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    if (!isUploader && !isAdmin) {
      return NextResponse.json({ error: 'Geen rechten om dit bonnetje te verwijderen' }, { status: 403 })
    }

    await prisma.receipt.delete({
      where: { id: params.receiptId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting receipt:', error)
    return NextResponse.json({ error: 'Kon bonnetje niet verwijderen' }, { status: 500 })
  }
}
