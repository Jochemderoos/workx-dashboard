import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — content ophalen voor een policy-key
export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const policy = await prisma.editablePolicy.findUnique({ where: { key: params.key } })
    if (!policy) return NextResponse.json({ error: 'Policy niet gevonden' }, { status: 404 })
    let content: unknown
    try {
      content = JSON.parse(policy.content)
    } catch {
      content = policy.content
    }
    return NextResponse.json({ key: policy.key, content, updatedAt: policy.updatedAt, updatedBy: policy.updatedBy })
  } catch (error) {
    console.error('Error fetching policy:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT — content updaten (alleen PARTNER/ADMIN)
export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  if (!user || !['PARTNER', 'ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Geen toegang — alleen partner/admin kan beleid wijzigen' }, { status: 403 })
  }
  try {
    const body = await req.json()
    if (body.content === undefined) {
      return NextResponse.json({ error: 'content is verplicht' }, { status: 400 })
    }
    const contentStr = typeof body.content === 'string' ? body.content : JSON.stringify(body.content)
    const policy = await prisma.editablePolicy.upsert({
      where: { key: params.key },
      update: { content: contentStr, updatedBy: session.user.id },
      create: { key: params.key, content: contentStr, updatedBy: session.user.id },
    })
    let content: unknown
    try { content = JSON.parse(policy.content) } catch { content = policy.content }
    return NextResponse.json({ key: policy.key, content, updatedAt: policy.updatedAt })
  } catch (error) {
    console.error('Error updating policy:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
