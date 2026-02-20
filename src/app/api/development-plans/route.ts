import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all development plans (filtered by role)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, name: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'

    const { searchParams } = new URL(req.url)
    const employeeName = searchParams.get('employeeName')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined

    // Build where clause
    const where: Record<string, unknown> = {}

    // Non-admins can only see their own plans
    if (!isAdmin) {
      where.OR = [
        { userId: session.user.id },
        { employeeName: { contains: currentUser?.name?.split(' ')[0] || '' } },
      ]
    }

    if (employeeName) {
      where.employeeName = employeeName
    }

    if (year) {
      where.year = year
    }

    const plans = await prisma.developmentPlan.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching development plans:', error)
    return NextResponse.json({ error: 'Fout bij ophalen plannen' }, { status: 500 })
  }
}

// POST - Create a new development plan
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const { userId, employeeName, period, year, sections, status, documentUrl, documentName } = body

    if (!employeeName || !period || !year) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 })
    }

    const plan = await prisma.developmentPlan.create({
      data: {
        userId: userId || null,
        employeeName,
        period,
        year,
        sections: typeof sections === 'string' ? sections : JSON.stringify(sections || []),
        status: status || 'actief',
        documentUrl: documentUrl || null,
        documentName: documentName || null,
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error creating development plan:', error)
    return NextResponse.json({ error: 'Fout bij aanmaken plan' }, { status: 500 })
  }
}
