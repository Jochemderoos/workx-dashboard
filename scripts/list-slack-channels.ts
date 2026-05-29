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
  const { WebClient } = await import('@slack/web-api')
  const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
  const result = await slack.conversations.list({ types: 'public_channel,private_channel', exclude_archived: true, limit: 200 })
  if (!result.channels) return
  for (const c of result.channels) {
    console.log(`${c.is_member ? '✓' : ' '} #${c.name} ${c.is_private ? '(private)' : ''}`)
  }
}
main().catch(e => console.error(e))
