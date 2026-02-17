'use client'

import { useState, useRef } from 'react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

interface DocumentUploaderProps {
  projectId?: string | null
  onUpload?: (doc: UploadedDocument) => void
  compact?: boolean
}

interface UploadedDocument {
  id: string
  name: string
  fileType: string
  fileSize: number
  createdAt: string
}

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp']
const MAX_SIZE = 32 * 1024 * 1024 // 32MB (PDFs tot 32MB, overige tot 10MB)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentUploader({ projectId, onUpload, compact = false }: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Bestandstype .${ext} niet ondersteund. Toegestaan: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
    const maxForType = ext === 'pdf' ? 32 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxForType) {
      return `Bestand is te groot (max ${ext === 'pdf' ? '32' : '10'}MB)`
    }
    return null
  }

  const uploadFile = async (file: File) => {
    const error = validateFile(file)
    if (error) {
      toast.error(error)
      return
    }

    setIsUploading(true)
    setUploadProgress(`Uploaden: ${file.name}...`)

    try {
      const formData = new FormData()
      formData.append('file', file)
      if (projectId) formData.append('projectId', projectId)

      const res = await fetch('/api/claude/documents', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload mislukt')
      }

      const doc = await res.json()
      toast.success(`${file.name} geüpload!`)
      onUpload?.(doc)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload mislukt'
      toast.error(message)
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = ''
  }

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <div className="animate-spin">
              <Icons.refresh size={14} />
            </div>
          ) : (
            <Icons.upload size={14} />
          )}
          <span>{isUploading ? 'Uploaden...' : 'Document uploaden'}</span>
        </button>
      </>
    )
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-workx-lime bg-workx-lime/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <div className="space-y-2">
          {isUploading ? (
            <>
              <div className="w-10 h-10 mx-auto rounded-xl bg-workx-lime/10 flex items-center justify-center animate-pulse">
                <Icons.upload size={20} className="text-workx-lime" />
              </div>
              <p className="text-sm text-white/60">{uploadProgress}</p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 mx-auto rounded-xl bg-white/5 flex items-center justify-center">
                <Icons.upload size={20} className="text-white/40" />
              </div>
              <p className="text-sm text-white/60">
                Sleep een bestand hierheen of <span className="text-workx-lime">klik om te selecteren</span>
              </p>
              <p className="text-[11px] text-white/30">PDF, DOCX, TXT, MD, afbeeldingen — max 32MB (PDF) / 10MB (overig)</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
