import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const CONVERTAPI_SECRET = process.env.CONVERTAPI_SECRET

/**
 * Convert Office documents (docx, xlsx, pptx) to PDF using ConvertAPI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { fileData, fileName } = await req.json()

    if (!CONVERTAPI_SECRET) {
      return NextResponse.json({ error: 'ConvertAPI niet geconfigureerd' }, { status: 500 })
    }

    if (!fileData || !fileName) {
      return NextResponse.json({ error: 'Geen bestand' }, { status: 400 })
    }

    // Determine source format
    let sourceFormat = 'docx'
    const lowerName = fileName.toLowerCase()
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      sourceFormat = 'docx'
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      sourceFormat = 'xlsx'
    } else if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')) {
      sourceFormat = 'pptx'
    } else {
      return NextResponse.json({ error: 'Onondersteund bestandstype' }, { status: 400 })
    }

    // Extract base64 data (remove data URL prefix if present)
    let base64Data = fileData
    if (fileData.includes(',')) {
      base64Data = fileData.split(',')[1]
    }

    // Call ConvertAPI
    const convertApiUrl = `https://v2.convertapi.com/convert/${sourceFormat}/to/pdf`

    const response = await fetch(convertApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONVERTAPI_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Parameters: [
          {
            Name: 'File',
            FileValue: {
              Name: fileName,
              Data: base64Data,
            },
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ConvertAPI error response:', errorText)
      return NextResponse.json({ error: 'Conversie mislukt', details: errorText }, { status: 500 })
    }

    const result = await response.json()

    // Get the converted PDF
    if (result.Files && result.Files.length > 0) {
      const pdfFile = result.Files[0]

      let pdfBase64 = ''

      // Check if FileData is directly available
      if (pdfFile.FileData) {
        pdfBase64 = pdfFile.FileData
      }
      // Otherwise download from URL
      else if (pdfFile.Url) {
        const pdfResponse = await fetch(pdfFile.Url)
        const pdfBuffer = await pdfResponse.arrayBuffer()
        pdfBase64 = Buffer.from(pdfBuffer).toString('base64')
      }

      if (pdfBase64) {
        const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`
        const pdfName = pdfFile.FileName || fileName.replace(/\.(docx?|xlsx?|pptx?)$/i, '.pdf')

        return NextResponse.json({
          success: true,
          pdfData: pdfDataUrl,
          pdfName: pdfName,
        })
      }
    }

    console.error('No PDF in result')
    return NextResponse.json({ error: 'Geen PDF ontvangen' }, { status: 500 })
  } catch (error) {
    console.error('Conversion error:', error)
    return NextResponse.json({ error: 'Conversie mislukt', details: String(error) }, { status: 500 })
  }
}
