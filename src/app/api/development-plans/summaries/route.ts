// Genereert (en cachet) AI-samenvattingen voor de laatste 3 plannen
// van een medewerker, plus een 1-zin ontwikkelingslijn die de evolutie
// tussen die jaren beschrijft.
//
// Cache: per plan in DevelopmentPlan.aiSummary. Regen via ?refresh=true.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

function isManagerRole(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

interface PlanPayload {
  id: string
  year: number
  period: string
  itemCount: number
  categoryCounts: Record<string, number>
  summary: string | null
}

function buildPlanPrompt(period: string, items: Array<{ category: string; title: string; goals: string | null; evaluation: string | null }>): string {
  const byCat: Record<string, string[]> = {}
  for (const it of items) {
    const parts: string[] = []
    if (it.title && it.title.toLowerCase() !== 'onderdeel') parts.push(it.title)
    if (it.goals) parts.push(`Doelen: ${it.goals}`)
    if (it.evaluation) parts.push(`Evaluatie: ${it.evaluation}`)
    if (parts.length === 0) continue
    if (!byCat[it.category]) byCat[it.category] = []
    byCat[it.category].push(parts.join('\n'))
  }
  const labels: Record<string, string> = {
    'inhoud-theorie': 'Inhoud — theorie',
    'inhoud-praktijk': 'Inhoud — praktijk',
    'eigen-praktijk': 'Eigen praktijk en zaken',
    'intern': 'Intern',
  }
  const sections: string[] = []
  for (const key of ['inhoud-theorie', 'inhoud-praktijk', 'eigen-praktijk', 'intern']) {
    if (byCat[key]) sections.push(`### ${labels[key]}\n${byCat[key].join('\n\n')}`)
  }
  return sections.join('\n\n')
}

async function generatePlanSummary(client: Anthropic, period: string, planText: string): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: `Hieronder staat een persoonlijk ontwikkelplan van een advocaat voor de periode "${period}". Vat in maximaal 2 zinnen (≤35 woorden) samen waar de focus lag. Schrijf in flow-tekst (geen bullets), in het Nederlands, concreet — geen vage termen zoals "ontwikkelen" of "groeien" zonder context. Begin direct met de inhoud, geen inleiding.

${planText}`
      },
    ],
  })
  const text = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text.trim())
    .join(' ')
  return text.replace(/\s+/g, ' ').trim()
}

async function generateEvolutionLine(client: Anthropic, summaries: { year: number; summary: string }[]): Promise<string> {
  if (summaries.length < 2) return ''
  const text = summaries.map(s => `${s.year}: ${s.summary}`).join('\n')
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    messages: [
      {
        role: 'user',
        content: `Hieronder staan de samenvattingen van de laatste ${summaries.length} ontwikkelplannen van een advocaat. Beschrijf in één zin (≤25 woorden) hoe de focus zich tussen deze jaren heeft ontwikkeld. Concreet, in flow-tekst. Begin direct met de inhoud.

${text}`
      },
    ],
  })
  return res.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map(c => c.text.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeName = searchParams.get('employeeName')
  const refresh = searchParams.get('refresh') === 'true'

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true },
  })
  if (!me) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  // Toegangscontrole: medewerker mag alleen eigen plannen samenvatten;
  // PARTNER/ADMIN/OFFICE_MANAGER mag iedereen.
  let where: Record<string, unknown> = {}
  if (employeeName && isManagerRole(me.role)) {
    where = { employeeName }
  } else {
    where = { userId: me.id }
  }

  try {
    // Laatste 3 plannen (oudste→nieuwste in display, maar query nieuwste→oudste)
    const plans = await prisma.developmentPlan.findMany({
      where,
      include: { items: true },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      take: 3,
    })
    if (plans.length === 0) {
      return NextResponse.json({ plans: [], evolution: '' })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    const client = apiKey ? new Anthropic({ apiKey }) : null

    // Genereer summaries (in parallel) waar nodig.
    // Invalidatie: regen als items recenter zijn aangepast dan de cache.
    const tasks = plans.map(async (p) => {
      let summary = p.aiSummary || ''
      const latestItemUpdate = p.items.reduce<Date | null>((acc, it) => {
        const t = it.updatedAt instanceof Date ? it.updatedAt : new Date(it.updatedAt as unknown as string)
        if (!acc || t > acc) return t
        return acc
      }, null)
      const cacheStale = p.aiSummaryAt && latestItemUpdate && latestItemUpdate > p.aiSummaryAt
      const needsRegen = !summary || refresh || cacheStale
      if (needsRegen && client && p.items.length > 0) {
        try {
          const prompt = buildPlanPrompt(p.period, p.items)
          summary = await generatePlanSummary(client, p.period, prompt)
          await prisma.developmentPlan.update({
            where: { id: p.id },
            data: { aiSummary: summary, aiSummaryAt: new Date() },
          })
        } catch (err) {
          console.error('Summary generation failed for plan', p.id, err)
        }
      }

      const categoryCounts: Record<string, number> = {}
      for (const it of p.items) {
        categoryCounts[it.category] = (categoryCounts[it.category] || 0) + 1
      }

      const payload: PlanPayload = {
        id: p.id,
        year: p.year,
        period: p.period,
        itemCount: p.items.length,
        categoryCounts,
        summary: summary || null,
      }
      return payload
    })

    const summaries = await Promise.all(tasks)

    // Sorteer oplopend voor display (oudste links → nieuwste rechts)
    summaries.sort((a, b) => a.year - b.year)

    // Ontwikkelingslijn — 1 zin over evolutie
    let evolution = ''
    if (client && summaries.length >= 2) {
      const valid = summaries.filter(s => s.summary).map(s => ({ year: s.year, summary: s.summary! }))
      if (valid.length >= 2) {
        try {
          evolution = await generateEvolutionLine(client, valid)
        } catch (err) {
          console.error('Evolution-line generation failed', err)
        }
      }
    }

    return NextResponse.json({ plans: summaries, evolution })
  } catch (err) {
    console.error('summaries endpoint failed', err)
    return NextResponse.json({ error: 'Kon samenvattingen niet genereren' }, { status: 500 })
  }
}
