import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Medewerkers voor werkdruk (geen partners)
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
]

// Bepaal werkdruk level op basis van uren
function getWorkloadLevel(hours: number): 'green' | 'yellow' | 'orange' | 'red' {
  if (hours <= 3) return 'green'    // Rustig
  if (hours <= 4) return 'yellow'   // Normaal
  if (hours <= 5) return 'orange'   // Druk
  return 'red'                       // Heel druk
}

// Parse RTF content en extraheer namen met uren
function parseRTFContent(content: string): Map<string, number> {
  const result = new Map<string, number>()

  // Zoek naar alle uren (Nederlands formaat met komma)
  const hoursMatches = content.match(/\d+,\d+/g) || []

  // Voor elke medewerker, zoek hun naam en de bijbehorende uren
  for (const medewerker of MEDEWERKERS) {
    const firstName = medewerker.split(' ')[0]

    // Zoek de positie van de naam in het document
    const nameIndex = content.indexOf(firstName)
    if (nameIndex === -1) continue

    // Zoek het stuk tekst rond de naam (RTF row)
    // Zoek naar getallen in de buurt van de naam
    const surroundingText = content.substring(nameIndex, nameIndex + 500)

    // Vind uren in dit stuk (formaat: X,XX)
    const hourMatches = surroundingText.match(/(\d+),(\d+)/g)
    if (hourMatches && hourMatches.length > 0) {
      // De eerste match na de naam is meestal het totaal aantal uren
      // Filter out dates (like 01,02) and keep hour values
      for (const match of hourMatches) {
        const [whole, decimal] = match.split(',')
        const hours = parseFloat(`${whole}.${decimal}`)
        // Valid working hours are typically between 0 and 24
        if (hours >= 0 && hours <= 24) {
          result.set(medewerker, hours)
          break
        }
      }
    }
  }

  return result
}

// Alternatieve parsing: zoek naar tabelrijen met namen en uren
function parseRTFTable(content: string): Map<string, number> {
  const result = new Map<string, number>()

  // Split op table rows
  const rows = content.split(/\\row|\\trowd/)

  for (const row of rows) {
    // Check of deze row een medewerker bevat
    for (const medewerker of MEDEWERKERS) {
      const firstName = medewerker.split(' ')[0]
      if (row.includes(firstName)) {
        // Zoek uren in deze row
        const hourMatches = row.match(/(\d+),(\d{2})/g)
        if (hourMatches) {
          // Neem de laatste match (vaak het totaal)
          const lastMatch = hourMatches[hourMatches.length - 1]
          const hours = parseFloat(lastMatch.replace(',', '.'))
          if (hours >= 0 && hours <= 24) {
            result.set(medewerker, hours)
          }
        }
        break
      }
    }
  }

  return result
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
        { error: 'Alleen partners en admin kunnen werkdruk uploaden' },
        { status: 403 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const dateStr = formData.get('date') as string

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    if (!dateStr) {
      return NextResponse.json({ error: 'Geen datum opgegeven' }, { status: 400 })
    }

    // Lees bestand als text
    const content = await file.text()

    // Parse de RTF content
    let hoursPerPerson = parseRTFTable(content)

    // Als tabel parsing weinig resultaten geeft, probeer de andere methode
    if (hoursPerPerson.size < 3) {
      hoursPerPerson = parseRTFContent(content)
    }

    if (hoursPerPerson.size === 0) {
      return NextResponse.json(
        { error: 'Kon geen uren data vinden in het bestand. Controleer of het een geldig urenoverzicht is.' },
        { status: 400 }
      )
    }

    // Sla werkdruk op voor elke gevonden medewerker
    const results: { name: string; hours: number; level: string }[] = []

    const entries = Array.from(hoursPerPerson.entries())
    for (const entry of entries) {
      const personName = entry[0]
      const hours = entry[1]
      const level = getWorkloadLevel(hours)

      await prisma.workload.upsert({
        where: {
          personName_date: { personName, date: dateStr }
        },
        update: { level },
        create: { personName, date: dateStr, level }
      })

      results.push({ name: personName, hours, level })
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      processed: results.length,
      results
    })

  } catch (error) {
    console.error('Error processing workload upload:', error)
    return NextResponse.json(
      { error: 'Fout bij verwerken van bestand' },
      { status: 500 }
    )
  }
}
