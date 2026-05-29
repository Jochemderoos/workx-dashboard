// Eenmalige post in Slack #algemeen: de eerste 'Wist je dat?' over Workx Docs.

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

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Wist je dat? — Workx Docs*\n\nIn het dashboard onder _Workx Docs_ vind je álle interne documentatie op één plek, doorzoekbaar, uitklapbaar in de sidebar en altijd up-to-date.`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `•  *The Way it Workx* — het personeelshandboek (welkom, werkplek, ontwikkelen, vakantie & verlof, ouderschapsverlof, beloning, declaraties, ...)\n` +
          `•  *Kantoorhandboek* — vakbekwaamheid, kantoororganisatie, Wwft, Stichting Derdengelden\n` +
          `•  *Klachtenregeling* — procedure bij klachten van cliënten\n` +
          `•  *Wachtwoorden* — gedeelde inloggegevens en belangrijke services\n` +
          `•  *Salarishuis* — indicatieve salarisschalen per ervaringsjaar\n` +
          `•  *Stappenplan partner* — Counsel → Director → Partner\n` +
          `•  *Know-how Office Management* — telefoonnummers, BaseNet-tips, Doxflow`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Tip: gebruik de zoekbalk in de sidebar (links bovenin) om razendsnel naar het juiste hoofdstuk te springen.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Workx Docs' },
          url: `${dashboard}/dashboard/hr-docs`,
          style: 'primary',
        },
      ],
    },
  ]

  const fallback = `Wist je dat? — Workx Docs bundelt alle interne documentatie op één plek. Open ${dashboard}/dashboard/hr-docs`
  const ok = await sendChannelMessage('workx-algemeen', fallback, blocks)
  console.log(ok ? '✅ gepost in #algemeen' : '❌ post mislukt')
}
main().catch(e => { console.error(e); process.exit(1) })
