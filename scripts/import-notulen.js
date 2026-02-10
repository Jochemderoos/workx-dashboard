/**
 * Import bestaande notulen uit DOCX bestanden
 * Gebruikt mammoth voor DOCX-naar-tekst conversie
 *
 * Verwacht DOCX bestanden in: C:/Users/quiri/Downloads/notulen/
 * Ondersteunde bestandsnamen:
 *   "Notulen - januari 2025.docx"
 *   "Notulen Asana -november 2024.docx"
 *   "Notulen augustus.docx" (zonder jaar → gaat uit van 2025)
 *   "Notulen februari 2026.docx"
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

const PARTNERS = ['Bas', 'Maaike', 'Jochem', 'Juliette', 'Marnix']

const MONTH_MAP = {
  'januari': 1, 'februari': 2, 'maart': 3, 'april': 4,
  'mei': 5, 'juni': 6, 'juli': 7, 'augustus': 8,
  'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
}

const MONTH_NAMES = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
                     'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

const TEAM_MEMBERS = [
  'Marnix', 'Jochem', 'Maaike', 'Bas', 'Juliette',
  'Hanna', 'Lotte', 'Erika', 'Julia', 'Justine', 'Wies',
  'Emma', 'Kay', 'Barbara', 'Heleen', 'Alain', 'Marlieke',
  'Bente', 'Nika',
]

// Extract month+year from filename
function parseFilename(filename) {
  // Try patterns: "Notulen - januari 2025", "Notulen Asana -november 2024", "Notulen augustus", "Notulen februari 2026"
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (filename.toLowerCase().includes(name)) {
      const yearMatch = filename.match(/(\d{4})/)
      const year = yearMatch ? parseInt(yearMatch[1]) : 2025 // default to 2025 if no year
      return { month: num, year }
    }
  }
  return null
}

// Parse a date like "6 januari 2025", "27 januari", "13 januari 2025"
function parseDateStr(dateStr, defaultYear) {
  // Remove weekday prefix if present
  const cleaned = dateStr.replace(/^(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s*/i, '').trim()
  const match = cleaned.match(/(\d{1,2})\s+(\w+)(?:\s+(\d{4}))?/)
  if (!match) return null
  const day = parseInt(match[1])
  const monthName = match[2].toLowerCase()
  const year = match[3] ? parseInt(match[3]) : defaultYear
  const month = MONTH_MAP[monthName]
  if (!month) return null
  return new Date(year, month - 1, day)
}

