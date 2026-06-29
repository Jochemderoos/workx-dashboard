// Gebruiks-statistieken — ALLEEN voor de eigenaar (Jochem).
// Logins worden bijgehouden via User.lastLoginAt/loginCount + AuditLog (action=LOGIN).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  if (session.user.email.toLowerCase() !== OWNER_EMAIL) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const now = new Date()
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, lastLoginAt: true, loginCount: true },
      orderBy: [{ lastLoginAt: { sort: 'desc', nulls: 'last' } }],
    })

    const activeLast7 = users.filter(u => u.lastLoginAt && u.lastLoginAt >= since7).length
    const neverLoggedIn = users.filter(u => !u.lastLoginAt).length
    const totalLogins = users.reduce((s, u) => s + (u.loginCount || 0), 0)

    // Logins per dag (laatste 30 dagen) uit de audit-log
    const logins = await prisma.auditLog.findMany({
      where: { action: 'LOGIN', createdAt: { gte: since30 } },
      select: { createdAt: true, userId: true },
    })
    const perDayCount = new Map<string, number>()
    const perDayUsers = new Map<string, Set<string>>()
    for (const l of logins) {
      const d = l.createdAt.toISOString().slice(0, 10)
      perDayCount.set(d, (perDayCount.get(d) || 0) + 1)
      if (!perDayUsers.has(d)) perDayUsers.set(d, new Set())
      perDayUsers.get(d)!.add(l.userId)
    }
    const perDay = Array.from(perDayCount.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count, users: perDayUsers.get(date)!.size }))

    return NextResponse.json({ users, activeLast7, neverLoggedIn, totalLogins, perDay })
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
