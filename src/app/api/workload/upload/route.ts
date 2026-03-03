import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Medewerkers + partners voor werkdruk
const MEDEWERKERS = [
  'Hanna Blaauboer',
  'Justine Schellekens',
  'Marlieke Schipper',
  'Wies van Pesch',
  'Emma van der Vos',
  'Alain Heunen',
  'Kay Maes',
  'Erika van Zadelhof',
  'Heleen Pesser',
  'Barbara Rip',
  'Lotte van Sint Truiden',
  'Julia Groen',
  'Lodewijk van Thiel',
  'Marnix Ritmeester',
  'Jochem de Roos',
  'Maaike de Jong',
  'Bas den Ridder',
  'Juliette Niersman',
]

// Naam correcties voor incomplete namen uit XLS
const NAME_CORRECTIONS: Record<string, string> = {
  'Emma van der': 'Emma van der Vos',
  'Lotte van Sint': 'Lotte van Sint Truiden',
  'Wies van': 'Wies van Pesch',
  'Erika van': 'Erika van Zadelhof',
  'Lodewijk van': 'Lodewijk van Thiel',
}

function applyNameCorrection(name: string): string {
  for (const [incorrect, correct] of Object.entries(NAME_CORRECTIONS)) {
    if (name === incorrect || name.startsWith(incorrect + ' ')) {
      return correct
    }
  }
  return name
}

// Dutch day and month names for parsing
const DUTCH_DAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
const DUTCH_MONTHS: Record<string, string> = {
  'januari': '01',
  'februari': '02',
  'maart': '03',
  'april': '04',
  'mei': '05',
  'juni': '06',
  'juli': '07',
  'augustus': '08',
  'september': '09',
  'oktober': '10',
  'november': '11',
  'december': '12',
}

// Bepaal werkdruk level op basis van uren
function getWorkloadLevel(hours: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (hours <= 3) return 'green'    // Rustig
  if (hours <= 4) return 'yellow'   // Normaal
  if (hours <= 5) return 'orange'   // Druk
  return 'red'                       // Heel druk
}

interface WorkloadEntry {
  personName: string
  date: string
  hours: number
}

interface WorkloadDetailEntry {
  personName: string
  date: string
  projectName: string
  activityType: string
  description: string | null
  billableHours: number
  workedHours: number
}

// ─── XLS Parser ─────────────────────────────────────────────────────────

function parseXLSFile(buffer: ArrayBuffer): { aggregated: WorkloadEntry[]; details: WorkloadDetailEntry[] } {
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Zoek het GegevensOverzicht sheet
  const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('gegevensoverzicht'))
  if (!sheetName) {
    throw new Error('Sheet "GegevensOverzicht" niet gevonden in het bestand')
  }

  const sheet = workbook.Sheets[sheetName]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  const details: WorkloadDetailEntry[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 6) continue

    // Col B (idx 1): personName
    const rawName = String(row[1] || '').trim()
    if (!rawName || rawName.toLowerCase().includes('totaal')) continue

    const personName = applyNameCorrection(rawName)

    // Col D (idx 3): datum — kan een Excel serial number of DD-MM-YYYY string zijn
    const rawDate = row[3]
    let isoDate: string | null = null

    if (typeof rawDate === 'number') {
      // Excel serial number → Date
      const d = XLSX.SSF.parse_date_code(rawDate)
      if (d) {
        isoDate = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
      }
    } else if (typeof rawDate === 'string' && rawDate.trim()) {
      // Try DD-MM-YYYY format
      const match = rawDate.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      if (match) {
        isoDate = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
      }
    }

    if (!isoDate) continue

    // Col E (idx 4): factureerbare uren (kan komma-decimaal string zijn)
    const rawBillable = row[4]
    const billableHours = parseDutchNumber(rawBillable)

    // Col F (idx 5): bestede uren
    const rawWorked = row[5]
    const workedHours = parseDutchNumber(rawWorked)

    // Skip rijen zonder uren
    if (billableHours === 0 && workedHours === 0) continue

    // Col I (idx 8): projectName
    const projectName = String(row[8] || '').trim()
    if (!projectName) continue

    // Col J (idx 9): activityType
    const activityType = String(row[9] || '').trim()

    // Col K (idx 10): description
    const rawDesc = String(row[10] || '').trim()
    const description = rawDesc || null

    details.push({
      personName,
      date: isoDate,
      projectName,
      activityType,
      description,
      billableHours,
      workedHours,
    })
  }

  // Aggregeer tot totaal uren per persoon+dag (voor Workload tabel)
  const aggMap = new Map<string, WorkloadEntry>()
  for (const detail of details) {
    const key = `${detail.personName}|${detail.date}`
    const existing = aggMap.get(key)
    if (existing) {
      existing.hours += detail.workedHours
    } else {
      aggMap.set(key, {
        personName: detail.personName,
        date: detail.date,
        hours: detail.workedHours,
      })
    }
  }

  // Rond geaggregeerde uren af (floating point fix)
  const aggregated = Array.from(aggMap.values()).map(e => ({
    ...e,
    hours: Math.round(e.hours * 100) / 100,
  }))

  return { aggregated, details }
}

