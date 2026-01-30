import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch a single bonus calculation
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const calculation = await prisma.bonusCalculation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!calculation) {
      return NextResponse.json(
        { error: 'Calculation not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error fetching bonus calculation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calculation' },
      { status: 500 }
    )
  }
}

// PATCH - Update a bonus calculation
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      invoiceAmount,
      bonusPercentage,
      isPaid,
      invoiceNumber,
      clientName,
      description
    } = await req.json()

    // Verify ownership
    const existingCalc = await prisma.bonusCalculation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingCalc) {
      return NextResponse.json(
        { error: 'Calculation not found' },
        { status: 404 }
      )
    }

    const bonusAmount = invoiceAmount * (bonusPercentage / 100)

    const calculation = await prisma.bonusCalculation.update({
      where: { id: params.id },
      data: {
        invoiceAmount,
        bonusPercentage,
        bonusAmount,
        isPaid,
        invoiceNumber,
        clientName,
        description,
      }
    })

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error updating bonus calculation:', error)
    return NextResponse.json(
      { error: 'Failed to update calculation' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a bonus calculation
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const existingCalc = await prisma.bonusCalculation.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!existingCalc) {
      return NextResponse.json(
        { error: 'Calculation not found' },
        { status: 404 }
      )
    }

    await prisma.bonusCalculation.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bonus calculation:', error)
    return NextResponse.json(
      { error: 'Failed to delete calculation' },
      { status: 500 }
    )
  }
}
