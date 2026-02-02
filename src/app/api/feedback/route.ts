import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all feedback (visible to everyone)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auto-delete processed items older than 5 days
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)

    await prisma.feedback.deleteMany({
      where: {
        processed: true,
        processedAt: {
          lt: fiveDaysAgo
        }
      }
    })

    const feedback = await prisma.feedback.findMany({
      include: {
        submittedBy: {
          select: { name: true }
        }
      },
      orderBy: [
        { processed: 'asc' }, // Unprocessed first
        { createdAt: 'desc' }  // Then by date
      ]
    })

    // Map to include submittedBy name
    const result = feedback.map(f => ({
      ...f,
      submittedBy: f.submittedBy.name
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }
}

// POST - Create new feedback
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, title, description } = await req.json()

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 })
    }

    const feedback = await prisma.feedback.create({
      data: {
        type: type || 'IDEA',
        title,
        description,
        submittedById: session.user.id,
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
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}
