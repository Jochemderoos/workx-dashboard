/**
 * Import Lustrum programma uit "Programma Mallorca.xlsx"
 * Maakt een MeetingMonth met isLustrum=true + topics per programma-item
 *
 * Verwacht bestand: C:/Users/quiri/Downloads/Programma Mallorca.xlsx
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function main() {
  const xlsxPath = 'C:/Users/quiri/Downloads/Programma Mallorca.xlsx'

  if (!fs.existsSync(xlsxPath)) {
    console.error(`Bestand niet gevonden: ${xlsxPath}`)
    console.log('Plaats "Programma Mallorca.xlsx" in C:/Users/quiri/Downloads/')
    process.exit(1)
  }

  let XLSX
  try {
    XLSX = require('xlsx')
  } catch {
    console.error('xlsx package niet gevonden. Installeer met: npm install xlsx')
    process.exit(1)
  }

  console.log('Programma Mallorca.xlsx laden...')
  const workbook = XLSX.readFile(xlsxPath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

  console.log(`  ${rows.length} rijen gevonden in sheet "${sheetName}"`)

  // Create or get the Lustrum MeetingMonth
  // Using October 2026 as the Lustrum month (trip is Sep 30 - Oct 4, 2026)
  let lustrumMonth = await prisma.meetingMonth.upsert({
    where: { year_month_isLustrum: { year: 2026, month: 10, isLustrum: true } },
    update: {},
    create: {
      year: 2026,
      month: 10,
      label: 'Lustrum - Mallorca 2026',
      isLustrum: true,
    },
  })
  console.log(`Lustrum maand: ${lustrumMonth.label} (${lustrumMonth.id})`)

  // Parse rows - typical format: Date | Time | Activity | Description | Responsible
  // Skip header row(s)
  const headerRow = rows[0] || []
  console.log(`  Header: ${headerRow.join(' | ')}`)

  // Group items by date to create "weeks" (one per day)
  const dayMap = new Map()

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length === 0) continue

    // Try to parse the date from the first column
    let dateVal = row[0]
    let dateStr = ''
    let dateObj = null

    if (dateVal) {
      // xlsx may return dates as serial numbers or strings
      if (typeof dateVal === 'number') {
        // Excel date serial number
        dateObj = XLSX.SSF.parse_date_code(dateVal)
        if (dateObj) {
          dateObj = new Date(dateObj.y, dateObj.m - 1, dateObj.d)
        }
      } else if (typeof dateVal === 'string') {
        dateStr = dateVal.trim()
        // Try parsing common Dutch date formats
        const match = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
        if (match) {
          const day = parseInt(match[1])
          const month = parseInt(match[2])
          const year = parseInt(match[3]) < 100 ? parseInt(match[3]) + 2000 : parseInt(match[3])
          dateObj = new Date(year, month - 1, day)
        }
      }
    }

    const time = row[1] ? String(row[1]).trim() : ''
    const title = row[2] ? String(row[2]).trim() : (row[1] ? String(row[1]).trim() : '')
    const description = row[3] ? String(row[3]).trim() : ''
    const responsible = row[4] ? String(row[4]).trim() : ''

    if (!title && !description) continue

    // Use date string as group key (or "Onbekend" if no date)
    const dayKey = dateObj ? dateObj.toISOString().slice(0, 10) : (dateStr || 'overig')

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        dateObj,
        dateLabel: dateStr || (dateObj ? dateObj.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Overig'),
        items: [],
      })
    }

    dayMap.get(dayKey).items.push({ time, title, description, responsible })
  }

  console.log(`  ${dayMap.size} dagen gevonden`)

  // Create a MeetingWeek per day + topics per item
  for (const [dayKey, dayData] of dayMap) {
    const meetingDate = dayData.dateObj || new Date(2026, 9, 1) // Default to Oct 1 2026

    console.log(`  ${dayData.dateLabel}: ${dayData.items.length} items`)

    const week = await prisma.meetingWeek.create({
      data: {
        monthId: lustrumMonth.id,
        meetingDate,
        dateLabel: dayData.dateLabel.charAt(0).toUpperCase() + dayData.dateLabel.slice(1),
      },
    })

    for (let i = 0; i < dayData.items.length; i++) {
      const item = dayData.items[i]
      const topicTitle = item.time ? `${item.time} - ${item.title}` : item.title
      const remarks = [item.description, item.responsible ? `Verantwoordelijk: ${item.responsible}` : '']
        .filter(Boolean).join('\n')

      await prisma.meetingTopic.create({
        data: {
          weekId: week.id,
          title: topicTitle,
          remarks: remarks || null,
          isStandard: false,
          sortOrder: i,
        },
      })
    }
  }

  console.log('\nLustrum import voltooid!')

  // Summary
  const weekCount = await prisma.meetingWeek.count({ where: { monthId: lustrumMonth.id } })
  const topicCount = await prisma.meetingTopic.count({
    where: { week: { monthId: lustrumMonth.id } },
  })
  console.log(`  Dagen: ${weekCount}`)
  console.log(`  Programma-items: ${topicCount}`)
}

main()
  .catch(err => { console.error('Fout:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
