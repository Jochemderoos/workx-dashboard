import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haal inpaklijst op voor huidige gebruiker
export async function GET() {
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

    const packlist = await prisma.lustrumPacklist.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({
      checkedItems: packlist ? JSON.parse(packlist.checkedItems) : [],
    })
  } catch (error) {
    console.error('Error fetching packlist:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Inpaklijst opslaan voor huidige gebruiker
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
    const { checkedItems } = body

    await prisma.lustrumPacklist.upsert({
      where: { userId: user.id },
      update: { checkedItems: JSON.stringify(checkedItems || []) },
      create: {
        userId: user.id,
        checkedItems: JSON.stringify(checkedItems || []),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving packlist:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
