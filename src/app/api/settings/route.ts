import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Default settings values
const DEFAULT_SETTINGS: Record<string, { value: string; label: string }> = {
  kilometerRate: {
    value: '0.23',
    label: 'Kilometervergoeding (EUR per km)'
  }
}

// GET - Fetch settings (public for reading, but only certain keys)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key')

    if (key) {
      // Get single setting
      const setting = await prisma.appSetting.findUnique({
        where: { key }
      })

      if (setting) {
        return NextResponse.json({
          key: setting.key,
          value: JSON.parse(setting.value),
          label: setting.label
        })
      }

      // Return default if exists
      if (DEFAULT_SETTINGS[key]) {
        return NextResponse.json({
          key,
          value: parseFloat(DEFAULT_SETTINGS[key].value),
          label: DEFAULT_SETTINGS[key].label
        })
      }

      return NextResponse.json({ error: 'Setting niet gevonden' }, { status: 404 })
    }

    // Get all settings
    const settings = await prisma.appSetting.findMany()

    // Merge with defaults
    const result: Record<string, any> = {}

    // Add defaults first
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      result[k] = {
        key: k,
        value: parseFloat(v.value),
        label: v.label
      }
    }

    // Override with database values
    for (const setting of settings) {
      result[setting.key] = {
        key: setting.key,
        value: JSON.parse(setting.value),
        label: setting.label
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Kon instellingen niet ophalen' }, { status: 500 })
  }
}

// PUT - Update a setting (admin/partner only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check if user is admin or partner
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (currentUser?.role !== 'PARTNER' && currentUser?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const body = await req.json()
    const { key, value, label } = body

    if (!key) {
      return NextResponse.json({ error: 'Key is verplicht' }, { status: 400 })
    }

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        label: label || DEFAULT_SETTINGS[key]?.label,
        updatedBy: session.user.id
      },
      create: {
        key,
        value: JSON.stringify(value),
        label: label || DEFAULT_SETTINGS[key]?.label,
        updatedBy: session.user.id
      }
    })

    return NextResponse.json({
      key: setting.key,
      value: JSON.parse(setting.value),
      label: setting.label
    })
  } catch (error) {
    console.error('Error updating setting:', error)
    return NextResponse.json({ error: 'Kon instelling niet bijwerken' }, { status: 500 })
  }
}
