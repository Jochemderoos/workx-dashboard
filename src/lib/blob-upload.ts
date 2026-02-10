/**
 * Client-side Vercel Blob upload utility.
 *
 * Implements the two-step client upload protocol without importing @vercel/blob/client
 * (which pulls in Node.js-only dependencies that break Next.js 14.1 webpack builds).
 *
 * Step 1: Request a client token from our /api/upload endpoint
 * Step 2: PUT the file directly to Vercel's blob API using the token
 */

interface BlobUploadResult {
  url: string
  pathname: string
}

const VERCEL_BLOB_API_URL = 'https://vercel.com/api/blob'

export async function uploadToBlob(
  filename: string,
  file: File | Blob,
  options?: { handleUploadUrl?: string }
): Promise<BlobUploadResult> {
  const handleUploadUrl = options?.handleUploadUrl || '/api/upload'

  // Step 1: Get client token from server
  const tokenRes = await fetch(handleUploadUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: {
        pathname: filename,
        clientPayload: null,
        multipart: false,
      },
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({ error: 'Token request failed' }))
    console.error('Token request failed:', tokenRes.status, err)
    throw new Error(err.error || 'Kon upload token niet ophalen')
  }

  const tokenData = await tokenRes.json()
  const clientToken = tokenData.clientToken

  if (!clientToken) {
    console.error('No clientToken in response:', tokenData)
    throw new Error('Geen upload token ontvangen')
  }

  // Step 2: PUT file directly to Vercel Blob API
  const headers: Record<string, string> = {
    authorization: `Bearer ${clientToken}`,
    'x-api-version': '7',
  }
  if (file.type) {
    headers['content-type'] = file.type
  }
  if (file.size) {
    headers['x-content-length'] = String(file.size)
  }

  const uploadUrl = `${VERCEL_BLOB_API_URL}/${filename}`
  console.log('Uploading to:', uploadUrl, 'size:', file.size)

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers,
    // @ts-ignore — duplex is required for streaming request bodies in some browsers
    duplex: 'half',
    body: file,
  })

  if (!putRes.ok) {
    const errorText = await putRes.text().catch(() => 'Upload failed')
    console.error('Blob PUT failed:', putRes.status, errorText)
    throw new Error(`Upload mislukt (${putRes.status}): ${errorText}`)
  }

  const result = await putRes.json()
  console.log('Upload success:', result.url)

  return {
    url: result.url,
    pathname: result.pathname,
  }
}
