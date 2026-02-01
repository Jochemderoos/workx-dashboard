import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Haal vluchtgegevens en programma op
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Haal vluchtgegevens op (er is maar 1 record)
    const flight = await prisma.lustrumFlight.findFirst()

    // Haal programma items op, gesorteerd op datum en tijd
    const program = await prisma.lustrumProgram.findMany({
      orderBy: [
        { date: 'asc' },
        { time: 'asc' },
      ],
    })

    // Parse de responsible JSON string naar array
    const programWithParsedResponsible = program.map(item => ({
      ...item,
      responsible: JSON.parse(item.responsible),
    }))

    return NextResponse.json({
      flight: flight ? {
        outbound: {
          date: flight.outboundDate,
          departureTime: flight.outboundDepartureTime || '',
          arrivalTime: flight.outboundArrivalTime || '',
          flightNumber: flight.outboundFlightNumber || '',
          departureAirport: flight.outboundDepartureAirport,
          arrivalAirport: flight.outboundArrivalAirport,
        },
        return: {
          date: flight.returnDate,
          departureTime: flight.returnDepartureTime || '',
          arrivalTime: flight.returnArrivalTime || '',
          flightNumber: flight.returnFlightNumber || '',
          departureAirport: flight.returnDepartureAirport,
          arrivalAirport: flight.returnArrivalAirport,
        },
      } : null,
      program: programWithParsedResponsible,
    })
  } catch (error) {
    console.error('Error fetching lustrum data:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
