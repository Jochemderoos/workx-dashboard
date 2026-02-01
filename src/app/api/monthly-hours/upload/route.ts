import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface ParsedEntry {
  employeeName: string
  date: Date
  billableHours: number
  workedHours: number
}

// Parse RTF naar plain text en extract uren data
function parseRTFContent(buffer: Buffer): ParsedEntry[] {
  const content = buffer.toString('utf-8')
  const entries: ParsedEntry[] = []

  // Extract all field results from RTF
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

  // Build entries by finding date patterns and looking around them
  // Structure in RTF: FirstName, LastName, Week, Date, Billable, Worked
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

        // Look backwards for name (FirstName, LastName, Week before date)
        // Usually: index-3=FirstName, index-2=LastName, index-1=Week
        for (let j = Math.max(0, i - 10); j < i; j++) {
          const val = fieldResults[j]
          // First name: capitalized word, not a number, not a day
          if (/^[A-Z][a-z]+$/.test(val) && !val.match(/^\d/) &&
              !['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'].includes(val)) {
            // Check if next is also a name part (lastname with spaces/prefixes)
            const nextVal = fieldResults[j + 1]
            if (nextVal && /^[a-zA-Z]/.test(nextVal) && !nextVal.match(/^\d/) &&
                !['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'].includes(nextVal) &&
                !nextVal.match(/(maandag|dinsdag|woensdag|donderdag|vrijdag)/i)) {
              currentFirstName = val
              // Handle compound last names like "van der Vos", "de Roos"
              let lastName = nextVal
              // Check for prefixes
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

        // Look forward for hours (billable is first number after date)
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
            billableHours: billable,
            workedHours: billable // Only billable is relevant per user
          })
        }
      }
    }
  }

  return entries
}

// Aggregeer dagelijkse entries naar maandelijkse totalen
function aggregateToMonthly(entries: ParsedEntry[]): Map<string, { billable: number; worked: number }> {
  const monthly = new Map<string, { billable: number; worked: number }>()

  for (const entry of entries) {
    const year = entry.date.getFullYear()
    const month = entry.date.getMonth() + 1 // 1-12
    const key = `${entry.employeeName}|${year}|${month}`

    const existing = monthly.get(key) || { billable: 0, worked: 0 }
    existing.billable += entry.billableHours
    existing.worked += entry.workedHours
    monthly.set(key, existing)
  }

  return monthly
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check of gebruiker Partner of Admin is
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Alleen partners en admin kunnen uren uploaden' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const yearParam = formData.get('year') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()

    let entries: ParsedEntry[] = []

    if (fileName.endsWith('.rtf')) {
      entries = parseRTFContent(buffer)
    } else {
      return NextResponse.json(
        { error: 'Ongeldig bestandsformaat. Upload een .rtf bestand van BaseNet.' },
        { status: 400 }
      )
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: 'Geen uren data gevonden in het bestand' },
        { status: 400 }
      )
    }

    // Filter op specifiek jaar als opgegeven
    if (yearParam) {
      const filterYear = parseInt(yearParam)
      entries = entries.filter(e => e.date.getFullYear() === filterYear)
    }

    // Aggregeer naar maandelijkse totalen
    const monthlyTotals = aggregateToMonthly(entries)

    // Sla op in database
    let savedCount = 0
    const errors: string[] = []

    for (const [key, totals] of Array.from(monthlyTotals.entries())) {
      const [employeeName, yearStr, monthStr] = key.split('|')
      const year = parseInt(yearStr)
      const month = parseInt(monthStr)

      try {
        await prisma.monthlyHours.upsert({
          where: {
            employeeName_year_month: { employeeName, year, month }
          },
          update: {
            billableHours: totals.billable,
            workedHours: totals.worked
          },
          create: {
            employeeName,
            year,
            month,
            billableHours: totals.billable,
            workedHours: totals.worked
          }
        })
        savedCount++
      } catch (err) {
        errors.push(`Fout bij ${employeeName} ${month}/${year}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${savedCount} maandelijkse records opgeslagen`,
      entriesProcessed: entries.length,
      monthlyRecords: savedCount,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error uploading hours:', error)
    return NextResponse.json(
      { error: 'Fout bij verwerken van bestand' },
      { status: 500 }
    )
  }
}
