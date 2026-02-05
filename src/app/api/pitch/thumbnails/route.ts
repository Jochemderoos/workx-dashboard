import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPdfBasePath } from '@/lib/pitch-pdf'
import * as fs from 'fs'
import { PDFDocument } from 'pdf-lib'

// Cache for thumbnail data
const thumbnailCache = new Map<string, { data: string; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * GET - Get a thumbnail for a specific page of the pitch base PDF
 * Query params: page (1-indexed), language (nl/en), width (optional, default 200)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const language = (searchParams.get('language') || 'nl') as 'nl' | 'en'
    const width = parseInt(searchParams.get('width') || '200')

    if (page < 1) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    // Check cache
    const cacheKey = `${language}-${page}-${width}`
    const cached = thumbnailCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ thumbnail: cached.data, page, cached: true })
    }

    // Load base PDF
    const basePdfPath = getPdfBasePath(language)
    if (!fs.existsSync(basePdfPath)) {
      return NextResponse.json({ error: 'Base PDF not found' }, { status: 404 })
    }

    const basePdfBytes = fs.readFileSync(basePdfPath)
    const basePdf = await PDFDocument.load(basePdfBytes)
    const totalPages = basePdf.getPageCount()

    if (page > totalPages) {
      return NextResponse.json({ error: 'Page out of range', totalPages }, { status: 400 })
    }

    // Get page dimensions for aspect ratio
    const pdfPage = basePdf.getPage(page - 1)
    const { width: pageWidth, height: pageHeight } = pdfPage.getSize()
    const aspectRatio = pageWidth / pageHeight

    // Return page info (actual thumbnail generation would require a library like pdf2pic or canvas)
    // For now, return metadata that the frontend can use to display a placeholder
    return NextResponse.json({
      page,
      totalPages,
      width: pageWidth,
      height: pageHeight,
      aspectRatio,
      language,
    })
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return NextResponse.json({ error: 'Kon thumbnail niet genereren' }, { status: 500 })
  }
}

/**
 * POST - Get info for multiple pages at once
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { pages, language = 'nl' } = await req.json()

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ error: 'Pages array required' }, { status: 400 })
    }

    // Load base PDF
    const basePdfPath = getPdfBasePath(language as 'nl' | 'en')
    if (!fs.existsSync(basePdfPath)) {
      return NextResponse.json({ error: 'Base PDF not found' }, { status: 404 })
    }

    const basePdfBytes = fs.readFileSync(basePdfPath)
    const basePdf = await PDFDocument.load(basePdfBytes)
    const totalPages = basePdf.getPageCount()

    // Get info for each requested page
    const pageInfos = pages.map((pageNum: number) => {
      if (pageNum < 1 || pageNum > totalPages) {
        return { page: pageNum, error: 'Out of range' }
      }
      const pdfPage = basePdf.getPage(pageNum - 1)
      const { width, height } = pdfPage.getSize()
      return {
        page: pageNum,
        width,
        height,
        aspectRatio: width / height,
      }
    })

    return NextResponse.json({
      pages: pageInfos,
      totalPages,
      language,
    })
  } catch (error) {
    console.error('Error getting page info:', error)
    return NextResponse.json({ error: 'Kon pagina info niet ophalen' }, { status: 500 })
  }
}
