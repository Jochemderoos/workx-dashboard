import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET all budgets
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const budgets = await prisma.budget.findMany({
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(budgets)
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

// POST create new budget
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, budget, spent = 0 } = body

    if (!name || budget === undefined) {
      return NextResponse.json({ error: 'Name and budget are required' }, { status: 400 })
    }

    const newBudget = await prisma.budget.create({
      data: {
        name,
        budget: parseFloat(budget),
        spent: parseFloat(spent)
      }
    })

    return NextResponse.json(newBudget)
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 })
  }
}
