const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const handovers = await p.handover.findMany({
    include: { user: { select: { name: true } }, cases: true },
    orderBy: { createdAt: 'desc' },
    take: 2
  });
  for (const h of handovers) {
    console.log('---', h.user.name, '---', h.cases.length, 'zaken');
    for (const c of h.cases) {
      const beschr = c.beschrijving ? c.beschrijving.substring(0, 80) + '...' : '(geen)';
      console.log('  ', c.dossiernaam, '|', c.waarnemers, '|', beschr);
    }
  }
  await p.$disconnect();
})();
