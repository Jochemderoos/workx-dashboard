// Kantoortelefoon-regeling per dag (upsert).
// PUT body: { date, mode, forwardTo?, coverBy?, note? }
//   mode: 'AUTO' | 'FORWARD' | 'COVER' | 'CENTRALE'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditOffice } from '@/lib/office-team'

const VALID_MODE = new Set(['AUTO', 'FORWARD', 'COVER', 'CENTRALE'])

function dateOnly(s: string): Date | null {
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canEditOffice(session)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const date = body.date ? dateOnly(String(body.date)) : null
    const mode = String(body.mode || 'AUTO')
    const forwardTo = body.forwardTo == null || body.forwardTo === '' ? null : String(body.forwardTo)
    const coverBy = body.coverBy == null || body.coverBy === '' ? null : String(body.coverBy)
    const note = body.note == null || body.note === '' ? null : String(body.note)
    const infoboxBy = body.infoboxBy == null || body.infoboxBy === '' ? null : String(body.infoboxBy)

    if (!date) return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
    if (!VALID_MODE.has(mode)) return NextResponse.json({ error: 'Ongeldige mode' }, { status: 400 })

    const entry = await prisma.officePhoneDay.upsert({
      where: { date },
      create: { date, mode, forwardTo, coverBy, note, infoboxBy },
      update: { mode, forwardTo, coverBy, note, infoboxBy },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error saving office phone setting:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
