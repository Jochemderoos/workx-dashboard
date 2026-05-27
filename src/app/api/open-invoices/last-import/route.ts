import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - retourneer wanneer de laatste BaseNet-upload heeft plaatsgevonden.
// Gebruikt voor de upload-reminder-widget op het dashboard.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }
  try {
    const last = await prisma.openInvoice.aggregate({
      _max: { importedAt: true },
    })
    return NextResponse.json({ lastImportedAt: last._max.importedAt })
  } catch (error) {
    console.error('Error fetching last import:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