// Parse the 3-column table structure from mammoth raw text output
// The DOCX files have tables: Agenda | Opmerkingen en afspraken | Acties
// mammoth outputs table cells separated by newlines, with headers repeated per week
function parseNotulenText(text, defaultYear, defaultMonth) {
  const weeks = []
  const lines = text.split('\n')

  // Find date headers - lines that look like "6 januari 2025" or "13 januari 2025"
  // These are standalone lines with a date pattern
  const dateLinePattern = /^(?:(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+)?(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)(?:\s+(\d{4}))?$/i

  // Also match "Augustus 2025" as a section header (for files structured by month)
  const monthHeaderPattern = /^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})\s*$/i

  // First pass: find all date line indices
  const dateIndices = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (dateLinePattern.test(line)) {
      const match = line.match(dateLinePattern)
      const day = parseInt(match[1])
      const monthName = match[2].toLowerCase()
      const year = match[3] ? parseInt(match[3]) : defaultYear
      const month = MONTH_MAP[monthName]
      if (month) {
        dateIndices.push({
          index: i,
          date: new Date(year, month - 1, day),
          label: `${day} ${match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()}${match[3] ? ' ' + match[3] : ' ' + year}`,
        })
      }
    }
  }

  // If no date headers found, try to create a single week for the whole file
  if (dateIndices.length === 0) {
    console.log('    Geen datumheaders gevonden, hele bestand als één blok')
    const date = new Date(defaultYear, defaultMonth - 1, 1)
    dateIndices.push({
      index: 0,
      date,
      label: `${MONTH_NAMES[defaultMonth]} ${defaultYear}`,
    })
  }

  // Process each week section
  for (let d = 0; d < dateIndices.length; d++) {
    const startLine = dateIndices[d].index + 1
    const endLine = d + 1 < dateIndices.length ? dateIndices[d + 1].index : lines.length
    const sectionLines = lines.slice(startLine, endLine).map(l => l.trim()).filter(Boolean)

    const week = {
      dateLabel: dateIndices[d].label,
      meetingDate: dateIndices[d].date,
      topics: [],
      actions: [],
      distributions: [],
    }

    // Skip header lines like "Agenda", "Opmerkingen en afspraken", "Acties"
    // Parse remaining lines as topic entries
    // The mammoth output alternates: topic title, then remarks, then actions for that topic
    let currentTopic = null
    let inActionsColumn = false

    for (const line of sectionLines) {
      // Skip table headers
      if (/^(agenda|opmerkingen\s*(en\s*afspraken)?|acties)\s*$/i.test(line)) {
        continue
      }

      // Skip month headers within sections
      if (monthHeaderPattern.test(line)) continue

      // Check for werkverdeling patterns
      // e.g. "Jochem: Alain, Nika" or "Jochem met Marnix. Alain, Nika"
      const werkverdelingLine = /werkverdeling/i.test(line)
      const hasPartnerAssignment = PARTNERS.some(p =>
        new RegExp(`${p}[:\\s]*(?:met\\s+)?(?:${TEAM_MEMBERS.join('|')})`, 'i').test(line)
      )

      if (werkverdelingLine || hasPartnerAssignment) {
        // Try to parse partner -> employee assignments
        for (const partner of PARTNERS) {
          // Match patterns like "Bas: Marlieke, Heleen, Emma" or "Bas met Marlieke"
          const pRegex = new RegExp(`${partner}[:\\s]+(?:met\\s+)?([\\w\\s,]+?)(?:\\.|$|\\n)`, 'i')
          const pMatch = line.match(pRegex)
          if (pMatch) {
            const employees = pMatch[1].split(/[,]/).map(e => e.trim()).filter(e =>
              e.length > 1 && TEAM_MEMBERS.some(t => t.toLowerCase() === e.toLowerCase())
            )
            if (employees.length > 0) {
              week.distributions.push({
                partnerName: partner,
                employeeName: employees.join(', '),
              })
            }
          }
        }

        // Also add as a topic
        if (!currentTopic || currentTopic.title !== 'Werkverdeling') {
          currentTopic = { title: 'Werkverdeling', remarks: line, isStandard: true }
          week.topics.push(currentTopic)
        } else {
          currentTopic.remarks = currentTopic.remarks ? currentTopic.remarks + '\n' + line : line
        }
        continue
      }

      // Check if this line is an action (mentions a name + action verb, or is short and actionable)
      const isAction = TEAM_MEMBERS.some(name => {
        const namePattern = new RegExp(`^${name}\\s+(bespreekt|mailt|belt|checkt|volgt|maakt|neemt|stuurt|vraagt|gaat|doet|regelt)`, 'i')
        return namePattern.test(line)
      })

      if (isAction) {
        // Extract responsible person
        const responsiblePerson = TEAM_MEMBERS.find(name =>
          new RegExp(`^${name}\\s`, 'i').test(line)
        ) || 'Onbekend'
        week.actions.push({
          description: line,
          responsibleName: responsiblePerson,
        })
        continue
      }

      // Determine if this is a new topic or a remark for the current topic
      // Short lines starting with uppercase are likely topic titles
      const isTopicTitle = line.length < 80 &&
        line.length > 2 &&
        /^[A-Z]/.test(line) &&
        !/^(Bespreken|Akkoord|Check|Besloten|Afgesproken|Uitgangspunt|Verwacht)/i.test(line)

      if (isTopicTitle && (!currentTopic || currentTopic.remarks)) {
        currentTopic = {
          title: line,
          remarks: '',
          isStandard: /uren/i.test(line) && line.length < 40,
        }
        week.topics.push(currentTopic)
      } else if (currentTopic) {
        currentTopic.remarks = currentTopic.remarks
          ? currentTopic.remarks + '\n' + line
          : line
      } else {
        // First content before any topic
        currentTopic = {
          title: line.length > 60 ? line.substring(0, 60) + '...' : line,
          remarks: '',
          isStandard: false,
        }
        week.topics.push(currentTopic)
      }
    }

    // Only add week if it has content
    if (week.topics.length > 0 || week.actions.length > 0) {
      weeks.push(week)
    }
  }

  return weeks
}

