import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { withRateLimit } from '@/lib/rate-limiter'

// Only ADMIN and PARTNER can reset passwords
export async function POST(req: NextRequest) {
  try {
    const limited = withRateLimit(req, { maxRequests: 5, windowMs: 60000, keyPrefix: 'reset-pw' })
    if (limited) return limited

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
        { error: 'Geen toegang. Alleen admins en partners kunnen wachtwoorden resetten.' },
        { status: 403 }
      )
    }

    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'User ID en nieuw wachtwoord zijn verplicht' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 6 tekens bevatten' },
        { status: 400 }
      )
    }

    // Find the user to reset
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'Gebruiker niet gevonden' },
        { status: 404 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        lastPasswordChangeAt: new Date(),
        lastPasswordChangedById: session.user.id,
      }
    })

    return NextResponse.json({
      success: true,
      message: `Wachtwoord gereset voor ${targetUser.name}`
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Kon wachtwoord niet resetten' },
      { status: 500 }
    )
  }
}
