const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('C:', 'Users', 'quiri', 'Downloads', 'Vakantiedagen overzicht 2026.xlsx');

try {
  const workbook = XLSX.readFile(filePath);

  console.log('=== EXCEL FILE STRUCTURE ===\n');
  console.log('Sheet names:', workbook.SheetNames);

  workbook.SheetNames.forEach((sheetName, index) => {
    console.log(`\n=== SHEET ${index + 1}: ${sheetName} ===\n`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Show all rows
    data.forEach((row, i) => {
      if (row.length > 0) {
        console.log(`Row ${i + 1}:`, JSON.stringify(row));
      }
    });
  });
} catch (error) {
  console.error('Error reading Excel file:', error.message);
}
