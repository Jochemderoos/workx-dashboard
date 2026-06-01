// Eenmalig importscript voor XLS urenoverzicht → WorkloadDetail + Workload
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const NAME_CORRECTIONS = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
  'Lodewijk van': 'Lodewijk van Thiel',
};

function applyNameCorrection(name) {
  for (const [incorrect, correct] of Object.entries(NAME_CORRECTIONS)) {
    if (name === incorrect || name.startsWith(incorrect + ' ')) return correct;
  }
  return name;
}

function parseDutchNumber(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const num = parseFloat(val.trim().replace(',', '.'));
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function getWorkloadLevel(hours) {
  if (hours <= 3) return 'green';
  if (hours <= 4) return 'yellow';
  if (hours <= 5) return 'orange';
  return 'red';
}

async function main() {
  const filePath = process.argv[2] || 'C:/Users/quiri/Downloads/xls Uren grafiek-03032026_0832.xls';
  console.log('Reading:', filePath);

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('gegevensoverzicht'));
  if (!sheetName) { console.error('Sheet GegevensOverzicht niet gevonden'); process.exit(1); }

  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  console.log('Rijen in sheet:', rows.length);

  const details = [];
  const aggMap = new Map();

  for (const row of rows) {
    if (!row || row.length < 6) continue;
    const rawName = String(row[1] || '').trim();
    if (!rawName || rawName.toLowerCase().includes('totaal')) continue;
    const personName = applyNameCorrection(rawName);

    // Datum
    const rawDate = row[3];
    let isoDate = null;
    if (typeof rawDate === 'number') {
      const d = XLSX.SSF.parse_date_code(rawDate);
      if (d) isoDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      const m = rawDate.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (m) isoDate = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (!isoDate) continue;

    const billableHours = parseDutchNumber(row[4]);
    const workedHours = parseDutchNumber(row[5]);
    if (billableHours === 0 && workedHours === 0) continue;

    const projectName = String(row[8] || '').trim();
    if (!projectName) continue;

    const activityType = String(row[9] || '').trim();
    const rawDesc = String(row[10] || '').trim();

    details.push({ personName, date: isoDate, projectName, activityType, description: rawDesc || null, billableHours, workedHours });

    // Aggregeer
    const key = `${personName}|${isoDate}`;
    const existing = aggMap.get(key);
    if (existing) { existing.hours += workedHours; }
    else { aggMap.set(key, { personName, date: isoDate, hours: workedHours }); }
  }

  console.log(`Parsed: ${details.length} detailregels, ${aggMap.size} geaggregeerde entries`);

  // Workload upserts
  const workloadOps = [];
  for (const entry of aggMap.values()) {
    const level = getWorkloadLevel(entry.hours);
    workloadOps.push(prisma.workload.upsert({
      where: { personName_date: { personName: entry.personName, date: entry.date } },
      update: { level, hours: entry.hours },
      create: { personName: entry.personName, date: entry.date, level, hours: entry.hours },
    }));
  }

  // Detail upserts
  const detailOps = details.map(d => prisma.workloadDetail.upsert({
    where: { personName_date_projectName_activityType: { personName: d.personName, date: d.date, projectName: d.projectName, activityType: d.activityType } },
    update: { description: d.description, billableHours: d.billableHours, workedHours: d.workedHours },
    create: d,
  }));

  // Batch in transacties van 50
  const allOps = [...workloadOps, ...detailOps];
  const BATCH = 50;
  for (let i = 0; i < allOps.length; i += BATCH) {
    await prisma.$transaction(allOps.slice(i, i + BATCH));
    process.stdout.write(`\r  ${Math.min(i + BATCH, allOps.length)}/${allOps.length} verwerkt`);
  }

  console.log(`\nKlaar: ${workloadOps.length} workload + ${detailOps.length} detail records opgeslagen`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
