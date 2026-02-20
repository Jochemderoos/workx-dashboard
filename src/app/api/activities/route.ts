import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Alle activiteiten ophalen (gedeeld, iedereen ziet alles)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const activities = await prisma.expenseActivity.findMany({
      include: {
        createdBy: { select: { id: true, name: true } },
        receipts: {
          select: { id: true, amount: true },
        },
      },
      orderBy: { date: 'desc' },
    })

    // Map met samenvatting
    const result = activities.map(a => ({
      ...a,
      receiptCount: a.receipts.length,
      totalAmount: a.receipts.reduce((sum, r) => sum + (r.amount || 0), 0),
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ error: 'Kon activiteiten niet ophalen' }, { status: 500 })
  }
}

// POST - Nieuwe activiteit aanmaken
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, date } = body

    if (!name || !date) {
      return NextResponse.json({ error: 'Naam en datum zijn verplicht' }, { status: 400 })
    }

    const activity = await prisma.expenseActivity.create({
      data: {
        name,
        description: description || null,
        date: new Date(date),
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error('Error creating activity:', error)
    return NextResponse.json({ error: 'Kon activiteit niet aanmaken' }, { status: 500 })
  }
}
