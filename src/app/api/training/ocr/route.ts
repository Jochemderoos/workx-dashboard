import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// POST - Analyze certificate image with OpenAI Vision
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Niet geautoriseerd' }, { status: 401 })
    }

    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'Image data is verplicht' }, { status: 400 })
    }

    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      return NextResponse.json({
        error: 'OpenAI API key not configured',
        fallback: true
      }, { status: 400 })
    }

    // Call OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Je bent een OCR-assistent die Nederlandse opleidingscertificaten analyseert.
Extraheer de volgende informatie uit het certificaat en retourneer het als JSON:
{
  "trainingName": "Naam van de opleiding/cursus",
  "provider": "Naam van het opleidingsinstituut",
  "completedDate": "Datum in YYYY-MM-DD formaat",
  "points": nummer (PO-punten, opleidingspunten, of schat in als niet vermeld),
  "confidence": "high" | "medium" | "low",
  "rawText": "Relevante tekst van het certificaat"
}

Let op:
- PO-punten (Permanente Opleiding) zijn vaak vermeld als "PO-punten", "punten", "studiepunten" of "PE-punten"
- Als punten niet vermeld zijn, schat dan 1-2 punten voor korte cursussen, 3-5 voor langere
- Zoek naar data in Nederlandse formaten (bijv. "15 januari 2025" of "15-01-2025")
- Retourneer ALLEEN de JSON, geen andere tekst`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyseer dit certificaat en extraheer de opleidingsinformatie:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`,
                }
              }
            ]
          }
        ],
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('OpenAI API error:', error)
      return NextResponse.json({
        error: 'Failed to analyze image',
        fallback: true
      }, { status: 500 })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return NextResponse.json({
        error: 'No response from OpenAI',
        fallback: true
      }, { status: 500 })
    }

    // Parse the JSON response
    try {
      // Extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const result = JSON.parse(jsonMatch[0])

      return NextResponse.json({
        success: true,
        data: {
          trainingName: result.trainingName || '',
          provider: result.provider || '',
          completedDate: result.completedDate || '',
          points: result.points || 1,
          confidence: result.confidence || 'medium',
          rawText: result.rawText || '',
        }
      })
    } catch (parseError) {
      console.error('Failed to parse OCR response:', content)
      return NextResponse.json({
        success: false,
        error: 'Failed to parse certificate data',
        rawResponse: content,
        fallback: true,
      })
    }
  } catch (error) {
    console.error('Error in OCR processing:', error)
    return NextResponse.json({ error: 'Kon niet verwerken image' }, { status: 500 })
  }
}
