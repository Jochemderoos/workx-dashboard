import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

// POST - Bonnetje uploaden via FormData
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    // Check of activiteit bestaat
    const activity = await prisma.expenseActivity.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    })

    if (!activity) {
      return NextResponse.json({ error: 'Activiteit niet gevonden' }, { status: 404 })
    }

    if (activity.status !== 'OPEN') {
      return NextResponse.json({ error: 'Activiteit is niet meer open voor bonnetjes' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const description = formData.get('description') as string | null
    const amountStr = formData.get('amount') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Geen bestand geüpload' }, { status: 400 })
    }

    // Upload naar Vercel Blob
    const blob = await put(`bonnetjes/${params.id}/${file.name}`, file, {
      access: 'public',
      contentType: file.type,
    })

    // Sla receipt op in database
    const receipt = await prisma.receipt.create({
      data: {
        activityId: params.id,
        uploadedById: session.user.id,
        description: description || null,
        amount: amountStr ? parseFloat(amountStr) : null,
        imageUrl: blob.url,
        imageName: file.name,
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(receipt, { status: 201 })
  } catch (error) {
    console.error('Error uploading receipt:', error)
    return NextResponse.json({ error: 'Kon bonnetje niet uploaden' }, { status: 500 })
  }
}
