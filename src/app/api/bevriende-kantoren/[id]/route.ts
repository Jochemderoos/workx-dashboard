import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { error: NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 }) }
  return { session }
}

const TEXT_FIELDS = ['category', 'naam', 'adres', 'plaats', 'email', 'telefoon', 'contactDaar', 'contactWorkx', 'bijzonderheden'] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    for (const f of TEXT_FIELDS) {
      if (body[f] !== undefined) {
        const v = body[f] === null || body[f] === '' ? null : String(body[f]).trim()
        data[f] = v
      }
    }
    if (body.type !== undefined && ['national', 'international'].includes(body.type)) data.type = body.type
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder
    const updated = await prisma.bevriendKantoor.update({ where: { id: params.id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating bevriend kantoor:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAuth()
  if (guard.error) return guard.error
  try {
    await prisma.bevriendKantoor.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bevriend kantoor:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
