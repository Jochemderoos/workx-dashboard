import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * This endpoint handles the client upload token handshake for @vercel/blob.
 * The client calls this to get a pre-signed upload URL, then uploads directly
 * to Vercel Blob storage (bypassing the 4.5MB serverless function body limit).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
          throw new Error('Niet geautoriseerd')
        }

        return {
          allowedContentTypes: [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ],
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB
        }
      },
      // No onUploadCompleted — we don't need a callback
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Upload handler error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
