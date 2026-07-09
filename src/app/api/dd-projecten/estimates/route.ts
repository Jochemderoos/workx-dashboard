import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all estimates
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const estimates = await prisma.dDProjectEstimate.findMany()
  return NextResponse.json(estimates)
}

// PUT - Upsert an estimate for a workload project
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { projectName, expectedHours, extraMembers, removedMembers, hidden, completed, activated } = await req.json()
  if (!projectName) {
    return NextResponse.json({ error: 'projectName is verplicht' }, { status: 400 })
  }

  // Build update/create data
  const data: Record<string, unknown> = {}
  if (expectedHours !== undefined) data.expectedHours = expectedHours || 0
  if (extraMembers !== undefined) data.extraMembers = JSON.stringify(extraMembers)
  if (removedMembers !== undefined) data.removedMembers = JSON.stringify(removedMembers)
  if (hidden !== undefined) data.hidden = hidden
  if (completed !== undefined) data.completed = completed
  if (activated !== undefined) data.activated = activated

  const estimate = await prisma.dDProjectEstimate.upsert({
    where: { projectName },
    create: {
      projectName,
      expectedHours: expectedHours || 0,
      extraMembers: extraMembers ? JSON.stringify(extraMembers) : null,
      removedMembers: removedMembers ? JSON.stringify(removedMembers) : null,
      hidden: hidden || false,
      completed: completed || false,
      activated: activated || false,
    },
    update: data,
  })

  return NextResponse.json(estimate)
}
