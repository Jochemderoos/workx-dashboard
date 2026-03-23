import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const quotes = await prisma.dDFeeQuote.findMany({
    orderBy: { quotedAt: 'desc' },
  })

  return NextResponse.json(quotes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()
  const quote = await prisma.dDFeeQuote.create({
    data: {
      projectName: body.projectName,
      client: body.client,
      sector: body.sector || null,
      targetName: body.targetName || null,
      employees: body.employees || null,
      feeMin: body.feeMin,
      feeMax: body.feeMax,
      actualFee: body.actualFee || null,
      actualHours: body.actualHours || null,
      partnerRate: body.partnerRate || null,
      seniorRate: body.seniorRate || null,
      scope: body.scope || null,
      notes: body.notes || null,
      hasWorksCouncil: body.hasWorksCouncil || false,
      hasCao: body.hasCao || false,
      hasPension: body.hasPension || false,
      status: body.status || 'quoted',
      quotedAt: body.quotedAt ? new Date(body.quotedAt) : new Date(),
    },
  })

  return NextResponse.json(quote, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const body = await req.json()
  if (!body.id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  if (body.projectName !== undefined) data.projectName = body.projectName
  if (body.client !== undefined) data.client = body.client
  if (body.sector !== undefined) data.sector = body.sector || null
  if (body.targetName !== undefined) data.targetName = body.targetName || null
  if (body.employees !== undefined) data.employees = body.employees || null
  if (body.feeMin !== undefined) data.feeMin = body.feeMin
  if (body.feeMax !== undefined) data.feeMax = body.feeMax
  if (body.actualFee !== undefined) data.actualFee = body.actualFee || null
  if (body.actualHours !== undefined) data.actualHours = body.actualHours || null
  if (body.scope !== undefined) data.scope = body.scope || null
  if (body.notes !== undefined) data.notes = body.notes || null
  if (body.hasWorksCouncil !== undefined) data.hasWorksCouncil = body.hasWorksCouncil
  if (body.hasCao !== undefined) data.hasCao = body.hasCao
  if (body.hasPension !== undefined) data.hasPension = body.hasPension
  if (body.status !== undefined) data.status = body.status

  const quote = await prisma.dDFeeQuote.update({
    where: { id: body.id },
    data,
  })

  return NextResponse.json(quote)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'ID is verplicht' }, { status: 400 })
  }

  await prisma.dDFeeQuote.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
