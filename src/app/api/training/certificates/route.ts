import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const REQUIRED_POINTS_PER_YEAR = 20

// GET - Fetch certificates and points summary
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || session.user.id
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    // Check permissions - users can only see their own, admins can see all
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    if (!isAdmin && userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch certificates for the user and year
    const certificates = await prisma.certificate.findMany({
      where: { userId, year },
      orderBy: { completedDate: 'desc' },
    })

    // Calculate total points
    const totalPoints = certificates.reduce((sum, cert) => sum + cert.points, 0)

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    })

    return NextResponse.json({
      user,
      year,
      certificates,
      totalPoints,
      requiredPoints: REQUIRED_POINTS_PER_YEAR,
      remainingPoints: Math.max(0, REQUIRED_POINTS_PER_YEAR - totalPoints),
      isComplete: totalPoints >= REQUIRED_POINTS_PER_YEAR,
    })
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json({ error: 'Failed to fetch certificates' }, { status: 500 })
  }
}

// POST - Create a new certificate (with optional OCR data)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { trainingName, provider, completedDate, points, certificateUrl, ocrRawText, note } = body

    if (!trainingName || !completedDate || points === undefined) {
      return NextResponse.json({ error: 'Training name, completed date, and points are required' }, { status: 400 })
    }

    const date = new Date(completedDate)
    const year = date.getFullYear()

    const certificate = await prisma.certificate.create({
      data: {
        userId: session.user.id,
        year,
        trainingName,
        provider,
        completedDate: date,
        points: parseFloat(points),
        certificateUrl,
        ocrProcessed: !!ocrRawText,
        ocrRawText,
        note,
      },
    })

    return NextResponse.json(certificate, { status: 201 })
  } catch (error) {
    console.error('Error creating certificate:', error)
    return NextResponse.json({ error: 'Failed to create certificate' }, { status: 500 })
  }
}

// DELETE - Delete a certificate
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Certificate ID is required' }, { status: 400 })
    }

    // Check if user owns this certificate or is admin
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    const isOwner = certificate.userId === session.user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Not authorized to delete this certificate' }, { status: 403 })
    }

    await prisma.certificate.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting certificate:', error)
    return NextResponse.json({ error: 'Failed to delete certificate' }, { status: 500 })
  }
}
