// Eenmalige post in #mt-groot: Wist je dat? — overzicht van partner-pagina's & tools.

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

  const partnerPages =
    `•  *Partner agenda/notulen* — agenda, notulen en actiepunten van het maandelijkse partneroverleg.  <${dashboard}/dashboard/partners/notulen|Open>\n` +
    `•  *Verantwoordelijk* — verdeel hoofdstukken/onderwerpen over het team en publiceer het naar Wie doet Wat.  <${dashboard}/dashboard/partners/verantwoordelijk|Open>\n` +
    `•  *Werkverdelingsgesprekken* — wekelijkse 1-op-1 gesprekken partner ↔ medewerker, met notities en gespreksonderwerpen.  <${dashboard}/dashboard/partners/werkverdelingsgesprekken|Open>\n` +
    `•  *Partner werk* — eigen partner-werkoverzicht en planning op partnerniveau.  <${dashboard}/dashboard/partners/werk|Open>\n` +
    `•  *Sollicitaties* — kandidaten beheren, CV's uploaden, gesprekken plannen en het sollicitatiebeleid up-to-date houden.  <${dashboard}/dashboard/partners/sollicitaties|Open>\n` +
    `•  *Financien* — omzet, kosten, saldo en concept jaarrekening per jaar, inclusief automatische VPB-berekening.  <${dashboard}/dashboard/financien|Open>\n` +
    `•  *Kosten* — MT940-import, categoriseren van transacties en vendor-aliases voor automatische categorisatie.  <${dashboard}/dashboard/kosten|Open>`

  const tools =
    `•  *Debiteuren* — openstaande facturen per advocaat, met aanschrijven-knop. Stek/DeBrij/VanCampen Liem/JB Law zijn samengevouwen.  <${dashboard}/dashboard/debiteuren|Open>\n` +
    `•  *Bonus* — eigen omzet bijhouden en bonus per kwartaal indienen bij Hanna.  <${dashboard}/dashboard/bonus|Open>\n` +
    `•  *Arbeidsvoorwaarden* — persoonlijke coaching-budget-tracker (€1.500 ex btw / 3 jaar).  <${dashboard}/dashboard/arbeidsvoorwaarden|Open>\n` +
    `•  *Stappenplan Counsel → Director → Partner* — drie-staps groeipad onder Workx Docs.  <${dashboard}/dashboard/hr-docs?doc=stappenplan-partner|Open>`

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Wist je dat? — Partner-pagina's & tools in het dashboard*\n\nEen rondleiding door de plekken die voor jullie als partners en MT relevant zijn.`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Partner-pagina's*\n\n${partnerPages}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Ook handig voor MT*\n\n${tools}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Tip: vanuit het Overzicht (zoekbalk in de sidebar) navigeer je razendsnel naar elke pagina.`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open dashboard' },
          url: `${dashboard}/dashboard`,
          style: 'primary',
        },
      ],
    },
  ]

  const fallback = `Wist je dat? — partner-pagina's & tools in het dashboard. Open ${dashboard}/dashboard`
  const ok = await sendChannelMessage('mt-groot', fallback, blocks)
  console.log(ok ? '✅ gepost in #mt-groot' : '❌ post mislukt')
}
main().catch(e => { console.error(e); process.exit(1) })
