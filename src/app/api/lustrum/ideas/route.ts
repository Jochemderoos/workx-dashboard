import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Alle ideeën ophalen (alleen PARTNER en ADMIN)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    // Alleen PARTNER en ADMIN mogen alle ideeën zien
    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const ideas = await prisma.lustrumIdea.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(ideas)
  } catch (error) {
    console.error('Error fetching ideas:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Idee insturen (iedereen mag)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
    }

    const body = await request.json()
    const { content, isAnonymous } = body

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Idee mag niet leeg zijn' }, { status: 400 })
    }

    if (content.length > 500) {
      return NextResponse.json({ error: 'Idee mag maximaal 500 tekens zijn' }, { status: 400 })
    }

    const idea = await prisma.lustrumIdea.create({
      data: {
        content: content.trim(),
        submittedBy: isAnonymous ? 'Anoniem' : user.name,
        isAnonymous: isAnonymous || false,
      },
    })

    return NextResponse.json(idea)
  } catch (error) {
    console.error('Error creating idea:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
