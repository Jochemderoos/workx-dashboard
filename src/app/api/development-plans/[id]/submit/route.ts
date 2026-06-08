// "Inleveren" — medewerker geeft aan dat het plan klaar is voor bespreking
// met de partners. Zet submittedForReviewAt, stuurt Slack naar #MT-Groot.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendChannelMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
const SLACK_CHANNEL = 'mt-groot'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const plan = await prisma.developmentPlan.findUnique({
      where: { id: params.id },
      include: { items: true, user: { select: { name: true, email: true } } },
    })
    if (!plan) return NextResponse.json({ error: 'Plan niet gevonden' }, { status: 404 })

    // Alleen eigenaar mag inleveren
    if (plan.userId !== session.user.id) {
      return NextResponse.json({ error: 'Alleen de eigenaar kan inleveren' }, { status: 403 })
    }

    if (plan.items.length === 0) {
      return NextResponse.json({ error: 'Voeg eerst items toe voordat je inlevert' }, { status: 400 })
    }

    const wasAlreadySubmitted = !!plan.submittedForReviewAt

    const updated = await prisma.developmentPlan.update({
      where: { id: params.id },
      data: {
        submittedForReviewAt: new Date(),
        // Reset reviewedAt zodat partners opnieuw moeten bespreken bij een nieuwe submit
        reviewedAt: null,
        reviewedById: null,
      },
    })

    // Slack — alleen bij eerste submit, niet bij re-submits van dezelfde periode
    if (!wasAlreadySubmitted) {
      try {
        const employeeName = plan.user?.name || plan.employeeName
        const planUrl = `${DASHBOARD_BASE}/dashboard/ontwikkelplannen`
        const itemCount = plan.items.length
        const byCategory: Record<string, number> = {}
        for (const it of plan.items) {
          byCategory[it.category] = (byCategory[it.category] || 0) + 1
        }
        const catSummary = [
          byCategory['inhoud-theorie'] ? `Inhoud theorie ${byCategory['inhoud-theorie']}` : null,
          byCategory['inhoud-praktijk'] ? `Inhoud praktijk ${byCategory['inhoud-praktijk']}` : null,
          byCategory['eigen-praktijk'] ? `Eigen praktijk ${byCategory['eigen-praktijk']}` : null,
          byCategory['intern'] ? `Intern ${byCategory['intern']}` : null,
        ].filter(Boolean).join(' · ')

        const fallback = `${employeeName} heeft het ontwikkelplan voor ${plan.year} ingevuld (${itemCount} doelen). Bespreken: ${planUrl}`
        const blocks = [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: `${employeeName} heeft het ontwikkelplan ${plan.year} ingevuld 🎯\n`, style: { bold: true } },
                  { type: 'text', text: `${itemCount} doelen — ${catSummary || 'verdeeld over categorieën'}.\n\n` },
                  { type: 'text', text: 'Tijd om het te bespreken. Het blijft op het partner-dashboard staan tot er iemand op "besproken" klikt.\n→ ' },
                  { type: 'link', url: planUrl, text: 'Open ontwikkelplan' },
                ],
              },
            ],
          },
        ]
        await sendChannelMessage(SLACK_CHANNEL, fallback, blocks as any)
      } catch (slackErr) {
        console.error('Slack send failed (submit):', slackErr)
        // niet hard falen — submit slaagt ook zonder Slack
      }
    }

    return NextResponse.json({ ok: true, plan: updated, wasAlreadySubmitted })
  } catch (err) {
    console.error('development-plan submit failed', err)
    return NextResponse.json({ error: 'Kon plan niet inleveren' }, { status: 500 })
  }
}
