import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET all users (for admin panel)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (ADMIN or PARTNER)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Geen toegang. Alleen admins en partners kunnen gebruikers beheren.' },
        { status: 403 }
      )
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Kon gebruikers niet ophalen' },
      { status: 500 }
    )
  }
}

// POST create new user
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (ADMIN or PARTNER)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Geen toegang. Alleen admins en partners kunnen gebruikers aanmaken.' },
        { status: 403 }
      )
    }

    const { email, name, password, role, department } = await req.json()

    // Validation
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Email, naam en wachtwoord zijn verplicht' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 6 tekens bevatten' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
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
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: role || 'EMPLOYEE',
        department: department || null,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isActive: true,
        createdAt: true,
      }
    })

    // Create default vacation balance for the new user
    const currentYear = new Date().getFullYear()
    await prisma.vacationBalance.create({
      data: {
        userId: newUser.id,
        year: currentYear,
        opbouwLopendJaar: 25,
        overgedragenVorigJaar: 0,
        bijgekocht: 0,
        opgenomenLopendJaar: 0,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Account aangemaakt voor ${newUser.name}`,
      user: newUser
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Kon gebruiker niet aanmaken' },
      { status: 500 }
    )
  }
}

// PATCH update user (activate/deactivate)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission (ADMIN or PARTNER)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (!currentUser || !['ADMIN', 'PARTNER'].includes(currentUser.role)) {
      return NextResponse.json(
        { error: 'Geen toegang' },
        { status: 403 }
      )
    }

    const { userId, isActive, role } = await req.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is verplicht' },
        { status: 400 }
      )
    }

    const updateData: { isActive?: boolean; role?: string } = {}
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (role) updateData.role = role

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Gebruiker ${updatedUser.name} bijgewerkt`,
      user: updatedUser
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Kon gebruiker niet bijwerken' },
      { status: 500 }
    )
  }
}
