import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Iedereen ingelogd kan wijzigen — JAR-rooster is een team-tool en mensen
// ruilen onderling van beurt.
async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  return { session }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.date !== undefined) {
      const d = new Date(body.date)
      data.date = d
      data.year = d.getFullYear()
    }
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null
    const updated = await prisma.jarSession.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating JAR session:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    await prisma.jarSession.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting JAR session:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
