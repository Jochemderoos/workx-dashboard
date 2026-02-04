import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all bonus calculations for the current user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const calculations = await prisma.bonusCalculation.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(calculations)
  } catch (error) {
    console.error('Error fetching bonus calculations:', error)
    return NextResponse.json({ error: 'Kon niet ophalen calculations' }, { status: 500 })
  }
}

// POST - Create a new bonus calculation
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { invoiceAmount, bonusPercentage, invoicePaid, bonusPaid, invoiceNumber, clientName, description } = await req.json()

    if (!invoiceAmount || !bonusPercentage) {
      return NextResponse.json({ error: 'Invoice amount and bonus percentage are required' }, { status: 400 })
    }

    const bonusAmount = invoiceAmount * (bonusPercentage / 100)
    const calculation = await prisma.bonusCalculation.create({
      data: {
        userId: session.user.id,
        invoiceAmount,
        bonusPercentage,
        bonusAmount,
        invoicePaid: invoicePaid || false,
        bonusPaid: bonusPaid || false,
        invoiceNumber,
        clientName,
        description,
      }
    })
    return NextResponse.json(calculation, { status: 201 })
  } catch (error) {
    console.error('Error creating bonus calculation:', error)
    return NextResponse.json({ error: 'Kon niet aanmaken calculation' }, { status: 500 })
  }
}