function parseDutchNumber(val: unknown): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') {
    // Replace comma with dot for Dutch decimal format
    const cleaned = val.trim().replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}

// ─── RTF Parsers (bestaand) ─────────────────────────────────────────────

// Parse RTF content met Dutch dates (e.g. "woensdag, 28 januari 2026")
function parseRTFWithDutchDates(content: string): WorkloadEntry[] {
  const results: WorkloadEntry[] = []

  // Build pattern for Dutch dates: "maandag, 1 januari 2026" etc
  const dayPattern = DUTCH_DAYS.join('|')
  const monthPattern = Object.keys(DUTCH_MONTHS).join('|')
  const dateRegex = new RegExp(`(${dayPattern}),\\s*(\\d{1,2})\\s+(${monthPattern})\\s+(\\d{4})`, 'gi')

  // Find all Dutch dates and their positions
  let dateMatch
  const datesFound: { date: string; pos: number }[] = []

  while ((dateMatch = dateRegex.exec(content)) !== null) {
    const day = dateMatch[2].padStart(2, '0')
    const monthName = dateMatch[3].toLowerCase()
    const year = dateMatch[4]
    const month = DUTCH_MONTHS[monthName]
    const isoDate = `${year}-${month}-${day}`
    datesFound.push({ date: isoDate, pos: dateMatch.index })
  }

  // For each date occurrence, find the employee (before) and hours (after)
  for (const dateItem of datesFound) {
    // Look back for employee name (within ~3000 chars before date)
    const searchStart = Math.max(0, dateItem.pos - 3000)
    const beforeDate = content.substring(searchStart, dateItem.pos)

    // Find the closest employee first name before this date
    let employeeName = ''
    let closestDistance = Infinity

    for (const medewerker of MEDEWERKERS) {
      const firstName = medewerker.split(' ')[0]
      const lastIndex = beforeDate.lastIndexOf(firstName)
      if (lastIndex !== -1) {
        const distance = beforeDate.length - lastIndex
        if (distance < closestDistance) {
          closestDistance = distance
          employeeName = medewerker
        }
      }
    }

    if (!employeeName) continue

    // Look forward for hours (X,XX pattern) - check next ~500 chars after date
    const afterDateEnd = Math.min(content.length, dateItem.pos + 500)
    const afterDate = content.substring(dateItem.pos, afterDateEnd)

    // Find hour values after the date (format: X,XX)
    const hoursPattern = /(\d{1,2}),(\d{2})/g
    const hoursMatches: number[] = []
    let hMatch
    while ((hMatch = hoursPattern.exec(afterDate)) !== null) {
      const h = parseFloat(`${hMatch[1]}.${hMatch[2]}`)
      if (h >= 0 && h <= 24) {
        hoursMatches.push(h)
      }
      // Only look at first few matches (before next row)
      if (hoursMatches.length >= 4) break
    }

    // The last valid hours value is typically "Besteed" (worked hours)
    const hours = hoursMatches.length > 0 ? hoursMatches[hoursMatches.length - 1] : null

    if (hours !== null) {
      results.push({
        personName: employeeName,
        date: dateItem.date,
        hours
      })
    }
  }

  return results
}

