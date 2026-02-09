import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET: haal bron details op
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  // All authenticated users can view sources (shared within the firm)
  const source = await prisma.aISource.findFirst({
    where: { id: params.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  // Mask credentials in response
  return NextResponse.json({
    ...source,
    credentials: source.credentials ? '***' : null,
    content: source.content ? `${source.content.slice(0, 200)}...` : null,
  })
}

// PUT: update bron
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const existing = await prisma.aISource.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  const { name, description, url, credentials, category, isActive } = await req.json()

  const data: Record<string, unknown> = {}
  if (name !== undefined) data.name = name.trim()
  if (description !== undefined) data.description = description?.trim() || null
  if (url !== undefined) data.url = url?.trim() || null
  if (credentials !== undefined) data.credentials = credentials ? JSON.stringify(credentials) : null
  if (category !== undefined) data.category = category
  if (isActive !== undefined) data.isActive = isActive

  const source = await prisma.aISource.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json({
    ...source,
    credentials: source.credentials ? '***' : null,
    content: source.content ? `[${source.content.length} tekens]` : null,
  })
}

// DELETE: verwijder bron
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const existing = await prisma.aISource.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  await prisma.aISource.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}

// POST: sync bron (herlaad content van website)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const source = await prisma.aISource.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!source) {
    return NextResponse.json({ error: 'Bron niet gevonden' }, { status: 404 })
  }

  if (source.type !== 'website' || !source.url) {
    return NextResponse.json({ error: 'Alleen website-bronnen kunnen gesynchroniseerd worden' }, { status: 400 })
  }

  try {
    const creds = source.credentials ? JSON.parse(source.credentials) : null
    const headers: Record<string, string> = {}
    if (creds?.cookie) headers['Cookie'] = creds.cookie
    if (creds?.token) headers['Authorization'] = `Bearer ${creds.token}`

    const response = await fetch(source.url, { headers })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100000)

    const updated = await prisma.aISource.update({
      where: { id: params.id },
      data: {
        content,
        lastSynced: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      contentLength: content.length,
      lastSynced: updated.lastSynced,
    })
  } catch (error) {
    console.error('Source sync error:', error)
    return NextResponse.json(
      { error: 'Synchronisatie mislukt. Controleer de URL en inloggegevens.' },
      { status: 500 }
    )
  }
}
