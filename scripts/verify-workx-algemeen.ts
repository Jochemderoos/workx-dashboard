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
;(async () => {
  const { WebClient } = await import('@slack/web-api')
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
  const list = await slack.conversations.list({ types: 'public_channel,private_channel' })
  const ch = list.channels?.find(c => c.name === 'workx-algemeen')
  if (!ch?.id) { console.log('channel not found'); return }
  const h = await slack.conversations.history({ channel: ch.id, limit: 3 })
  for (const m of h.messages || []) {
    const t = new Date(Number(m.ts) * 1000).toLocaleString('nl-NL')
    const who = (m as any).username || m.user || 'unknown'
    console.log(`[${t}] ${who}: ${(m.text || '').slice(0, 100)}`)
  }
})()
