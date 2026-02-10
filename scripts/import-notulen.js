/**
 * Import bestaande notulen uit DOCX bestanden
 * Gebruikt mammoth voor DOCX-naar-tekst conversie
 *
 * Verwacht DOCX bestanden in: C:/Users/quiri/Downloads/notulen/
 * Bestandsnamen: "Notulen maandagoverleg november 2024.docx" etc.
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

// Partner namen voor werkverdelingsgesprekken
const PARTNERS = ['Bas', 'Maaike', 'Jochem', 'Juliette']

// Maand namen naar nummers
const MONTH_MAP = {
  'januari': 1, 'februari': 2, 'maart': 3, 'april': 4,
  'mei': 5, 'juni': 6, 'juli': 7, 'augustus': 8,
  'september': 9, 'oktober': 10, 'november': 11, 'december': 12,
}

// Parse een datum string zoals "Maandag 4 november 2024"
function parseMeetingDate(dateStr) {
  const match = dateStr.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (!match) return null
  const day = parseInt(match[1])
  const monthName = match[2].toLowerCase()
  const year = parseInt(match[3])
  const month = MONTH_MAP[monthName]
  if (!month) return null
  return new Date(year, month - 1, day)
}

// Parse DOCX text into structured data
function parseNotulenText(text) {
  const weeks = []

  // Split by date headers (typically "Maandag X maand YYYY")
  const datePattern = /(?:^|\n)((?:Maandag|Dinsdag|Woensdag|Donderdag|Vrijdag)\s+\d{1,2}\s+\w+\s+\d{4})/gi
  const sections = text.split(datePattern)

  for (let i = 1; i < sections.length; i += 2) {
    const dateLabel = sections[i].trim()
    const content = sections[i + 1] || ''
    const meetingDate = parseMeetingDate(dateLabel)

    if (!meetingDate) continue

    const week = {
      dateLabel: dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1),
      meetingDate,
      topics: [],
      actions: [],
      distributions: [],
    }

    // Parse topics - look for numbered items or bold headers
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean)
    let currentTopic = null

    for (const line of lines) {
      // Check for action items (lines starting with "Actie:", "TODO:", or containing "→")
      if (/^(actie|todo|actiepunt)[\s:]/i.test(line) || line.includes('→')) {
        const actionText = line.replace(/^(actie|todo|actiepunt)[\s:]*/i, '').replace('→', '').trim()
        if (actionText) {
          // Try to extract responsible person
          const responsibleMatch = actionText.match(/\(([^)]+)\)$/)
          const responsible = responsibleMatch ? responsibleMatch[1] : 'Onbekend'
          const description = responsibleMatch ? actionText.replace(responsibleMatch[0], '').trim() : actionText
          week.actions.push({ description, responsibleName: responsible })
        }
      }
      // Check for werkverdeling patterns
      else if (/werkverdelingsgesprek/i.test(line) || /werkverdelings?gesprek/i.test(line)) {
        // Parse partner-employee mappings
        for (const partner of PARTNERS) {
          const partnerMatch = line.match(new RegExp(`${partner}[:\\s-]+([\\w\\s]+?)(?:[,;.]|$)`, 'i'))
          if (partnerMatch) {
            week.distributions.push({
              partnerName: partner,
              employeeName: partnerMatch[1].trim(),
            })
          }
        }
      }
      // Regular topic/remark
      else if (line.length > 3) {
        // Check if it looks like a topic header (short, possibly numbered)
        if (line.length < 60 && (/^\d+[\.\)]\s/.test(line) || /^[A-Z]/.test(line))) {
          currentTopic = {
            title: line.replace(/^\d+[\.\)]\s*/, ''),
            remarks: '',
            isStandard: /uren|werkverdeling/i.test(line),
          }
          week.topics.push(currentTopic)
        } else if (currentTopic) {
          currentTopic.remarks = currentTopic.remarks
            ? currentTopic.remarks + '\n' + line
            : line
        } else {
          // First content becomes a topic
          currentTopic = { title: line.substring(0, 60), remarks: '', isStandard: false }
          week.topics.push(currentTopic)
        }
      }
    }

    // Ensure standard topics exist
    const hasUren = week.topics.some(t => /uren/i.test(t.title))
    const hasWerkverdeling = week.topics.some(t => /werkverdeling/i.test(t.title))

    if (!hasUren) {
      week.topics.unshift({ title: 'Uren afgelopen week', remarks: '', isStandard: true })
    }
    if (!hasWerkverdeling) {
      week.topics.splice(1, 0, { title: 'Werkverdeling partners', remarks: '', isStandard: true })
    }

    weeks.push(week)
  }

  return weeks
}

