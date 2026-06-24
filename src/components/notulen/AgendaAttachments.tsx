'use client'

import { useRef, useState } from 'react'
import { Icons } from '@/components/ui/Icons'
import { uploadToBlob } from '@/lib/blob-upload'
import toast from 'react-hot-toast'

export interface Attachment {
  url: string
  name: string
  size?: number
}

// Parse de JSON-string uit de database naar een lijst bijlagen.
export function parseAttachments(raw: string | null | undefined): Attachment[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((a) => a && a.url && a.name) : []
  } catch {
    return []
  }
}

export default function AgendaAttachments({
  attachments,
  onChange,
  canEdit = true,
}: {
  attachments: Attachment[]
  onChange: (next: Attachment[]) => void | Promise<void>
  canEdit?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: Attachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) { toast.error(`${file.name}: max 50 MB`); continue }
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const res = await uploadToBlob(`agenda-bijlagen/${Date.now()}-${safe}`, file)
        added.push({ url: res.url, name: file.name, size: file.size })
      } catch {
        toast.error(`Upload mislukt: ${file.name}`)
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    if (added.length) {
      await onChange([...attachments, ...added])
      toast.success(added.length === 1 ? 'Bijlage toegevoegd' : `${added.length} bijlagen toegevoegd`)
    }
  }

  const remove = async (url: string) => {
    if (!confirm('Bijlage verwijderen?')) return
    await onChange(attachments.filter((a) => a.url !== url))
  }

  if (attachments.length === 0 && !canEdit) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
      {attachments.map((a) => (
        <span key={a.url} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-xs">
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            download={a.name}
            className="flex items-center gap-1 text-blue-300 hover:text-blue-200 max-w-[180px]"
            title={`${a.name} — klik om te downloaden`}
          >
            <Icons.paperclip size={11} className="flex-shrink-0" />
            <span className="truncate">{a.name}</span>
          </a>
          {canEdit && (
            <button
              onClick={() => remove(a.url)}
              className="p-0.5 text-blue-300/60 hover:text-red-400 transition-colors"
              title="Bijlage verwijderen"
            >
              <Icons.x size={10} />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
          title="Bestand uploaden (PDF, Word, Excel, PowerPoint of afbeelding — max 50 MB)"
        >
          {uploading
            ? <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            : <Icons.paperclip size={11} />}
          {uploading ? 'Uploaden…' : 'Bijlage'}
        </button>
      )}
      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
    </div>
  )
}
