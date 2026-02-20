import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function extractTextFromDocxXml(xml: string): {
  name: string
  period: string
  sections: Array<{ number: number; title: string; goals: string; evaluation: string }>
} {
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

  let name = ''
  const nameMatch = processed.match(/Naam:\s*(.+?)(?:\n|$)/)
  if (nameMatch) name = nameMatch[1].trim()

  let period = ''
  const periodMatch = processed.match(/Periode:\s*(.+?)(?:\n|$)/)
  if (periodMatch) period = periodMatch[1].trim()

  const sections: Array<{ number: number; title: string; goals: string; evaluation: string }> = []
  const rows = processed.split('|||ROW|||').filter(r => r.includes('|||CELL|||'))

  for (const row of rows) {
    const cells = row.split('|||CELL|||').map(c => c.replace(/\n+/g, '\n').trim())
    if (cells.some(c => c.includes('Onderdeel') && c.includes('Doelen'))) continue
    if (cells.join('').replace(/\s/g, '').length === 0) continue

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

// POST - Upload and parse a new DOCX file
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

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const employeeName = formData.get('employeeName') as string | null
    const yearStr = formData.get('year') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Parse DOCX
    // @ts-expect-error adm-zip has no type declarations
    const AdmZip = (await import('adm-zip')).default
    const zip = new AdmZip(buffer)
    const docEntry = zip.getEntry('word/document.xml')

    if (!docEntry) {
      return NextResponse.json({ error: 'Ongeldig DOCX bestand' }, { status: 400 })
    }

    const xml = docEntry.getData().toString('utf-8')
    const { name: docName, period: docPeriod, sections } = extractTextFromDocxXml(xml)

    const finalName = employeeName || docName || 'Onbekend'
    const finalPeriod = docPeriod || file.name.replace('.docx', '').replace('Ontwikkelplan', '').trim()

    // Extract year
    let year = yearStr ? parseInt(yearStr) : 0
    if (!year) {
      const periodYearMatch = finalPeriod.match(/20\d{2}/)
      if (periodYearMatch) {
        year = parseInt(periodYearMatch[0])
      } else {
        year = new Date().getFullYear()
      }
    }

    // Try to match user
    const users = await prisma.user.findMany({
      select: { id: true, name: true },
    })

    const firstName = finalName.split(' ')[0].toLowerCase()
    const matchedUser = users.find(u => u.name.split(' ')[0].toLowerCase() === firstName)

    // Upload to Vercel Blob if available
    let documentUrl: string | null = null
    try {
      const { put } = await import('@vercel/blob')
      const blob = await put(`ontwikkelplannen/${file.name}`, buffer, {
        access: 'public',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      documentUrl = blob.url
    } catch {
      // Blob storage not available, continue without URL
    }

    const plan = await prisma.developmentPlan.create({
      data: {
        userId: matchedUser?.id || null,
        employeeName: matchedUser?.name || finalName,
        period: finalPeriod,
        year,
        sections: JSON.stringify(sections),
        status: 'actief',
        documentUrl,
        documentName: file.name,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    })

    return NextResponse.json(plan)
  } catch (error) {
    console.error('Error uploading development plan:', error)
    return NextResponse.json({ error: 'Fout bij uploaden plan' }, { status: 500 })
  }
}
