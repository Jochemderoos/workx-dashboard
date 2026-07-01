// Gebruiks-analytics — ALLEEN voor de eigenaar (Jochem).
// Anoniem: toont totalen per pagina, actieve gebruikers (aantallen), trend per
// dag en welke pagina's (bijna) niet bezocht worden. Geen namen.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  teamMenu_Algemeen, teamMenu_Werk, teamMenu_Tools, teamMenu_Docs,
  partnersMenuItems, extraMenuItems, manageMenuItems, type MenuItem,
} from '@/lib/menu-data'

const OWNER_EMAIL = 'jochem.deroos@workxadvocaten.nl'

const normPath = (h: string) => (h.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/dashboard')

function menuPages(): { path: string; label: string }[] {
  const flat: MenuItem[] = []
  const add = (items: MenuItem[]) => items.forEach(i => { flat.push(i); if (i.children) flat.push(...i.children) })
  add(teamMenu_Algemeen); add(teamMenu_Werk); add(teamMenu_Tools); add(teamMenu_Docs)
  add(partnersMenuItems); add(extraMenuItems); add(manageMenuItems)
  const map = new Map<string, string>()
  for (const it of flat) { const p = normPath(it.href); if (!map.has(p)) map.set(p, it.label) }
  return Array.from(map.entries()).map(([path, label]) => ({ path, label }))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (session.user.email.toLowerCase() !== OWNER_EMAIL) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const now = new Date()
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    // Opruimen: bewaar max 90 dagen
    await prisma.pageView.deleteMany({ where: { createdAt: { lt: since90 } } }).catch(() => {})

    const totalUsers = await prisma.user.count({ where: { isActive: true } })

    // Bezoeken laatste 30 dagen (anoniem verwerkt)
    const views = await prisma.pageView.findMany({
      where: { createdAt: { gte: since30 } },
      select: { path: true, userId: true, createdAt: true },
    })

    const pageViews = new Map<string, number>()
    const pageUsers = new Map<string, Set<string>>()
    const dayViews = new Map<string, number>()
    const dayUsers = new Map<string, Set<string>>()
    const users7 = new Set<string>()
    const users30 = new Set<string>()

    for (const v of views) {
      pageViews.set(v.path, (pageViews.get(v.path) || 0) + 1)
      if (!pageUsers.has(v.path)) pageUsers.set(v.path, new Set())
      pageUsers.get(v.path)!.add(v.userId)
      const d = v.createdAt.toISOString().slice(0, 10)
      dayViews.set(d, (dayViews.get(d) || 0) + 1)
      if (!dayUsers.has(d)) dayUsers.set(d, new Set())
      dayUsers.get(d)!.add(v.userId)
      users30.add(v.userId)
      if (v.createdAt >= since7) users7.add(v.userId)
    }

    const menu = menuPages()
    const labelOf = new Map(menu.map(m => [m.path, m.label]))

    const perPage = Array.from(pageViews.entries())
      .map(([path, count]) => ({ path, label: labelOf.get(path) || path.replace('/dashboard/', '').replace('/dashboard', 'Dashboard') || path, views: count, users: pageUsers.get(path)!.size }))
      .sort((a, b) => b.views - a.views)

    const perDay = Array.from(dayViews.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, views: count, users: dayUsers.get(date)!.size }))

    // Nooit bezocht (all-time): menupagina's zonder enige PageView
    const visitedAll = await prisma.pageView.findMany({ distinct: ['path'], select: { path: true } })
    const visitedSet = new Set(visitedAll.map(v => v.path))
    const neverVisited = menu.filter(m => !visitedSet.has(m.path))

    return NextResponse.json({
      totalUsers,
      activeLast7: users7.size,
      activeLast30: users30.size,
      totalViews30: views.length,
      perPage,
      perDay,
      neverVisited,
    })
  } catch (error) {
    console.error('Error fetching usage stats:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
