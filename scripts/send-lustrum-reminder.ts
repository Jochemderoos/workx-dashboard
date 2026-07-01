// Plaatst de Lustrum-HERINNERING in #workx-algemeen (met REMINDER vetgedrukt).
// Bedoeld voor maandag 6 juli 2026. Draaien: npx tsx scripts/send-lustrum-reminder.ts

import { WebClient } from '@slack/web-api'
import fs from 'fs'
import path from 'path'

function readEnvToken(): string {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN
  const env = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8')
  const m = env.match(/^SLACK_BOT_TOKEN=(.*)$/m)
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}

const CHANNEL = 'workx-algemeen'

const MESSAGE = `*REMINDER*

Geef *vandaag (maandag 6 juli)* je voorkeur door voor het organiseren van de Lustrum-onderdelen — het is de laatste dag.

Open een onderdeel op de programmapagina en klik op _"Ik wil dit organiseren"_. Hanna verdeelt daarna de onderdelen en houdt zoveel mogelijk rekening met ieders voorkeur.

<https://workx-dashboard.vercel.app/dashboard/lustrum|Naar het Lustrumprogramma>

Op naar een onvergetelijke week — vijftien jaar Workx.`

async function main() {
  const token = readEnvToken()
  if (!token) throw new Error('Geen SLACK_BOT_TOKEN gevonden')
  const slack = new WebClient(token)

  let channelId: string | undefined
  let cursor: string | undefined
  do {
    const res: any = await slack.conversations.list({ types: 'public_channel,private_channel', limit: 200, cursor })
    channelId = (res.channels || []).find((c: any) => c.name === CHANNEL)?.id
    cursor = res.response_metadata?.next_cursor || undefined
  } while (!channelId && cursor)
  if (!channelId) throw new Error(`Kanaal #${CHANNEL} niet gevonden`)

  const imgPath = path.join(process.cwd(), 'scripts', 'assets', 'lustrum-programma-2026.jpg')
  const file = fs.readFileSync(imgPath)
  const res: any = await slack.files.uploadV2({
    channel_id: channelId,
    file,
    filename: 'lustrum-programma-mallorca-2026.jpg',
    title: 'Workx Lustrum — Mallorca 2026',
    initial_comment: MESSAGE,
  })
  console.log(`Reminder geplaatst in #${CHANNEL}. ok =`, res.ok !== false)
}

main().catch(e => { console.error(e); process.exit(1) })
