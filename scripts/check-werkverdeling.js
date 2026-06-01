const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const weeks = await p.meetingWeek.findMany({
    where: { meetingDate: { gte: new Date('2026-02-23'), lte: new Date('2026-03-09') } },
    include: { distributions: true },
    orderBy: { meetingDate: 'desc' },
  });
  for (const w of weeks) {
    console.log('Week:', w.dateLabel, '| meetingDate:', w.meetingDate.toISOString(), '| distributions:', w.distributions.length);
    for (const d of w.distributions) {
      console.log('  -', d.partnerName, '->', d.employeeName || '(leeg)');
    }
  }
  if (weeks.length === 0) console.log('Geen MeetingWeeks gevonden in dit bereik');

  // Also check completions
  const completions = await p.conversationCompletion.findMany({
    orderBy: { completedAt: 'desc' },
    take: 10,
  });
  console.log('\nLaatste completions:');
  for (const c of completions) {
    console.log('  -', c.partnerName, '<->', c.employeeName, '| week:', c.weekId, '| at:', c.completedAt.toISOString());
  }

  await p.$disconnect();
})();
