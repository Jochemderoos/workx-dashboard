import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST { ids: [taskId in nieuwe volgorde] } - update sortOrder voor eigen taken
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids array verplicht' }, { status: 400 })

    // Veiligheid: alleen taken van deze user
    const myTasks = await prisma.personalTask.findMany({
      where: { userId: session.user.id, id: { in: ids } },
      select: { id: true },
    })
    const allowed = new Set(myTasks.map(t => t.id))
    const filteredIds = ids.filter((id: string) => allowed.has(id))

    await prisma.$transaction(
      filteredIds.map((id: string, index: number) =>
        prisma.personalTask.update({ where: { id }, data: { sortOrder: index } })
      )
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering personal tasks:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
