import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadFile } from '@/lib/slack'

// POST - Upload file to Slack channel
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const channelId = formData.get('channelId') as string | null

    if (!file || !channelId) {
      return NextResponse.json(
        { error: 'File and channelId are required' },
        { status: 400 }
      )
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Upload to Slack
    const result = await uploadFile(
      channelId,
      buffer,
      file.name,
      `Gedeeld door ${session.user.name}`
    )

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
    })
  } catch (error) {
    console.error('Error uploading to Slack:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
