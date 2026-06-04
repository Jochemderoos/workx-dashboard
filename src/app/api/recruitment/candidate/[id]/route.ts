import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH — partner/admin bewerkt approach-metadata (status, by-whom, notes,
// netwerk-owner). Geen wijziging aan de inhoudelijke kandidaat-data.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  })
  if (!me || (me.role !== 'PARTNER' && me.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  const body = await req.json()
  const {
    name,
    experienceYear,
    currentOffice,
    linkedinUrl,
    inNetwork,
    notes,
    approachStatus,
    approachedBy,
    approachNotes,
    networkOwner,
  } = body as {
    name?: string
    experienceYear?: number | null
    currentOffice?: string | null
    linkedinUrl?: string | null
    inNetwork?: boolean
    notes?: string | null
    approachStatus?: string | null
    approachedBy?: string | null
    approachNotes?: string | null
    networkOwner?: string | null
  }

  const updated = await prisma.recruitmentCandidate.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && name.trim() ? { name: name.trim() } : {}),
      ...(experienceYear !== undefined ? { experienceYear: experienceYear } : {}),
      ...(currentOffice !== undefined ? { currentOffice: currentOffice || null } : {}),
      ...(linkedinUrl !== undefined ? { linkedinUrl: linkedinUrl || null } : {}),
      ...(inNetwork !== undefined ? { inNetwork } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(approachStatus !== undefined ? { approachStatus: approachStatus || null } : {}),
      ...(approachedBy !== undefined ? { approachedBy: approachedBy || null } : {}),
      ...(approachNotes !== undefined ? { approachNotes: approachNotes || null } : {}),
      ...(networkOwner !== undefined ? { networkOwner: networkOwner || null } : {}),
    },
  })

  return NextResponse.json(updated)
}
