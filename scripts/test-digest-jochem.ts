// Stuurt drie schone preview-DMs aan Jochem: weekly digest, werkoverleg-reminder, partneroverleg-reminder

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

const TARGET_EMAIL = 'jochem.deroos@workxadvocaten.nl'

type Item = { text: string; href?: string; linkLabel?: string }

async function main() {
  const { PrismaClient } = await import('@prisma/client')
  const { sendDirectMessage } = await import('../src/lib/slack')
  const prisma = new PrismaClient()
  const dashboard = process.env.NEXTAUTH_URL || 'https://workx-dashboard.vercel.app'

  try {
    const user = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { id: true, name: true, email: true, birthDate: true, startDate: true },
    })
    if (!user) { console.error('user not found'); return }
    const firstName = user.name.split(' ')[0]

    // === 1. WEEKLY DIGEST (schoon) ===
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const in14 = new Date(today.getTime() + 14 * 86400000)
    const in30 = new Date(today.getTime() + 30 * 86400000)
    const inWeek = new Date(today.getTime() + 7 * 86400000)
    const threeDaysAgo = new Date(today.getTime() - 3 * 86400000)
    const fmtShort = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
    const fmtEUR = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    const todayMMDD = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const items: Item[] = []
    const first = user.name.split(' ')[0].toLowerCase()

    const jars = await prisma.jarSession.findMany({ where: { date: { gte: today, lte: in30 } }, orderBy: { date: 'asc' } })
    for (const s of jars) {
      if (s.name.split(' ')[0].toLowerCase() !== first) continue
      const d = Math.ceil((s.date.getTime() - today.getTime()) / 86400000)
      items.push({ text: `Jouw JAR-beurt is over ${d} ${d === 1 ? 'dag' : 'dagen'} (${fmtShort(s.date)}).`, href: '/dashboard/opleidingen', linkLabel: 'JAR-rooster' })
    }

    const invs = await prisma.openInvoice.findMany({
      where: { primaryUserId: user.id, reminderSentAt: null },
      select: { dueDate: true, totalIncl: true, bookYear: true, bookPeriod: true },
    })
    const overdue = invs.filter(i => {
      const due = i.dueDate ? new Date(i.dueDate) : new Date(i.bookYear, i.bookPeriod, 0)
      return Math.floor((today.getTime() - due.getTime()) / 86400000) >= 15
    })
    if (overdue.length > 0) {
      const tot = overdue.reduce((s, i) => s + i.totalIncl, 0)
      items.push({ text: `*${overdue.length} debiteur${overdue.length === 1 ? '' : 'en'}* te aanschrijven — *${fmtEUR(tot)}* totaal openstaand.`, href: '/dashboard/debiteuren', linkLabel: 'Debiteuren' })
    }

    const news = await prisma.newsletterAssignment.findMany({ where: { assigneeId: user.id, status: 'PENDING', deadline: { gte: today, lte: in14 } } })
    for (const n of news) {
      const d = Math.ceil((new Date(n.deadline).getTime() - today.getTime()) / 86400000)
      const topic = n.topic ? `: "${n.topic}"` : ''
      items.push({ text: `Nieuwsbrief-artikel${topic} — deadline *${fmtShort(new Date(n.deadline))}* (over ${d} dgn).`, href: '/dashboard/werk', linkLabel: 'Wie doet Wat' })
    }

    const vac = await prisma.vacationRequest.findMany({ where: { userId: user.id, status: 'PENDING', createdAt: { lte: threeDaysAgo } } })
    for (const v of vac) {
      items.push({ text: `Vakantieaanvraag *${fmtShort(v.startDate)}–${fmtShort(v.endDate)}* wacht nog op goedkeuring.`, href: '/dashboard/vakanties', linkLabel: 'Vakanties' })
    }

    const tasks = await prisma.personalTask.findMany({ where: { userId: user.id, dueDate: { gte: today, lte: inWeek } }, take: 5 })
    if (tasks.length === 1) {
      items.push({ text: `Taak deze week: *${tasks[0].title}*${tasks[0].dueDate ? ` (${fmtShort(tasks[0].dueDate)})` : ''}.`, href: '/dashboard/eigen-taken', linkLabel: 'Eigen taken' })
    } else if (tasks.length > 1) {
      items.push({ text: `*${tasks.length}* eigen taken met deadline deze week.`, href: '/dashboard/eigen-taken', linkLabel: 'Eigen taken' })
    }

    const cb = await prisma.coachingBudget.findUnique({ where: { userId: user.id } })
    if (cb) {
      const end = new Date(cb.periodStart); end.setFullYear(end.getFullYear() + 3)
      const d = Math.floor((end.getTime() - today.getTime()) / 86400000)
      const rem = Math.max(0, 1500 - cb.usedAmount)
      if (d <= 30 && d >= 0 && rem > 0) {
        items.push({ text: `Coaching-budget loopt over ${d} dgn af — nog *${fmtEUR(rem)}* te besteden.`, href: '/dashboard/arbeidsvoorwaarden', linkLabel: 'Arbeidsvoorwaarden' })
      }
    }

    const drafts = await prisma.bonusCalculation.count({ where: { userId: user.id, status: 'DRAFT' } })
    if (drafts > 0) items.push({ text: `*${drafts}* bonus${drafts === 1 ? '' : 'sen'} in concept — vergeet niet in te dienen bij Hanna.`, href: '/dashboard/bonus', linkLabel: 'Bonus' })

    const others = await prisma.user.findMany({ where: { isActive: true, birthDate: { not: null }, NOT: { id: user.id } }, select: { name: true, birthDate: true } })
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i)
      const mmdd = todayMMDD(d)
      for (const o of others) {
        if (o.birthDate === mmdd) {
          const label = i === 0 ? 'vandaag' : i === 1 ? 'morgen' : fmtShort(d)
          items.push({ text: `*${o.name}* is ${label} jarig.` })
        }
      }
    }

    if (items.length > 0) {
      const lines = items.map(i =>
        i.href ? `•  ${i.text}  <${dashboard}${i.href}|${i.linkLabel || 'Openen'}>` : `•  ${i.text}`
      ).join('\n')
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `Goedemorgen ${firstName}, dit speelt deze week voor jou:` } },
        { type: 'section', text: { type: 'mrkdwn', text: lines } },
        { type: 'divider' },
        { type: 'context', elements: [{ type: 'mrkdwn', text: 'Wekelijkse digest · alleen verstuurd als er iets is.' }] },
      ]
      await sendDirectMessage(user.email, `Digest ${items.length} items`, blocks)
      console.log(`✅ 1) Digest verstuurd — ${items.length} items`)
    }

    // === 2. WERKOVERLEG ===
    const werkBlocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `*Werkoverleg morgen (dinsdag)*\nHeb je nog onderwerpen voor het werkoverleg? Zet ze nu in het dashboard.` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open werkoverleg' }, url: `${dashboard}/dashboard/werkoverleg`, style: 'primary' }] },
    ]
    await sendDirectMessage(user.email, 'Werkoverleg morgen', werkBlocks)
    console.log('✅ 2) Werkoverleg-reminder verstuurd')

    // === 3. PARTNEROVERLEG ===
    const pblocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `*Partneroverleg maandag 10:00*\nHeb je nog agendapunten voor het overleg? Zet ze nu in het dashboard zodat ze klaar staan.` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open partner agenda' }, url: `${dashboard}/dashboard/partners/notulen`, style: 'primary' }] },
    ]
    await sendDirectMessage(user.email, 'Partneroverleg maandag', pblocks)
    console.log('✅ 3) Partneroverleg-reminder verstuurd')
  } finally {
    await prisma.$disconnect()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
