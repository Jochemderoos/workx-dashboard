import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPagePreviewList } from '@/lib/pitch-pdf'

// POST - Get page preview list for given selections
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const body = await req.json()
    const {
      selectedTeamMembers = [],
      selectedIntroSections,
      selectedBijlagenSections = [],
    } = body

    const pages = getPagePreviewList(
      selectedTeamMembers,
      selectedIntroSections,
      selectedBijlagenSections
    )

    return NextResponse.json({ pages })
  } catch (error) {
    console.error('Error getting page preview:', error)
    return NextResponse.json({ error: 'Failed to get page preview' }, { status: 500 })
  }
}
