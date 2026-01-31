import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEV_USER } from '@/lib/dev-auth'

// GET - Fetch all bonus calculations
export async function GET(req: NextRequest) {
  try {
    const calculations = await prisma.bonusCalculation.findMany({
      where: { userId: DEV_USER.id },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(calculations)
  } catch (error) {
    console.error('Error fetching bonus calculations:', error)
    return NextResponse.json({ error: 'Failed to fetch calculations' }, { status: 500 })
  }
}

// POST - Create a new bonus calculation
export async function POST(req: NextRequest) {
  try {
    const { invoiceAmount, bonusPercentage, invoicePaid, bonusPaid, invoiceNumber, clientName, description } = await req.json()

    if (!invoiceAmount || !bonusPercentage) {
      return NextResponse.json({ error: 'Invoice amount and bonus percentage are required' }, { status: 400 })
    }

    const bonusAmount = invoiceAmount * (bonusPercentage / 100)
    const calculation = await prisma.bonusCalculation.create({
      data: {
        userId: DEV_USER.id,
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
    return NextResponse.json({ error: 'Failed to create calculation' }, { status: 500 })
  }
}
