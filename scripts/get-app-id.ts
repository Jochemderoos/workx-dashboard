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
import { WebClient } from '@slack/web-api'
const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
slack.bots.info({ bot: 'B0ACE4EC9FH' }).then((r: any) => {
  console.log('app_id:', r.bot?.app_id)
  console.log('direct URL: https://api.slack.com/apps/' + r.bot?.app_id + '/general')
}).catch((e: any) => console.error(e?.data || e?.message))
