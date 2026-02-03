import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as fs from 'fs'
import * as path from 'path'

// GET - Serve the base pitch PDF for preview
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const basePdfPath = path.join(process.cwd(), 'data', 'pitch', 'pitch-base-nl.pdf')

    if (!fs.existsSync(basePdfPath)) {
      return NextResponse.json({ error: 'PDF not found' }, { status: 404 })
    }

    const pdfBytes = fs.readFileSync(basePdfPath)

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error serving pitch PDF:', error)
    return NextResponse.json({ error: 'Failed to serve PDF' }, { status: 500 })
  }
}
