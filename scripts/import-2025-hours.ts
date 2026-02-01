import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

// Use direct connection (port 6543) instead of pooler (port 5432) for scripts
const directUrl = process.env.DATABASE_URL?.replace(':5432/', ':6543/') || process.env.DATABASE_URL

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: directUrl
    }
  }
})

interface ParsedEntry {
  employeeName: string
  date: Date
  billableHours: number
}

// Parse RTF naar plain text en extract uren data
function parseRTFContent(content: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []

  // Extract all field results from RTF
  // Pattern: {{\fldrslt {... value}  or {{\fldrslt {\control words value}
  const fieldResults: string[] = []

  // Find all fldrslt blocks and extract text content
  const fldrsltPattern = /\{\{\\fldrslt\s*\{([^}]+)\}/g
  let match

  while ((match = fldrsltPattern.exec(content)) !== null) {
    // Remove RTF control words and extract the actual text
    let value = match[1]
      .replace(/\\[a-z]+\d*\s*/gi, ' ')  // Remove control words like \lang1024
      .replace(/\s+/g, ' ')
      .trim()

    if (value && value.length > 0) {
      fieldResults.push(value)
    }
  }

  console.log(`Found ${fieldResults.length} field results`)

  // Debug: show first 20 values
  console.log('First 30 values:', fieldResults.slice(0, 30))

  // Build entries by finding date patterns
  let currentFirstName = ''
  let currentLastName = ''

  for (let i = 0; i < fieldResults.length; i++) {
    const current = fieldResults[i]

    // Check if this is a Dutch date
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

        // Look backwards for name
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

              // Handle compound last names: "van", "de", "den", "van der", etc.
              if (['van', 'de', 'den'].includes(nextVal.toLowerCase())) {
                const thirdVal = fieldResults[j + 2]
                if (thirdVal && /^[a-zA-Z]/.test(thirdVal) && !thirdVal.match(/^\d/)) {
                  // Check if third is "der" (for "van der Vos")
                  if (thirdVal.toLowerCase() === 'der') {
                    const fourthVal = fieldResults[j + 3]
                    if (fourthVal && /^[A-Z]/.test(fourthVal)) {
                      lastName = nextVal + ' ' + thirdVal + ' ' + fourthVal
                    }
                  } else if (/^[A-Z]/.test(thirdVal)) {
                    // Regular "van Pesch", "de Roos", "den Ridder"
                    lastName = nextVal + ' ' + thirdVal
                  }
                }
              }
              currentLastName = lastName
              break
            }
          }
        }

        // Look forward for billable hours
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
          entries.push({
            employeeName: fullName,
            date,
            billableHours: billable
          })
        }
      }
    }
  }

  return entries
}

// Aggregate to monthly totals
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
  const filePath = path.join('C:', 'Users', 'quiri', 'Downloads', 'Urenoverzicht per medewerker per dag-01022026_0537.rtf')

  console.log('Reading RTF file:', filePath)
  const content = fs.readFileSync(filePath, 'utf-8')
  console.log(`File size: ${(content.length / 1024 / 1024).toFixed(2)} MB`)

  console.log('Parsing RTF content...')
  const entries = parseRTFContent(content)
  console.log(`Found ${entries.length} daily entries`)

  // Filter only 2025 data
  const entries2025 = entries.filter(e => e.date.getFullYear() === 2025)
  console.log(`2025 entries: ${entries2025.length}`)

  // Show unique employees
  const employees = Array.from(new Set(entries2025.map(e => e.employeeName)))
  console.log(`Employees found: ${employees.join(', ')}`)

  // Aggregate to monthly
  const monthlyTotals = aggregateToMonthly(entries2025)
  console.log(`Monthly records to create: ${monthlyTotals.size}`)

  // First, delete existing 2025 data
  console.log('Deleting existing 2025 data...')
  await prisma.monthlyHours.deleteMany({ where: { year: 2025 } })

  // Convert Map to array for batch processing
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

  // Save all records
  console.log(`Creating ${records.length} records...`)

  for (const record of records) {
    await prisma.monthlyHours.create({ data: record })
    console.log(`Saved: ${record.employeeName} - ${record.month}/${record.year}: ${record.billableHours.toFixed(1)} uur`)
  }

  console.log(`\nDone! Saved ${records.length} monthly records for 2025`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
