import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

// Use direct connection with pgbouncer compatibility
let directUrl = process.env.DATABASE_URL?.replace(':5432/', ':6543/') || process.env.DATABASE_URL
if (directUrl && !directUrl.includes('pgbouncer=true')) {
  directUrl = directUrl.includes('?') ? `${directUrl}&pgbouncer=true` : `${directUrl}?pgbouncer=true`
}

const prisma = new PrismaClient({
  datasources: { db: { url: directUrl } }
})

interface ParsedEntry {
  employeeName: string
  date: Date
  billableHours: number
}

function parseRTFContent(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  const fieldResults: string[] = []

  const fldrsltPattern = /\{\{\\fldrslt\s*\{([^}]+)\}/g
  let match

  while ((match = fldrsltPattern.exec(content)) !== null) {
    let value = match[1]
      .replace(/\\[a-z]+\d*\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (value && value.length > 0) {
      fieldResults.push(value)
    }
  }

  console.log(`Found ${fieldResults.length} field results`)

  let currentFirstName = ''
  let currentLastName = ''

  for (let i = 0; i < fieldResults.length; i++) {
    const current = fieldResults[i]

    const dutchDateMatch = current.match(/(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag),?\s*(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i)

    if (dutchDateMatch) {
      const dayNum = parseInt(dutchDateMatch[2])
      const monthName = dutchDateMatch[3].toLowerCase()
      const year = parseInt(dutchDateMatch[4])

      const monthMap: Record<string, number> = {
        januari: 0, februari: 1, maart: 2, april: 3, mei: 4, juni: 5,
        juli: 6, augustus: 7, september: 8, oktober: 9, november: 10, december: 11
      }

      const month = monthMap[monthName]
      if (month !== undefined) {
        const date = new Date(year, month, dayNum)

        for (let j = Math.max(0, i - 10); j < i; j++) {
          const val = fieldResults[j]
          if (/^[A-Z][a-z]+$/.test(val) && !val.match(/^\d/) &&
              !['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'].includes(val)) {
            const nextVal = fieldResults[j + 1]
            if (nextVal && /^[a-zA-Z]/.test(nextVal) && !nextVal.match(/^\d/) &&
                !['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'].includes(nextVal) &&
                !nextVal.match(/(maandag|dinsdag|woensdag|donderdag|vrijdag)/i)) {
              currentFirstName = val
              let lastName = nextVal

              if (['van', 'de', 'den'].includes(nextVal.toLowerCase())) {
                const thirdVal = fieldResults[j + 2]
                if (thirdVal && /^[a-zA-Z]/.test(thirdVal) && !thirdVal.match(/^\d/)) {
                  if (thirdVal.toLowerCase() === 'der') {
                    const fourthVal = fieldResults[j + 3]
                    if (fourthVal && /^[A-Z]/.test(fourthVal)) {
                      lastName = nextVal + ' ' + thirdVal + ' ' + fourthVal
                    }
                  } else if (/^[A-Z]/.test(thirdVal)) {
                    lastName = nextVal + ' ' + thirdVal
                  }
                }
              }
              currentLastName = lastName
              break
            }
          }
        }

        let billable = 0
        for (let j = i + 1; j < Math.min(i + 4, fieldResults.length); j++) {
          const val = fieldResults[j].replace(',', '.')
          const numMatch = val.match(/^(\d+\.?\d*)$/)
          if (numMatch) {
            billable = parseFloat(numMatch[1])
            break
          }
        }

        const fullName = currentFirstName && currentLastName
          ? `${currentFirstName} ${currentLastName}`
          : ''

        if (fullName && billable > 0) {
          entries.push({ employeeName: fullName, date, billableHours: billable })
        }
      }
    }
  }

  return entries
}

function aggregateToMonthly(entries: ParsedEntry[]): Map<string, number> {
  const monthly = new Map<string, number>()

  for (const entry of entries) {
    const year = entry.date.getFullYear()
    const month = entry.date.getMonth() + 1
    const key = `${entry.employeeName}|${year}|${month}`
    const existing = monthly.get(key) || 0
    monthly.set(key, existing + entry.billableHours)
  }

  return monthly
}

async function main() {
  const filePath = 'C:\\Users\\quiri\\Downloads\\Urenoverzicht per medewerker per dag-01022026_0709 (1).rtf'

  console.log('Reading RTF file:', filePath)
  const content = fs.readFileSync(filePath, 'utf-8')
  console.log(`File size: ${(content.length / 1024 / 1024).toFixed(2)} MB`)

  console.log('Parsing RTF content...')
  const entries = parseRTFContent(content)
  console.log(`Found ${entries.length} daily entries`)

  const entries2025 = entries.filter(e => e.date.getFullYear() === 2025)
  console.log(`2025 entries: ${entries2025.length}`)

  const employees = Array.from(new Set(entries2025.map(e => e.employeeName))).sort()
  console.log(`Employees found: ${employees.join(', ')}`)

  const monthsFound = Array.from(new Set(entries2025.map(e => e.date.getMonth() + 1))).sort((a, b) => a - b)
  console.log(`Months found: ${monthsFound.join(', ')}`)

  const monthlyTotals = aggregateToMonthly(entries2025)
  console.log(`Monthly records to create: ${monthlyTotals.size}`)

  const records = Array.from(monthlyTotals.entries()).map(([key, billable]) => {
    const [employeeName, yearStr, monthStr] = key.split('|')
    return {
      employeeName,
      year: parseInt(yearStr),
      month: parseInt(monthStr),
      billableHours: billable,
      workedHours: billable
    }
  })

  console.log(`Upserting ${records.length} records...`)

  for (const record of records) {
    await prisma.monthlyHours.upsert({
      where: {
        employeeName_year_month: {
          employeeName: record.employeeName,
          year: record.year,
          month: record.month
        }
      },
      update: {
        billableHours: record.billableHours,
        workedHours: record.workedHours
      },
      create: record
    })
  }

  console.log(`\nDone! Saved ${records.length} monthly records for 2025`)

  const monthTotals: Record<number, number> = {}
  for (const r of records) {
    monthTotals[r.month] = (monthTotals[r.month] || 0) + r.billableHours
  }
  console.log('\nTotaal uren per maand:')
  for (let m = 1; m <= 12; m++) {
    if (monthTotals[m]) {
      console.log(`  ${m}: ${monthTotals[m].toFixed(1)} uur`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
