const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Alle details voor Lodewijk
  const details = await prisma.workloadDetail.findMany({
    where: { personName: 'Lodewijk van Thiel' },
    orderBy: [{ date: 'desc' }, { projectName: 'asc' }],
  });
  console.log('Lodewijk details:', details.length);
  let totalBillable = 0;
  let totalWorked = 0;
  for (const d of details) {
    totalBillable += d.billableHours;
    totalWorked += d.workedHours;
    console.log(d.date, d.billableHours + 'u billable,', d.workedHours + 'u worked', '|', d.projectName.substring(0, 60));
  }
  console.log('\nTotaal billable:', totalBillable.toFixed(1), 'worked:', totalWorked.toFixed(1));

  // Check ook wat het XLS bestand bevat voor Lodewijk
  const XLSX = require('xlsx');
  const wb = XLSX.readFile('C:/Users/quiri/Downloads/xls Uren grafiek-03032026_0832.xls');
  const ws = wb.Sheets['GegevensOverzicht'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log('\n=== XLS rijen met Lodewijk ===');
  let xlsBillable = 0;
  let xlsWorked = 0;
  let count = 0;
  for (const row of rows) {
    const name = String(row[1] || '').trim();
    if (name.includes('Lodewijk')) {
      count++;
      const rawBillable = row[4];
      const rawWorked = row[5];
      const b = typeof rawBillable === 'number' ? rawBillable : parseFloat(String(rawBillable).replace(',', '.')) || 0;
      const w = typeof rawWorked === 'number' ? rawWorked : parseFloat(String(rawWorked).replace(',', '.')) || 0;
      xlsBillable += b;
      xlsWorked += w;
      console.log('  datum:', row[3], 'billable:', rawBillable, 'worked:', rawWorked, '|', String(row[8]).substring(0, 60));
    }
  }
  console.log('XLS Lodewijk regels:', count, 'billable:', xlsBillable.toFixed(1), 'worked:', xlsWorked.toFixed(1));

  // Totalen van alle personen in XLS
  console.log('\n=== Alle personen in XLS ===');
  const personMap = new Map();
  for (const row of rows) {
    const name = String(row[1] || '').trim();
    if (!name || name.toLowerCase().includes('totaal') || name === 'Naam medewerker') continue;
    const w = typeof row[5] === 'number' ? row[5] : parseFloat(String(row[5]).replace(',', '.')) || 0;
    const b = typeof row[4] === 'number' ? row[4] : parseFloat(String(row[4]).replace(',', '.')) || 0;
    const existing = personMap.get(name) || { billable: 0, worked: 0, count: 0 };
    existing.billable += b;
    existing.worked += w;
    existing.count++;
    personMap.set(name, existing);
  }
  for (const [name, data] of personMap) {
    console.log(' ', name, ':', data.count, 'regels, billable:', data.billable.toFixed(1), 'worked:', data.worked.toFixed(1));
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
