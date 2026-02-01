import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST - Vluchtgegevens opslaan/updaten (alleen PARTNER en ADMIN)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Alleen PARTNER en ADMIN mogen vluchtgegevens aanpassen
    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
    })

    if (!user || (user.role !== 'PARTNER' && user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await request.json()
    const { outbound, return: returnFlight } = body

    // Verwijder bestaande vluchtgegevens en maak nieuwe aan
    await prisma.lustrumFlight.deleteMany()

    const flight = await prisma.lustrumFlight.create({
      data: {
        outboundDate: outbound.date,
        outboundDepartureTime: outbound.departureTime || null,
        outboundArrivalTime: outbound.arrivalTime || null,
        outboundFlightNumber: outbound.flightNumber || null,
        outboundDepartureAirport: outbound.departureAirport || 'AMS',
        outboundArrivalAirport: outbound.arrivalAirport || 'PMI',
        returnDate: returnFlight.date,
        returnDepartureTime: returnFlight.departureTime || null,
        returnArrivalTime: returnFlight.arrivalTime || null,
        returnFlightNumber: returnFlight.flightNumber || null,
        returnDepartureAirport: returnFlight.departureAirport || 'PMI',
        returnArrivalAirport: returnFlight.arrivalAirport || 'AMS',
        updatedById: user.id,
      },
    })

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Error saving flight info:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
