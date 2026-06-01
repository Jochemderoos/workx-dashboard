// Office-aanwezigheid bewerken (upsert per personKey + datum).
// PUT    body: { personKey, date, status, note? }   status ∈ OFFICE|REMOTE|ABSENT
// DELETE body: { personKey, date }                  verwijdert entry (= default 'leeg')

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { OFFICE_PERSON_KEYS, canEditOffice } from '@/lib/office-team'

const VALID_STATUS = new Set(['OFFICE', 'REMOTE', 'ABSENT'])

function dateOnly(s: string): Date | null {
  // accepteert YYYY-MM-DD of ISO; geeft UTC midnight terug
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
    const personKey = String(body.personKey || '').toLowerCase()
    const date = body.date ? dateOnly(String(body.date)) : null
    const status = String(body.status || '')
    const note = body.note == null || body.note === '' ? null : String(body.note)

    if (!OFFICE_PERSON_KEYS.includes(personKey)) {
      return NextResponse.json({ error: 'Onbekende personKey' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'Ongeldige datum' }, { status: 400 })
    }
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 })
    }

    const entry = await prisma.officeAttendanceEntry.upsert({
      where: { personKey_date: { personKey, date } },
      create: { personKey, date, status, note },
      update: { status, note },
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error saving office attendance:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (!canEditOffice(session)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const personKey = String(body.personKey || '').toLowerCase()
    const date = body.date ? dateOnly(String(body.date)) : null
    if (!personKey || !date) {
      return NextResponse.json({ error: 'personKey en date verplicht' }, { status: 400 })
    }

    await prisma.officeAttendanceEntry
      .delete({ where: { personKey_date: { personKey, date } } })
      .catch(() => null) // 404 = al weg, geen probleem

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting office attendance:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
