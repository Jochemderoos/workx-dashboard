import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// Name mapping: first name from DOCX filename -> full name in User table
const NAME_MAP: Record<string, string> = {
  'Marlieke': 'Marlieke Schipper',
  'Justine': 'Justine Schellekens',
  'Emma': 'Emma van der Vos',
  'Hanna': 'Hanna Blaauboer',
  'Wies': 'Wies van Pesch',
  'Alain': 'Alain Heunen',
  'Kay': 'Kay Maes',
  'Erika': 'Erika van Zadelhof',
  'Barbara': 'Barbara Rip',
  'Heleen': 'Heleen Pesser',
}

function extractTextFromDocxXml(xml: string): {
  name: string
  period: string
  sections: Array<{ number: number; title: string; goals: string; evaluation: string }>
} {
  // Extract all text content with structural markers
  let processed = xml
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, '|||CELL|||')
    .replace(/<\/w:tr>/g, '|||ROW|||')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))

  // Extract name
  let name = ''
  const nameMatch = processed.match(/Naam:\s*(.+?)(?:\n|$)/)
  if (nameMatch) {
    name = nameMatch[1].trim()
  }

  // Extract period
  let period = ''
  const periodMatch = processed.match(/Periode:\s*(.+?)(?:\n|$)/)
  if (periodMatch) {
    period = periodMatch[1].trim()
  }

  // Parse table rows
  const sections: Array<{ number: number; title: string; goals: string; evaluation: string }> = []
  const rows = processed.split('|||ROW|||').filter(r => r.includes('|||CELL|||'))

  for (const row of rows) {
    const cells = row.split('|||CELL|||').map(c => c.replace(/\n+/g, '\n').trim())

    // Skip header row (contains "Onderdeel", "Doelen", "Evaluatie")
    if (cells.some(c => c.includes('Onderdeel') && c.includes('Doelen'))) continue
    if (cells.join('').replace(/\s/g, '').length === 0) continue

    // Parse row number
    const numMatch = cells[0]?.match(/(\d+)/)
    if (!numMatch) continue

    const number = parseInt(numMatch[1])
    const title = cells[1]?.trim() || ''
    const goals = cells[2]?.trim() || ''
    const evaluation = cells[3]?.trim() || ''

    if (title || goals) {
      sections.push({ number, title, goals, evaluation })
    }
  }

  return { name, period, sections }
}

function extractYearFromFilename(filename: string, period: string): number {
  // Try to extract year from period first
  const periodYearMatch = period.match(/20\d{2}/)
  if (periodYearMatch) {
    return parseInt(periodYearMatch[0])
  }

  // Fall back to filename
  const filenameYearMatch = filename.match(/20\d{2}/)
  if (filenameYearMatch) {
    return parseInt(filenameYearMatch[0])
  }

  return new Date().getFullYear()
}

function extractNameFromFilename(filename: string): string {
  // Pattern: "Ontwikkelplan - Name ..." or "Ontwikkelplan Name ..."
  const cleaned = filename.replace('.docx', '').replace('.DOCX', '')

  // Try "Ontwikkelplan - Name" pattern
  let match = cleaned.match(/Ontwikkelplan\s*-\s*(\w+)/)
  if (match) return match[1]

  // Try "Ontwikkelplan Name" pattern
  match = cleaned.match(/Ontwikkelplan\s+(\w+)/)
  if (match) return match[1]

  return ''
}

// POST - Import DOCX files from local directory
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    const isAdmin = currentUser?.role === 'PARTNER' || currentUser?.role === 'ADMIN'
    if (!isAdmin) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const dirPath = body.path || 'C:/Users/quiri/Desktop/Ontwikkelplannen'

    // Read directory
    if (!fs.existsSync(dirPath)) {
      return NextResponse.json({ error: `Map niet gevonden: ${dirPath}` }, { status: 400 })
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.docx') || f.endsWith('.DOCX'))

    // Get all users for matching
    const users = await prisma.user.findMany({
      select: { id: true, name: true },
    })

    // Check existing plans to avoid duplicates
    const existingPlans = await prisma.developmentPlan.findMany({
      select: { documentName: true },
    })
    const existingNames = new Set(existingPlans.map((p: { documentName: string | null }) => p.documentName))

    const results: Array<{ file: string; status: string; name?: string; period?: string }> = []
    let imported = 0
    let skipped = 0

    // Dynamic import of adm-zip
    // @ts-expect-error adm-zip has no type declarations
    const AdmZip = (await import('adm-zip')).default

    for (const file of files) {
      // Skip if already imported
      if (existingNames.has(file)) {
        results.push({ file, status: 'overgeslagen (al geïmporteerd)' })
        skipped++
        continue
      }

      try {
        const filePath = path.join(dirPath, file)
        const zip = new AdmZip(filePath)
        const docEntry = zip.getEntry('word/document.xml')

        if (!docEntry) {
          results.push({ file, status: 'fout: geen document.xml gevonden' })
          continue
        }

        const xml = docEntry.getData().toString('utf-8')
        const { name, period, sections } = extractTextFromDocxXml(xml)

        // Determine employee name from file or document
        const fileFirstName = extractNameFromFilename(file)
        const docFirstName = name || fileFirstName
        const firstName = docFirstName || fileFirstName

        // Find full name
        const fullName = NAME_MAP[firstName] || firstName

        // Match to user
        const matchedUser = users.find(u => {
          const uFirst = u.name.split(' ')[0].toLowerCase()
          return uFirst === firstName.toLowerCase()
        })

        // Extract year
        const year = extractYearFromFilename(file, period)

        // Create plan
        await prisma.developmentPlan.create({
          data: {
            userId: matchedUser?.id || null,
            employeeName: fullName,
            period: period || file.replace('.docx', '').replace('Ontwikkelplan', '').trim(),
            year,
            sections: JSON.stringify(sections),
            status: 'afgerond',
            documentName: file,
          },
        })

        results.push({ file, status: 'geïmporteerd', name: fullName, period })
        imported++
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Onbekende fout'
        results.push({ file, status: `fout: ${errorMsg}` })
      }
    }

    return NextResponse.json({
      message: `Import voltooid: ${imported} geïmporteerd, ${skipped} overgeslagen van ${files.length} bestanden`,
      imported,
      skipped,
      total: files.length,
      results,
    })
  } catch (error) {
    console.error('Error importing development plans:', error)
    return NextResponse.json({ error: 'Fout bij importeren' }, { status: 500 })
  }
}
