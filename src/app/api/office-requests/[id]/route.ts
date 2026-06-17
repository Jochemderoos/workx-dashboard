// PATCH: assignee zetten / verzoek afronden / heropenen / confidential togglen.
// DELETE: alleen Office team of de aanvrager zelf.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditOffice } from '@/lib/office-team'
import { sendDirectMessage } from '@/lib/slack'

const DASHBOARD_BASE = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')

function isManager(role?: string | null): boolean {
  return role === 'PARTNER' || role === 'ADMIN' || role === 'OFFICE_MANAGER'
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  try {
    const body = await req.json()
    const existing = await prisma.officeRequest.findUnique({
      where: { id: params.id },
      include: { requester: { select: { email: true, name: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const data: Record<string, unknown> = {}
    let justCompleted = false
    let newOfficeReply: string | null = null

    if (typeof body.assigneeName === 'string') {
      if (!canEditOffice(session)) {
        return NextResponse.json({ error: 'Alleen Office-team mag toewijzen' }, { status: 403 })
      }
      data.assigneeName = body.assigneeName.trim() || null
    }

    if (typeof body.completed === 'boolean') {
      if (!canEditOffice(session)) {
        return NextResponse.json({ error: 'Alleen Office-team mag afronden' }, { status: 403 })
      }
      if (body.completed) {
        if (!existing.completedAt) justCompleted = true
        data.completedAt = new Date()
        data.completedBy = session.user.name || session.user.id
      } else {
        data.completedAt = null
        data.completedBy = null
      }
    }

    if (typeof body.officeReply === 'string') {
      if (!canEditOffice(session)) {
        return NextResponse.json({ error: 'Alleen Office-team mag reageren' }, { status: 403 })
      }
      const trimmed = body.officeReply.trim()
      if (trimmed.length === 0) {
        // Reactie wissen
        data.officeReply = null
        data.officeReplyBy = null
        data.officeReplyAt = null
      } else {
        data.officeReply = trimmed
        data.officeReplyBy = session.user.name || session.user.id
        data.officeReplyAt = new Date()
        newOfficeReply = trimmed
      }
    }

    if (typeof body.confidential === 'boolean') {
      if (!isManager(session.user.role) && existing.requesterId !== session.user.id) {
        return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
      }
      data.confidential = body.confidential
    }

    const updated = await prisma.officeRequest.update({
      where: { id: params.id },
      data,
      include: {
        requester: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    })

    // Slack-DM bij nieuwe reactie naar de aanvrager
    if (newOfficeReply && existing.requester?.email) {
      try {
        const url = `${DASHBOARD_BASE}/dashboard/office?tab=requests`
        const replyExcerpt = newOfficeReply.length > 200 ? newOfficeReply.slice(0, 200) + '…' : newOfficeReply
        const blocks = [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '💬 Reactie op je verzoek aan Office\n', style: { bold: true } },
                  { type: 'text', text: `"${existing.title}"\n\n` },
                  { type: 'text', text: replyExcerpt, style: { italic: true } },
                  { type: 'text', text: '\n\n— ' },
                  { type: 'text', text: (session.user.name || 'Office'), style: { bold: true } },
                  { type: 'text', text: '\n→ ' },
                  { type: 'link', url, text: 'Bekijk in dashboard' },
                ],
              },
            ],
          },
        ]
        const fallback = `💬 Reactie op je verzoek "${existing.title}": ${replyExcerpt}. ${url}`
        await sendDirectMessage(existing.requester.email, fallback, blocks as any)
      } catch (err) {
        console.error('Slack-DM bij reactie mislukt (non-blocking):', err)
      }
    }

    // Slack-DM bij afronden naar de aanvrager
    if (justCompleted && existing.requester?.email) {
      try {
        const url = `${DASHBOARD_BASE}/dashboard/office?tab=requests`
        const blocks = [
          {
            type: 'rich_text',
            elements: [
              {
                type: 'rich_text_section',
                elements: [
                  { type: 'text', text: '✅ Je verzoek aan Office is afgerond!\n', style: { bold: true } },
                  { type: 'text', text: `"${existing.title}"\n\n→ ` },
                  { type: 'link', url, text: 'Bekijk in dashboard' },
                ],
              },
            ],
          },
        ]
        const fallback = `✅ Je verzoek aan Office is afgerond: "${existing.title}". ${url}`
        await sendDirectMessage(existing.requester.email, fallback, blocks as any)
      } catch (err) {
        console.error('Slack-DM bij afronden mislukt (non-blocking):', err)
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('office-requests PATCH failed', err)
    return NextResponse.json({ error: 'Kon verzoek niet bijwerken' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })

  const existing = await prisma.officeRequest.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

  // Aanvrager mag eigen verzoek weghalen; Office team mag elk
  if (existing.requesterId !== session.user.id && !canEditOffice(session)) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  await prisma.officeRequest.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