async function main() {
  const notulenDir = 'C:/Users/quiri/Downloads/notulen'

  if (!fs.existsSync(notulenDir)) {
    console.log(`Map ${notulenDir} niet gevonden.`)
    console.log('Maak de map aan en plaats de DOCX bestanden erin.')
    console.log('Verwacht formaat: "Notulen maandagoverleg november 2024.docx"')

    // Create empty months for Nov 2024 - Feb 2026
    console.log('\nLege maanden aanmaken...')
    const months = [
      { year: 2024, month: 11 }, { year: 2024, month: 12 },
      { year: 2025, month: 1 }, { year: 2025, month: 2 }, { year: 2025, month: 3 },
      { year: 2025, month: 4 }, { year: 2025, month: 5 }, { year: 2025, month: 6 },
      { year: 2025, month: 7 }, { year: 2025, month: 8 }, { year: 2025, month: 9 },
      { year: 2025, month: 10 }, { year: 2025, month: 11 }, { year: 2025, month: 12 },
      { year: 2026, month: 1 }, { year: 2026, month: 2 },
    ]

    const monthNames = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
                        'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']

    for (const { year, month } of months) {
      const label = `${monthNames[month]} ${year}`
      try {
        await prisma.meetingMonth.upsert({
          where: { year_month_isLustrum: { year, month, isLustrum: false } },
          update: {},
          create: { year, month, label, isLustrum: false },
        })
        console.log(`  ✓ ${label}`)
      } catch (err) {
        console.log(`  - ${label} (al aanwezig of fout: ${err.message})`)
      }
    }

    console.log('\nKlaar! Lege maandcontainers aangemaakt.')
    console.log('Je kunt nu weken toevoegen via de Notulen pagina.')
    return
  }

  // If directory exists, try to import DOCX files
  let mammoth
  try {
    mammoth = require('mammoth')
  } catch {
    console.error('mammoth package niet gevonden. Installeer met: npm install --save-dev mammoth')
    process.exit(1)
  }

  const files = fs.readdirSync(notulenDir)
    .filter(f => f.endsWith('.docx'))
    .sort()

  if (files.length === 0) {
    console.log('Geen DOCX bestanden gevonden in', notulenDir)
    return
  }

  console.log(`${files.length} DOCX bestanden gevonden`)

  for (const file of files) {
    const filePath = path.join(notulenDir, file)
    console.log(`\nVerwerken: ${file}`)

    try {
      const result = await mammoth.extractRawText({ path: filePath })
      const text = result.value
      console.log(`  ${text.length} tekens geextraheerd`)

      // Determine month from filename
      const fileMatch = file.match(/(\w+)\s+(\d{4})/)
      if (!fileMatch) {
        console.log('  Kon maand niet bepalen uit bestandsnaam, overslaan')
        continue
      }

      const monthName = fileMatch[1].toLowerCase()
      const year = parseInt(fileMatch[2])
      const month = MONTH_MAP[monthName]

      if (!month) {
        console.log(`  Onbekende maand: ${monthName}, overslaan`)
        continue
      }

      const monthNames = ['', 'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
                          'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December']
      const label = `${monthNames[month]} ${year}`

      // Create or get month
      let meetingMonth = await prisma.meetingMonth.upsert({
        where: { year_month_isLustrum: { year, month, isLustrum: false } },
        update: {},
        create: { year, month, label, isLustrum: false },
      })
      console.log(`  Maand: ${label} (${meetingMonth.id})`)

      // Parse the text
      const weeks = parseNotulenText(text)
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
              title: topic.title,
              remarks: topic.remarks || null,
              isStandard: topic.isStandard,
              sortOrder: i,
            },
          })
        }

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

        // Create distributions (default for all partners if no data parsed)
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
      }
    } catch (err) {
      console.error(`  Fout bij verwerken: ${err.message}`)
    }
  }

  console.log('\nImport voltooid!')

  // Show summary
  const monthCount = await prisma.meetingMonth.count()
  const weekCount = await prisma.meetingWeek.count()
  const topicCount = await prisma.meetingTopic.count()
  const actionCount = await prisma.meetingAction.count()
  console.log(`  Maanden: ${monthCount}`)
  console.log(`  Weken: ${weekCount}`)
  console.log(`  Topics: ${topicCount}`)
  console.log(`  Acties: ${actionCount}`)
}

main()
  .catch(err => { console.error('Fout:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
