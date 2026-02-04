import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Get all users with their work items
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        assignedWork: {
          where: {
            status: {
              in: ['NEW', 'IN_PROGRESS', 'PENDING_REVIEW']
            }
          },
          select: {
            id: true,
            estimatedHours: true,
            priority: true,
          }
        }
      }
    })

    // Calculate workload for each user
    const workload = users.map(user => {
      const totalHours = user.assignedWork.reduce((sum, item) => {
        return sum + (item.estimatedHours || 2) // Default 2 hours if not specified
      }, 0)

      // Consider priority - urgent items count more
      const priorityWeight = user.assignedWork.reduce((sum, item) => {
        const weights = { LOW: 0.5, MEDIUM: 1, HIGH: 1.5, URGENT: 2 }
        return sum + weights[item.priority as keyof typeof weights]
      }, 0)

      // Calculate workload percentage (assuming 40 hour work week)
      // Also factor in number of items and priority
      const baseWorkload = (totalHours / 40) * 100
      const itemCount = user.assignedWork.length
      const adjustedWorkload = Math.min(
        (baseWorkload * 0.6) + (itemCount * 5) + (priorityWeight * 3),
        100
      )

      return {
        id: user.id,
        name: user.name,
        items: itemCount,
        workload: Math.round(adjustedWorkload),
      }
    })

    // Sort by workload descending
    workload.sort((a, b) => b.workload - a.workload)

    // Only return users with active work
    return NextResponse.json(workload.filter(w => w.items > 0))
  } catch (error) {
    console.error('Error fetching workload:', error)
    return NextResponse.json(
      { error: 'Kon niet ophalen workload' },
      { status: 500 }
    )
  }
}
