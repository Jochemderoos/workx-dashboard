import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Helper function to check admin/partner role
async function checkFinancialAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true }
  })
  return user?.role === 'ADMIN' || user?.role === 'PARTNER'
}

// PATCH update budget - alleen voor ADMIN/PARTNER
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  if (!await checkFinancialAccess(session.user.id)) {
    return NextResponse.json({ error: 'Geen toegang tot financiele gegevens' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, budget, spent } = body

    const updateData: { name?: string; budget?: number; spent?: number } = {}
    if (name !== undefined) updateData.name = name
    if (budget !== undefined) updateData.budget = parseFloat(budget)
    if (spent !== undefined) updateData.spent = parseFloat(spent)

    const updated = await prisma.budget.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating budget:', error)
    return NextResponse.json({ error: 'Kon niet bijwerken budget' }, { status: 500 })
  }
}

// DELETE budget - alleen voor ADMIN/PARTNER
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  if (!await checkFinancialAccess(session.user.id)) {
    return NextResponse.json({ error: 'Geen toegang tot financiele gegevens' }, { status: 403 })
  }

  try {
    await prisma.budget.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return NextResponse.json({ error: 'Kon niet verwijderen budget' }, { status: 500 })
  }
}
