// Eenmalige handmatige trigger: post de partneroverleg-reminder in #mt-groot.

import { readFileSync } from 'fs'
import { resolve } from 'path'
try {
  const txt = readFileSync(resolve('.env'), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[m[1]]) process.env[m[1]] = v
  }
} catch {}

async function main() {
  const { sendChannelMessage } = await import('../src/lib/slack')
  const dashboard = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'
  const notulenUrl = `${dashboard}/dashboard/partners/notulen`

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Partneroverleg maandag 10:00*\nHeb je nog agendapunten voor het overleg? Zet ze nu in het dashboard zodat ze klaar staan.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open partner agenda' },
          url: notulenUrl,
          style: 'primary',
        },
      ],
    },
  ]
  const fallback = `Partneroverleg maandag 10:00 — agendapunten? ${notulenUrl}`
  const ok = await sendChannelMessage('mt-groot', fallback, blocks)
  console.log(ok ? '✅ gepost in #mt-groot' : '❌ mislukt')
}
main().catch(e => { console.error(e); process.exit(1) })
