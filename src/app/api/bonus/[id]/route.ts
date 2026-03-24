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
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const calculation = await prisma.bonusCalculation.findFirst({
      where: { id: params.id, userId: session.user.id }
    })

    if (!calculation) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error fetching bonus calculation:', error)
    return NextResponse.json({ error: 'Kon niet ophalen' }, { status: 500 })
  }
}

// PATCH - Update a bonus calculation (owner) or admin actions (submit/paid)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()

    // Check if this is an admin action
    if (body.action) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
      const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

      if (body.action === 'submit') {
        // User submits their own calculation
        const calc = await prisma.bonusCalculation.findFirst({
          where: { id: params.id, userId: session.user.id }
        })
        if (!calc) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

        const updated = await prisma.bonusCalculation.update({
          where: { id: params.id },
          data: { status: 'SUBMITTED', submittedAt: new Date() },
        })
        return NextResponse.json(updated)
      }

      if (body.action === 'paid' && isManager) {
        const updated = await prisma.bonusCalculation.update({
          where: { id: params.id },
          data: { status: 'PAID', bonusPaid: true, paidAt: new Date() },
        })
        return NextResponse.json(updated)
      }

      if (body.action === 'unpaid' && isManager) {
        const updated = await prisma.bonusCalculation.update({
          where: { id: params.id },
          data: { status: 'SUBMITTED', bonusPaid: false, paidAt: null },
        })
        return NextResponse.json(updated)
      }

      return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 })
    }

    // Normal update — owner only, only DRAFT status
    const existingCalc = await prisma.bonusCalculation.findFirst({
      where: { id: params.id, userId: session.user.id }
    })
    if (!existingCalc) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    const {
      invoiceAmount, bonusPercentage, invoicePaid, bonusPaid,
      invoiceNumber, clientName, description
    } = body

    const bonusAmount = invoiceAmount * (bonusPercentage / 100)

    const calculation = await prisma.bonusCalculation.update({
      where: { id: params.id },
      data: {
        invoiceAmount, bonusPercentage, bonusAmount,
        invoicePaid, bonusPaid, invoiceNumber, clientName, description,
      }
    })

    return NextResponse.json(calculation)
  } catch (error) {
    console.error('Error updating bonus calculation:', error)
    return NextResponse.json({ error: 'Kon niet bijwerken' }, { status: 500 })
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
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const existingCalc = await prisma.bonusCalculation.findFirst({
      where: { id: params.id, userId: session.user.id }
    })
    if (!existingCalc) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    await prisma.bonusCalculation.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bonus calculation:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen' }, { status: 500 })
  }
}
