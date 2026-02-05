import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logAuditAction, getIpFromRequest, getUserAgentFromRequest } from '@/lib/audit-log'

// GET all users (for admin panel)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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

    const {
      email,
      name,
      password,
      role,
      department,
      startDate,
      birthDate,
      phoneNumber,
      avatarUrl,
      werkdagen,
      experienceYear,
      hourlyRate,
      isHourlyWage
    } = await req.json()

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

    // Determine salary based on experience year if applicable
    let salary = null
    if (experienceYear !== undefined && experienceYear !== null) {
      const scale = await prisma.salaryScale.findUnique({
        where: { experienceYear: experienceYear }
      })
      salary = scale?.salary || null
    }

    // Create user with all fields
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: role || 'EMPLOYEE',
        department: department || null,
        startDate: startDate ? new Date(startDate) : null,
        birthDate: birthDate || null,
        phoneNumber: phoneNumber || null,
        avatarUrl: avatarUrl || null,
        werkdagen: werkdagen || '1,2,3,4,5',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        startDate: true,
        birthDate: true,
        phoneNumber: true,
        avatarUrl: true,
        werkdagen: true,
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

    // Create employee compensation if experience year or hourly rate is provided
    if (experienceYear !== undefined || hourlyRate !== undefined) {
      // Determine hourly rate from scale if not provided
      let effectiveHourlyRate = hourlyRate
      if (!effectiveHourlyRate && experienceYear !== undefined && experienceYear !== null) {
        const scale = await prisma.salaryScale.findUnique({
          where: { experienceYear: experienceYear }
        })
        effectiveHourlyRate = scale?.hourlyRateBase || 0
      }

      await prisma.employeeCompensation.create({
        data: {
          userId: newUser.id,
          experienceYear: experienceYear ?? null,
          hourlyRate: effectiveHourlyRate || 0,
          salary: salary,
          isHourlyWage: isHourlyWage || false,
        }
      })
    }

    // Audit log
    await logAuditAction({
      userId: session.user.id,
      action: 'CREATE',
      entityType: 'User',
      entityId: newUser.id,
      description: `Nieuwe gebruiker aangemaakt: ${newUser.name} (${newUser.email})`,
      newValue: { name: newUser.name, email: newUser.email, role: newUser.role },
      ipAddress: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
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
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
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

    const body = await req.json()
    const {
      userId,
      isActive,
      role,
      // Profile fields that can now be edited
      name,
      email,
      department,
      phoneNumber,
      birthDate,
      startDate,
      werkdagen,
      avatarUrl,
    } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is verplicht' },
        { status: 400 }
      )
    }

    // Get current user data for audit log
    const oldUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: true,
        isActive: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        startDate: true,
        werkdagen: true,
        avatarUrl: true,
      }
    })

    if (!oldUser) {
      return NextResponse.json({ error: 'Gebruiker niet gevonden' }, { status: 404 })
    }

    // Build update data with all editable fields
    const updateData: Record<string, any> = {}
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    if (role !== undefined) updateData.role = role
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (department !== undefined) updateData.department = department || null
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null
    if (birthDate !== undefined) updateData.birthDate = birthDate || null
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
    if (werkdagen !== undefined) updateData.werkdagen = werkdagen || '1,2,3,4,5'
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl || null

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        department: true,
        phoneNumber: true,
        birthDate: true,
        startDate: true,
        werkdagen: true,
        avatarUrl: true,
      }
    })

    // Audit log - build change description
    const changes: string[] = []
    if (typeof isActive === 'boolean' && oldUser.isActive !== isActive) {
      changes.push(isActive ? 'geactiveerd' : 'gedeactiveerd')
    }
    if (role && oldUser.role !== role) {
      changes.push(`rol gewijzigd naar ${role}`)
    }
    if (name && oldUser.name !== name) {
      changes.push(`naam gewijzigd naar ${name}`)
    }
    if (email && oldUser.email !== email) {
      changes.push(`email gewijzigd naar ${email}`)
    }
    if (department !== undefined && oldUser.department !== department) {
      changes.push(`afdeling gewijzigd`)
    }
    if (phoneNumber !== undefined && oldUser.phoneNumber !== phoneNumber) {
      changes.push(`telefoonnummer gewijzigd`)
    }
    if (birthDate !== undefined && oldUser.birthDate !== birthDate) {
      changes.push(`geboortedatum gewijzigd`)
    }

    await logAuditAction({
      userId: session.user.id,
      action: role && oldUser.role !== role ? 'ROLE_CHANGE' : 'UPDATE',
      entityType: 'User',
      entityId: userId,
      description: `Gebruiker ${updatedUser.name} bijgewerkt: ${changes.length > 0 ? changes.join(', ') : 'geen wijzigingen'}`,
      oldValue: oldUser,
      newValue: updateData,
      ipAddress: getIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
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
