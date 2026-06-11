// Server-side cover-foto upload voor Workx uitjes. Maximaal 4 MB
// zodat we onder de Vercel serverless body-limiet blijven.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Alleen afbeeldingen' }, { status: 400 })
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maximaal 4 MB' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `workx-uitjes/${Date.now()}-${session.user.id.slice(0, 6)}.${ext}`
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('workx-outings upload-cover failed', err)
    return NextResponse.json({ error: 'Upload mislukt' }, { status: 500 })
  }
}
