import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haal alle hoofdstuk overschrijvingen op voor een document
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId') || 'the-way-it-workx'

    const chapters = await prisma.hRDocumentChapter.findMany({
      where: { documentId },
      orderBy: { sortOrder: 'asc' }
    })

    return NextResponse.json(chapters, {
      headers: { 'Cache-Control': 'private, max-age=600, stale-while-revalidate=1200' }
    })
  } catch (error) {
    console.error('Error fetching HR doc chapters:', error)
    return NextResponse.json({ error: 'Kon hoofdstukken niet ophalen' }, { status: 500 })
  }
}

// POST - Sla een hoofdstuk op (create or update)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // Alleen Partners en Admin mogen bewerken
    if (session.user.role !== 'PARTNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId, chapterId, title, icon, content, sortOrder } = body

    if (!documentId || !chapterId || !title || !content) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    // Upsert - create or update
    const chapter = await prisma.hRDocumentChapter.upsert({
      where: {
        documentId_chapterId: {
          documentId,
          chapterId,
        }
      },
      update: {
        title,
        icon: icon || '📄',
        content,
        sortOrder: sortOrder || 0,
        updatedById: session.user.id,
      },
      create: {
        documentId,
        chapterId,
        title,
        icon: icon || '📄',
        content,
        sortOrder: sortOrder || 0,
        updatedById: session.user.id,
      }
    })

    return NextResponse.json(chapter)
  } catch (error) {
    console.error('Error saving HR doc chapter:', error)
    return NextResponse.json({ error: 'Kon hoofdstuk niet opslaan' }, { status: 500 })
  }
}

// DELETE - Verwijder een hoofdstuk overschrijving (terug naar default)
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    if (session.user.role !== 'PARTNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
    }

    await prisma.hRDocumentChapter.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting HR doc chapter:', error)
    return NextResponse.json({ error: 'Kon hoofdstuk niet verwijderen' }, { status: 500 })
  }
}
