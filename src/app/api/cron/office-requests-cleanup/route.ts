// Dagelijkse cron: verwijdert afgeronde Office-verzoeken die langer dan 7
// dagen geleden zijn afgerond.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
  const result = await prisma.officeRequest.deleteMany({
    where: {
      completedAt: { lt: sevenDaysAgo, not: null },
    },
  })

  return NextResponse.json({ ok: true, deleted: result.count })
}
