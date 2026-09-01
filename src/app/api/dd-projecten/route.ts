import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const projects = await prisma.dDProject.findMany({
    orderBy: [
      { status: 'asc' },
      { updatedAt: 'desc' },
    ],
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      },
    },
  })

  // Also fetch workload data from last 4 weeks to auto-update hours
  // This is done client-side via the workload API to keep it simple

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { name, client, description, memberIds, externalNames, expectedHours } = await req.json()
  if (!name?.trim() || !client?.trim()) {
    return NextResponse.json({ error: 'Naam en client zijn verplicht' }, { status: 400 })
  }

  const project = await prisma.dDProject.create({
    data: {
      name: name.trim(),
      client: client.trim(),
      description: description?.trim() || null,
      expectedHours: expectedHours || null,
      members: (memberIds?.length || externalNames?.length) ? {
        create: [
          ...(memberIds ?? []).map((userId: string) => ({
            userId,
            role: 'medewerker',
          })),
          // Externen (zzp'ers) hebben geen account, alleen een naam.
          ...(externalNames ?? []).map((naam: string) => ({
            externalName: naam,
            role: 'medewerker',
          })),
        ],
      } : undefined,
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      },
    },
  })

  return NextResponse.json(project, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { id, name, client, description, status, memberIds, externalNames, expectedHours } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (name !== undefined) updateData.name = name.trim()
  if (client !== undefined) updateData.client = client.trim()
  if (description !== undefined) updateData.description = description?.trim() || null
  if (expectedHours !== undefined) updateData.expectedHours = expectedHours || null
  if (status !== undefined) {
    updateData.status = status
    if (status === 'afgerond') updateData.completedAt = new Date()
    else updateData.completedAt = null
  }

  // Update members if provided — teamleden (met account) en externen (alleen
  // een naam) worden los van elkaar bijgewerkt, zodat het meesturen van de een
  // de ander niet wist.
  if (memberIds !== undefined) {
    const currentMembers = await prisma.dDProjectMember.findMany({
      where: { projectId: id, userId: { not: null } },
      select: { userId: true },
    })
    const currentIds = currentMembers.map(m => m.userId as string)
    const toAdd = (memberIds as string[]).filter(uid => !currentIds.includes(uid))
    const toRemove = currentIds.filter(uid => !(memberIds as string[]).includes(uid))

    if (toRemove.length > 0) {
      await prisma.dDProjectMember.deleteMany({
        where: { projectId: id, userId: { in: toRemove } },
      })
    }
    if (toAdd.length > 0) {
      await prisma.dDProjectMember.createMany({
        data: toAdd.map(userId => ({ projectId: id, userId, role: 'medewerker' })),
      })
    }
  }

  if (externalNames !== undefined) {
    const huidigeExternen = await prisma.dDProjectMember.findMany({
      where: { projectId: id, externalName: { not: null } },
      select: { externalName: true },
    })
    const huidigeNamen = huidigeExternen.map(m => m.externalName as string)
    const gevraagd = externalNames as string[]
    const toevoegen = gevraagd.filter(naam => !huidigeNamen.includes(naam))
    const verwijderen = huidigeNamen.filter(naam => !gevraagd.includes(naam))

    if (verwijderen.length > 0) {
      await prisma.dDProjectMember.deleteMany({
        where: { projectId: id, externalName: { in: verwijderen } },
      })
    }
    if (toevoegen.length > 0) {
      await prisma.dDProjectMember.createMany({
        data: toevoegen.map(naam => ({ projectId: id, externalName: naam, role: 'medewerker' })),
      })
    }
  }

  const project = await prisma.dDProject.update({
    where: { id },
    data: updateData,
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      },
    },
  })

  return NextResponse.json(project)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  await prisma.dDProject.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
