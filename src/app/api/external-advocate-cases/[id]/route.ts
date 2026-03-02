import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withRateLimit } from '@/lib/rate-limiter'

// PUT - Case bijwerken
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = withRateLimit(req, { maxRequests: 30, windowMs: 60000, keyPrefix: 'ext-advocate' })
    if (limited) return limited

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== 'PARTNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()

    const updateData: Record<string, unknown> = {}

    if (body.dossiernaam !== undefined) updateData.dossiernaam = body.dossiernaam
    if (body.contactpersoonNaam !== undefined) updateData.contactpersoonNaam = body.contactpersoonNaam || null
    if (body.beschrijving !== undefined) updateData.beschrijving = body.beschrijving || null
    if (body.verwachteUrenPerWeek !== undefined) updateData.verwachteUrenPerWeek = body.verwachteUrenPerWeek

    if (body.isCompleted !== undefined) {
      updateData.isCompleted = body.isCompleted
      if (body.isCompleted) {
        updateData.completedAt = new Date()
      } else {
        updateData.completedAt = null
      }
    }

    const updated = await prisma.externalAdvocateCase.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating external advocate case:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Case verwijderen
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const limited = withRateLimit(req, { maxRequests: 10, windowMs: 60000, keyPrefix: 'ext-advocate-del' })
    if (limited) return limited

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = session.user as { role?: string }
    if (user.role !== 'PARTNER' && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { id } = await params

    await prisma.externalAdvocateCase.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting external advocate case:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
