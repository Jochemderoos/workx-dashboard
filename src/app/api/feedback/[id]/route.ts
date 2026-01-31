import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Update feedback status (admin/partner only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status, response } = await req.json()

    const feedback = await prisma.feedback.update({
      where: { id: params.id },
      data: {
        status,
        response,
      },
      include: {
        submittedBy: {
          select: { name: true }
        }
      }
    })

    return NextResponse.json({
      ...feedback,
      submittedBy: feedback.submittedBy.name
    })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 })
  }
}

// DELETE - Delete feedback (admin/partner only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'PARTNER'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.feedback.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 })
  }
}
