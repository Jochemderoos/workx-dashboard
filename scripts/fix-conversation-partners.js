const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function fix() {
  const broken = await p.workConversation.findMany({
    where: { OR: [{ partnerName: '-' }, { partnerName: '' }] },
    include: { week: { include: { distributions: true } } },
  });
  console.log('Found', broken.length, 'conversations with missing partner');

  let fixed = 0;
  for (const conv of broken) {
    const empFirst = conv.employeeName.split(' ')[0].toLowerCase();
    const dist = conv.week.distributions.find(d => {
      if (!d.employeeName) return false;
      return d.employeeName.split(',').map(n => n.trim()).some(name =>
        name.split(' ')[0].toLowerCase() === empFirst || name.toLowerCase() === conv.employeeName.toLowerCase()
      );
    });
    if (dist) {
      await p.workConversation.update({
        where: { id: conv.id },
        data: { partnerName: dist.partnerName },
      });
      console.log('  Fixed:', conv.employeeName, '-> Partner:', dist.partnerName);
      fixed++;
    } else {
      console.log('  No match for:', conv.employeeName);
    }
  }
  console.log('Fixed', fixed, 'of', broken.length);
  await p.$disconnect();
}

fix().catch(e => { console.error(e); process.exit(1); });
