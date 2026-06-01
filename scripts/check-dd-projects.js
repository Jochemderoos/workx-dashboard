const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const startDate = new Date(now.getTime() - 4 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const entries = await prisma.workloadDetail.findMany({
    where: { date: { gte: startDate } },
    select: { projectName: true, workedHours: true, billableHours: true },
  });
  const map = new Map();
  for (const e of entries) {
    const h = (e.workedHours || 0) + (e.billableHours || 0);
    map.set(e.projectName, (map.get(e.projectName) || 0) + h);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const keywords = ['breij', 'stek', 'jb law', 'jb_law', 'strasuwolfs', 'strausw', 'strauw', 'cleber', 'dd', 'due diligence'];
  console.log('=== DD-gerelateerde projecten ===');
  for (const [name, hours] of sorted) {
    if (keywords.some(k => name.toLowerCase().includes(k))) {
      console.log(hours.toFixed(1) + 'u  ' + name);
    }
  }
  console.log('');
  console.log('=== Alle unieke projectnamen (top 60) ===');
  for (const [name, hours] of sorted.slice(0, 60)) {
    console.log(hours.toFixed(1) + 'u  ' + name);
  }
  await prisma.$disconnect();
}
main();
