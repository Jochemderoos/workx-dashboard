// Test: stuurt een eenmalig Slack-DM aan Jochem zodat hij ziet hoe een
// partneroverleg-reminder eruit komt te zien (incl. afzendernaam + icoon).
// Uitvoeren: npx tsx scripts/test-slack-dm-jochem.ts

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Minimale .env loader — laad eerst, dan dynamic-import van slack-lib zodat
// de WebClient een correct token oppikt.
try {
  const envPath = resolve(process.cwd(), '.env')
  const txt = readFileSync(envPath, 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i)
    if (!m) continue
    const k = m[1]
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  // .env mag ontbreken; we proberen alsnog
}

const TO = 'jochem.deroos@workxadvocaten.nl'
const DASHBOARD = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

async function main() {
  const { sendDirectMessage, testSlackConnection } = await import('../src/lib/slack')
  if (!process.env.SLACK_BOT_TOKEN) {
    console.error('Geen SLACK_BOT_TOKEN in env — afbreken')
    process.exit(1)
  }

  const conn = await testSlackConnection()
  console.log('Slack-verbinding:', conn)

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🎯 TEST — Partneroverleg maandag 10:00', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Heb je nog agendapunten voor het partneroverleg van maandag? Zet ze nu in het dashboard zodat ze klaar staan.',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_Dit is een test — zo zou de reminder er echt elke vrijdag 14:00 uitkomen._',
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✏️ Open partner agenda', emoji: true },
          url: `${DASHBOARD}/dashboard/partners/notulen`,
          style: 'primary',
        },
      ],
    },
  ]

  const fallback = `🎯 TEST — Partneroverleg maandag 10:00\nNog agendapunten? ${DASHBOARD}/dashboard/partners/notulen`

  const ok = await sendDirectMessage(TO, fallback, blocks)
  if (ok) {
    console.log(`✅ Test-DM verstuurd naar ${TO}`)
  } else {
    console.error(`❌ Kon DM niet versturen aan ${TO} — check of de bot in jouw workspace zit en of jouw e-mail in Slack overeenkomt met de DB`)
    process.exit(1)
  }
}

main()
