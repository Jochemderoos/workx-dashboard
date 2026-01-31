const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('C:', 'Users', 'quiri', 'Downloads', 'Verschil werkgeverslasten en omzet 2024 tov 2025 (version sept 25).xlsx');

try {
  const workbook = XLSX.readFile(filePath);

  console.log('=== EXCEL FILE STRUCTURE ===\n');
  console.log('Sheet names:', workbook.SheetNames);

  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n=== SHEET ${index + 1}: ${sheetName} ===\n`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Show first 30 rows
    data.slice(0, 30).forEach((row, i) => {
      if (row.length > 0) {
        console.log(`Row ${i + 1}:`, JSON.stringify(row));
      }
    });
  });
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
