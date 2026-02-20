import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch a single development plan
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const plan = await prisma.developmentPlan.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan niet gevonden' }, { status: 404 })
    }

    // Check access: admins can see all, employees only their own
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    if (!isAdmin && plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error fetching development plan:', error)
    return NextResponse.json({ error: 'Fout bij ophalen plan' }, { status: 500 })
  }
}

// PUT - Update a development plan
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const plan = await prisma.developmentPlan.findUnique({
      where: { id: params.id },
    })

    if (!plan) {
      return NextResponse.json({ error: 'Plan niet gevonden' }, { status: 404 })
    }

    // Check access
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    if (!isAdmin && plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const { sections, status, generalNotes, evaluationDate, period, year } = body

    const updateData: Record<string, unknown> = {}

    if (sections !== undefined) {
      updateData.sections = typeof sections === 'string' ? sections : JSON.stringify(sections)
    }
    if (status !== undefined) updateData.status = status
    if (generalNotes !== undefined) updateData.generalNotes = generalNotes
    if (evaluationDate !== undefined) updateData.evaluationDate = evaluationDate ? new Date(evaluationDate) : null
    if (period !== undefined) updateData.period = period
    if (year !== undefined) updateData.year = year

    const updated = await prisma.developmentPlan.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating development plan:', error)
    return NextResponse.json({ error: 'Fout bij bijwerken plan' }, { status: 500 })
  }
}

// DELETE - Delete a development plan
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    await prisma.developmentPlan.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting development plan:', error)
    return NextResponse.json({ error: 'Fout bij verwijderen plan' }, { status: 500 })
  }
}
