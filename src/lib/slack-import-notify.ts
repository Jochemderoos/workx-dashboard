// Dashboard-melding bij debiteuren- of kosten-upload.
// Schrijft een ImportEvent-record dat door /api/notifications wordt opgepikt
// en in de bell-icon van Jochem/Hanna/Lotte/Bente verschijnt.

import { prisma } from './prisma'

export type ImportType = 'debiteuren' | 'kosten'

export async function notifyImport(opts: {
  uploaderId: string
  uploaderName: string
  type: ImportType
  summary: string
}): Promise<void> {
  try {
    await prisma.importEvent.create({
      data: {
        type: opts.type === 'debiteuren' ? 'DEBITEUREN' : 'KOSTEN',
        uploaderId: opts.uploaderId,
        uploaderName: opts.uploaderName,
        summary: opts.summary,
      },
    })
  } catch (err) {
    console.error('notifyImport failed (non-blocking):', err)
  }
}
