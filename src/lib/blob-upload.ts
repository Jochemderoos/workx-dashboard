/**
 * Client-side Vercel Blob upload utility.
 *
 * Implements the two-step client upload protocol without importing @vercel/blob/client
 * (which pulls in Node.js-only dependencies that break Next.js 14.1 webpack builds).
 *
 * Step 1: Request a client token from our /api/upload endpoint
 * Step 2: PUT the file directly to Vercel Blob storage using the token
 */

interface BlobUploadResult {
  url: string
  pathname: string
}

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
    throw new Error(err.error || 'Kon upload token niet ophalen')
  }

  const { clientToken } = await tokenRes.json()

  if (!clientToken) {
    throw new Error('Geen upload token ontvangen')
  }

  // Extract store ID and API URL from the client token
  // Token format: vercel_blob_client_<storeId>_<base64payload>
  const parts = clientToken.split('_')
  const storeId = parts[3]

  // Step 2: PUT file directly to Vercel Blob storage
  const uploadUrl = `https://${storeId}.public.blob.vercel-storage.com/${filename}`

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${clientToken}`,
      'x-api-version': '7',
      ...(file.type ? { 'content-type': file.type } : {}),
    },
    // @ts-ignore — duplex is required for streaming request bodies
    duplex: 'half',
    body: file,
  })

  if (!putRes.ok) {
    const errorText = await putRes.text().catch(() => 'Upload failed')
    throw new Error(`Upload mislukt: ${errorText}`)
  }

  const result = await putRes.json()

  return {
    url: result.url,
    pathname: result.pathname,
  }
}
