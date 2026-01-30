import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH - Approve or reject a vacation request (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status } = await req.json()

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const request = await prisma.vacationRequest.findUnique({
      where: { id: params.id }
    })

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Update the request
    const updatedRequest = await prisma.vacationRequest.update({
      where: { id: params.id },
      data: {
        status,
        approvedBy: session.user.id,
      }
    })

    // If approved, update used vacation days
    if (status === 'APPROVED') {
      const currentYear = new Date().getFullYear()
      await prisma.vacationDays.updateMany({
        where: {
          userId: request.userId,
          year: currentYear,
        },
        data: {
          usedDays: {
            increment: request.days
          }
        }
      })
    }

    return NextResponse.json(updatedRequest)
  } catch (error) {
    console.error('Error updating vacation request:', error)
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel a vacation request
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const request = await prisma.vacationRequest.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        status: 'PENDING', // Can only delete pending requests
      }
    })

    if (!request) {
      return NextResponse.json(
        { error: 'Request not found or cannot be deleted' },
        { status: 404 }
      )
    }

    await prisma.vacationRequest.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vacation request:', error)
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    )
  }
}
