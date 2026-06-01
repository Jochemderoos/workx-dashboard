// Omzet-classificatie per klant: werknemer- of werkgeverszaak.
// GET ?year=2025 → totaal per type + lijst per klant (gesorteerd op omzet desc)
// PATCH { clientKey, displayName, type } → handmatige override opslaan

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  extractClientLhs, heuristicType, normalizeClientKey,
  type ClientType, type ClassifiedClient,
} from '@/lib/client-type-heuristic'

function canAccess(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canAccess(session.user.role)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const year = parseInt(new URL(req.url).searchParams.get('year') || '2025', 10)
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Ongeldig jaar' }, { status: 400 })
    }

    const invoices = await prisma.openInvoice.findMany({
      where: { bookYear: year },
      select: { projectName: true, clientName: true, totalExcl: true },
    })

    const overrides = await prisma.clientClassification.findMany()
    const overrideMap = new Map<string, { type: ClientType; displayName: string }>()
    for (const o of overrides) {
      overrideMap.set(o.clientKey, { type: o.type as ClientType, displayName: o.displayName })
    }

    // Aggregate per client-key.
    const acc = new Map<string, ClassifiedClient>()
    for (const inv of invoices) {
      const lhs = extractClientLhs(inv.projectName) || extractClientLhs(inv.clientName)
      const display = (lhs || inv.clientName || inv.projectName || '(onbekend)').trim()
      const key = normalizeClientKey(display)
      const override = overrideMap.get(key)
      const type: ClientType = override?.type ?? heuristicType(display)
      const finalDisplay = override?.displayName || display
      const existing = acc.get(key)
      if (existing) {
        existing.totalExcl += inv.totalExcl
        existing.invoiceCount += 1
      } else {
        acc.set(key, {
          clientKey: key,
          displayName: finalDisplay,
          type,
          isManual: !!override,
          totalExcl: inv.totalExcl,
          invoiceCount: 1,
        })
      }
    }

    const clients = Array.from(acc.values()).sort((a, b) => b.totalExcl - a.totalExcl)
    const totals = clients.reduce(
      (s, c) => {
        if (c.type === 'WERKNEMER') { s.werknemer += c.totalExcl; s.werknemerCount += c.invoiceCount }
        else { s.werkgever += c.totalExcl; s.werkgeverCount += c.invoiceCount }
        return s
      },
      { werknemer: 0, werkgever: 0, werknemerCount: 0, werkgeverCount: 0 }
    )

    return NextResponse.json({
      year,
      totals: {
        ...totals,
        total: totals.werknemer + totals.werkgever,
        invoices: invoices.length,
        uniqueClients: clients.length,
      },
      clients,
    })
  } catch (error) {
    console.error('Error in omzet-classificatie:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  if (!canAccess(session.user.role)) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })

  try {
    const body = await req.json()
    const clientKey = typeof body.clientKey === 'string' ? body.clientKey.trim() : ''
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
    const type = body.type
    if (!clientKey || !displayName) {
      return NextResponse.json({ error: 'clientKey en displayName verplicht' }, { status: 400 })
    }
    if (type !== 'WERKNEMER' && type !== 'WERKGEVER' && type !== null) {
      return NextResponse.json({ error: 'type moet WERKNEMER, WERKGEVER of null' }, { status: 400 })
    }

    // type === null → verwijder override (gebruik heuristiek weer)
    if (type === null) {
      await prisma.clientClassification.deleteMany({ where: { clientKey } })
      return NextResponse.json({ ok: true, removed: true })
    }

    const saved = await prisma.clientClassification.upsert({
      where: { clientKey },
      create: { clientKey, displayName, type, updatedById: session.user.id },
      update: { displayName, type, updatedById: session.user.id },
    })
    return NextResponse.json(saved)
  } catch (error) {
    console.error('Error patching client classification:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
