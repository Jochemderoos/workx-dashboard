// Slack DM naar Jochem, Hanna en Lotte wanneer iemand debiteuren of kosten upload.
// De uploader zelf krijgt geen DM. Stille fout bij ontbrekende Slack-koppeling.

import { prisma } from './prisma'
import { sendDirectMessage } from './slack'

const NOTIFY_FIRST_NAMES = ['Jochem', 'Hanna', 'Lotte']

export type ImportType = 'debiteuren' | 'kosten'

export async function notifyImport(opts: {
  uploaderId: string
  uploaderName: string
  type: ImportType
  summary: string  // korte regel: "12 facturen bijgewerkt, 3 betaald"
}): Promise<void> {
  try {
    const base = (process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app').replace(/\/$/, '')
    const url = opts.type === 'debiteuren' ? `${base}/dashboard/debiteuren` : `${base}/dashboard/kosten`
    const label = opts.type === 'debiteuren' ? 'Debiteuren' : 'Kosten'

    const recipients = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: opts.uploaderId },
        OR: NOTIFY_FIRST_NAMES.map(n => ({ name: { startsWith: n } })),
      },
      select: { id: true, email: true, name: true },
    })

    const fallback = `${label}-upload door ${opts.uploaderName} — ${opts.summary}\n${url}`
    const blocks = [
      {
        type: 'rich_text',
        elements: [
          {
            type: 'rich_text_section',
            elements: [
              { type: 'text', text: `${label}-upload door ${opts.uploaderName}\n`, style: { bold: true } },
              { type: 'text', text: `${opts.summary}\n→ ` },
              { type: 'link', url, text: `Open ${label.toLowerCase()}` },
            ],
          },
        ],
      },
    ]

    await Promise.allSettled(
      recipients.map(u => sendDirectMessage(u.email, fallback, blocks))
    )
  } catch (err) {
    console.error('notifyImport failed (non-blocking):', err)
  }
}
