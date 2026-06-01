const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const results = await prisma.workloadDetail.findMany({
    where: { projectName: { contains: 'trau', mode: 'insensitive' } },
    select: { projectName: true, workedHours: true, date: true },
  });
  console.log('Found', results.length, 'entries with "trau":');
  const names = new Set(results.map(r => r.projectName));
  for (const n of names) console.log(' ', n);

  // Also check Strasuwolfs
  const results2 = await prisma.workloadDetail.findMany({
    where: { projectName: { contains: 'tras', mode: 'insensitive' } },
    select: { projectName: true },
  });
  const names2 = new Set(results2.map(r => r.projectName));
  console.log('\nFound with "tras":', names2.size);
  for (const n of names2) console.log(' ', n);

  await prisma.$disconnect();
}
main();
