import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper function to check admin/partner role
async function checkEditAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  return user?.role === 'ADMIN' || user?.role === 'PARTNER'
}

// GET all budgets - toegankelijk voor alle ingelogde gebruikers
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const budgets = await prisma.budget.findMany({
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(budgets)
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json({ error: 'Kon niet ophalen budgets' }, { status: 500 })
  }
}

// POST create new budget - alleen voor ADMIN/PARTNER
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  if (!await checkEditAccess(session.user.id)) {
    return NextResponse.json({ error: 'Geen toegang om budgetten aan te maken' }, { status: 403 })
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
    return NextResponse.json({ error: 'Kon niet aanmaken budget' }, { status: 500 })
  }
}