// Legacy parsing: zoek naar tabelrijen met namen en uren (voor single-date files)
function parseRTFTable(content: string, dateStr: string): WorkloadEntry[] {
  const results: WorkloadEntry[] = []
  const rows = content.split(/\\row|\\trowd/)

  for (const row of rows) {
    for (const medewerker of MEDEWERKERS) {
      const firstName = medewerker.split(' ')[0]
      if (row.includes(firstName)) {
        const hourMatches = row.match(/(\d+),(\d{2})/g)
        if (hourMatches) {
          const lastMatch = hourMatches[hourMatches.length - 1]
          const hours = parseFloat(lastMatch.replace(',', '.'))
          if (hours >= 0 && hours <= 24) {
            results.push({ personName: medewerker, date: dateStr, hours })
          }
        }
        break
      }
    }
  }

  return results
}

// ─── POST Handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check of gebruiker Partner of Admin is
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json(
        { error: 'Alleen partners en admin kunnen werkdruk uploaden' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const dateStr = formData.get('date') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    // Detecteer bestandstype op extensie
    const fileName = file.name.toLowerCase()
    const isXLS = fileName.endsWith('.xls') || fileName.endsWith('.xlsx')

    let workloadEntries: WorkloadEntry[] = []
    let detailEntries: WorkloadDetailEntry[] = []

    if (isXLS) {
      // XLS/XLSX parser
      const buffer = await file.arrayBuffer()
      const parsed = parseXLSFile(buffer)
      workloadEntries = parsed.aggregated
      detailEntries = parsed.details
    } else {
      // Bestaande RTF parser
      const content = await file.text()

      // Try parsing with Dutch dates first (preferred method)
      workloadEntries = parseRTFWithDutchDates(content)

      // If no results and we have a date parameter, try legacy parsing
      if (workloadEntries.length === 0 && dateStr) {
        workloadEntries = parseRTFTable(content, dateStr)
      }
    }

    // Remove duplicates (same person + date), keep last occurrence
    const uniqueEntries: WorkloadEntry[] = []
    const seen = new Map<string, number>()
    for (let i = 0; i < workloadEntries.length; i++) {
      const entry = workloadEntries[i]
      const key = `${entry.personName}|${entry.date}`
      seen.set(key, i)
    }
    for (const [, idx] of Array.from(seen.entries())) {
      uniqueEntries.push(workloadEntries[idx])
    }

    if (uniqueEntries.length === 0) {
      return NextResponse.json(
        { error: 'Kon geen uren data vinden in het bestand. Controleer of het een geldig urenoverzicht is.' },
        { status: 400 }
      )
    }

    // Sla werkdruk op — alle upserts in één transactie
    const results: { name: string; date: string; hours: number; level: string }[] = []
    const workloadOps = uniqueEntries.map(entry => {
      const level = getWorkloadLevel(entry.hours)
      results.push({ name: entry.personName, date: entry.date, hours: entry.hours, level })
      return prisma.workload.upsert({
        where: {
          personName_date: { personName: entry.personName, date: entry.date }
        },
        update: { level, hours: entry.hours },
        create: { personName: entry.personName, date: entry.date, level, hours: entry.hours }
      })
    })

    // Sla WorkloadDetail records op — in batches van 50 binnen transacties
    const detailOps = detailEntries.map(detail =>
      prisma.workloadDetail.upsert({
        where: {
          personName_date_projectName_activityType: {
            personName: detail.personName,
            date: detail.date,
            projectName: detail.projectName,
            activityType: detail.activityType,
          }
        },
        update: {
          description: detail.description,
          billableHours: detail.billableHours,
          workedHours: detail.workedHours,
        },
        create: {
          personName: detail.personName,
          date: detail.date,
          projectName: detail.projectName,
          activityType: detail.activityType,
          description: detail.description,
          billableHours: detail.billableHours,
          workedHours: detail.workedHours,
        }
      })
    )

    // Verwerk alles in batches van 50 binnen transacties
    const BATCH_SIZE = 50
    const allOps = [...workloadOps, ...detailOps]
    for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
      const batch = allOps.slice(i, i + BATCH_SIZE)
      await prisma.$transaction(batch)
    }
    const detailCount = detailEntries.length

    // Get unique dates from results
    const uniqueDates = Array.from(new Set(results.map(r => r.date)))

    return NextResponse.json({
      success: true,
      dates: uniqueDates,
      processed: results.length,
      detailRecords: detailCount,
      results
    })

  } catch (error) {
    console.error('Error processing workload upload:', error)
    const message = error instanceof Error ? error.message : 'Fout bij verwerken van bestand'
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
