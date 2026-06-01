const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/quiri/Downloads/xls Uren grafiek-03032026_0832.xls');

console.log('Sheets:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\n=== Sheet:', sheetName, '- Rijen:', rows.length, '===');

  // Zoek alle unieke datums
  const dates = new Set();
  for (const row of rows) {
    const rawDate = row[3];
    if (typeof rawDate === 'number') {
      const d = XLSX.SSF.parse_date_code(rawDate);
      if (d) dates.add(d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0'));
    } else if (typeof rawDate === 'string' && rawDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
      dates.add(rawDate);
    }
  }
  if (dates.size > 0) {
    console.log('Unieke datums:', [...dates].sort());
  }

  // Print eerste 5 rijen voor context
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    console.log('Row', i, ':', JSON.stringify(rows[i]));
  }
}

// Check Dashboard sheet voor periode info
const dashboard = wb.Sheets['Dashboard'];
if (dashboard) {
  const dRows = XLSX.utils.sheet_to_json(dashboard, { header: 1, defval: '' });
  console.log('\n=== Dashboard sheet (alle rijen) ===');
  for (let i = 0; i < dRows.length; i++) {
    console.log('Row', i, ':', JSON.stringify(dRows[i]));
  }
}