async function main() {
  const notulenDir = 'C:/Users/quiri/Downloads/notulen'

  if (!fs.existsSync(notulenDir)) {
    console.error(`Map ${notulenDir} niet gevonden.`)
    process.exit(1)
  }

  const mammoth = require('mammoth')

  const files = fs.readdirSync(notulenDir)
    .filter(f => f.endsWith('.docx'))
    .sort()

  if (files.length === 0) {
    console.log('Geen DOCX bestanden gevonden')
    return
  }

  console.log(`${files.length} DOCX bestanden gevonden\n`)

  // First, clear existing weeks to avoid duplicates
  const existingWeeks = await prisma.meetingWeek.count()
  if (existingWeeks > 0) {
    console.log(`Let op: ${existingWeeks} bestaande weken gevonden.`)
    console.log('Bestaande weken worden NIET overschreven. Verwijder ze eerst als je opnieuw wilt importeren.\n')
  }

  let totalWeeks = 0
  let totalTopics = 0
  let totalActions = 0

  for (const file of files) {
    const filePath = path.join(notulenDir, file)
    console.log(`Verwerken: ${file}`)

    try {
      const result = await mammoth.extractRawText({ path: filePath })
      const text = result.value
      console.log(`  ${text.length} tekens`)

      // Parse month/year from filename
      const fileInfo = parseFilename(file)
      if (!fileInfo) {
        console.log('  Kon maand niet bepalen uit bestandsnaam, overslaan')
        continue
      }

      const { month, year } = fileInfo
      const label = `${MONTH_NAMES[month]} ${year}`

      // Create or get month
      const meetingMonth = await prisma.meetingMonth.upsert({
        where: { year_month_isLustrum: { year, month, isLustrum: false } },
        update: {},
        create: { year, month, label, isLustrum: false },
      })
      console.log(`  Maand: ${label} (${meetingMonth.id})`)

      // Check if month already has weeks
      const existingMonthWeeks = await prisma.meetingWeek.count({ where: { monthId: meetingMonth.id } })
      if (existingMonthWeeks > 0) {
        console.log(`  ⏭ ${existingMonthWeeks} weken bestaan al, overslaan`)
        continue
      }

      // Parse the text
      const weeks = parseNotulenText(text, year, month)
      console.log(`  ${weeks.length} weken gevonden`)

      for (const weekData of weeks) {
        console.log(`    ${weekData.dateLabel}: ${weekData.topics.length} topics, ${weekData.actions.length} acties`)

        // Create week
        const week = await prisma.meetingWeek.create({
          data: {
            monthId: meetingMonth.id,
            meetingDate: weekData.meetingDate,
            dateLabel: weekData.dateLabel,
          },
        })

        // Create topics
        for (let i = 0; i < weekData.topics.length; i++) {
          const topic = weekData.topics[i]
          await prisma.meetingTopic.create({
            data: {
              weekId: week.id,
              title: topic.title.substring(0, 200),
              remarks: topic.remarks || null,
              isStandard: topic.isStandard,
              sortOrder: i,
            },
          })
        }
        totalTopics += weekData.topics.length

        // Create actions
        for (const action of weekData.actions) {
          await prisma.meetingAction.create({
            data: {
              weekId: week.id,
              description: action.description,
              responsibleName: action.responsibleName,
              isCompleted: false,
            },
          })
        }
        totalActions += weekData.actions.length

        // Create distributions
        const dists = weekData.distributions.length > 0
          ? weekData.distributions
          : PARTNERS.map(p => ({ partnerName: p, employeeName: null }))

        for (const dist of dists) {
          await prisma.workDistribution.create({
            data: {
              weekId: week.id,
              partnerName: dist.partnerName,
              employeeName: dist.employeeName || null,
            },
          })
        }

        totalWeeks++
      }
    } catch (err) {
      console.error(`  Fout: ${err.message}`)
    }
  }

  console.log('\n═══════════════════════════════════')
  console.log('Import voltooid!')
  console.log(`  Weken: ${totalWeeks}`)
  console.log(`  Topics: ${totalTopics}`)
  console.log(`  Acties: ${totalActions}`)

  // Show summary from DB
  const monthCount = await prisma.meetingMonth.count()
  const weekCount = await prisma.meetingWeek.count()
  const topicCount = await prisma.meetingTopic.count()
  const actionCount = await prisma.meetingAction.count()
  console.log(`\nTotaal in database:`)
  console.log(`  Maanden: ${monthCount}`)
  console.log(`  Weken: ${weekCount}`)
  console.log(`  Topics: ${topicCount}`)
  console.log(`  Acties: ${actionCount}`)
}

main()
  .catch(err => { console.error('Fout:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
