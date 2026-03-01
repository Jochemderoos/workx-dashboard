import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { rateLimiters, getClientIp } from '@/lib/rate-limiter'

export async function POST(req: NextRequest) {
  try {
    // Rate limiting — 3 registraties per minuut per IP
    const ip = getClientIp(req)
    const rateLimit = rateLimiters.auth(ip)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Te veel verzoeken, probeer het later opnieuw' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const { name, email, password } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Alle velden zijn verplicht' },
        { status: 400 }
      )
    }

    // Alleen @workxadvocaten.nl emailadressen toegestaan
    if (!email.endsWith('@workxadvocaten.nl')) {
      return NextResponse.json(
        { error: 'Alleen @workxadvocaten.nl emailadressen zijn toegestaan' },
        { status: 403 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 6 tekens bevatten' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Er bestaat al een account met dit emailadres' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    })

    // Create default vacation balance for the user (only for employees)
    const currentYear = new Date().getFullYear()
    await prisma.vacationBalance.create({
      data: {
        userId: user.id,
        year: currentYear,
        overgedragenVorigJaar: 0,
        opbouwLopendJaar: 25,
        opgenomenLopendJaar: 0,
      }
    })

    return NextResponse.json(
      { message: 'Account aangemaakt', user },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Er is iets misgegaan bij het aanmaken van het account' },
      { status: 500 }
    )
  }
}
