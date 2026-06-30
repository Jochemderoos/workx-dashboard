'use client'

// Stock Foto's — professionele kantoorfoto's die het team kan downloaden
// voor nieuwsbrieven, pitches, social, etc. Beheerders kunnen foto's toevoegen.

import { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { uploadToBlob } from '@/lib/blob-upload'

interface StockPhoto {
  id: string
  url: string
  title: string | null
  category: string | null
  createdAt: string
  uploadedBy: { id: string; name: string } | null
}

// Alleen partners en Hanna (ADMIN) mogen stock-foto's beheren.
const MANAGER_ROLES = ['PARTNER', 'ADMIN']

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'foto'
}

export default function StockFotosPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role || ''
  const userId = (session?.user as { id?: string })?.id
  const isManager = MANAGER_ROLES.includes(role)

  const [photos, setPhotos] = useState<StockPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<StockPhoto | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  // upload-state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ title: string; category: string }>({ title: '', category: '' })
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    fetch('/api/stock-photos')
      .then(r => r.ok ? r.json() : [])
      .then(d => setPhotos(Array.isArray(d) ? d : []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function download(photo: StockPhoto) {
    setDownloading(photo.id)
    try {
      const res = await fetch(photo.url)
      const blob = await res.blob()
      const ext = (photo.url.split('.').pop() || 'jpg').split('?')[0]
      const base = photo.title ? slugify(photo.title) : `workx-stockfoto-${photo.id.slice(0, 6)}`
      const a = document.createElement('a')
      const objUrl = URL.createObjectURL(blob)
      a.href = objUrl
      a.download = `${base}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch {
      // val terug op direct openen als download mislukt
      window.open(photo.url, '_blank')
    } finally {
      setDownloading(null)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError(null)
    setUploading(true)
    try {
      const list = Array.from(files)
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        if (!file.type.startsWith('image/')) {
          throw new Error(`"${file.name}" is geen afbeelding`)
        }
        setUploadProgress(`Uploaden ${i + 1} van ${list.length}…`)
        // Stap 1: rechtstreeks naar Blob (volledige kwaliteit, tot 50MB).
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 40)
        const { url } = await uploadToBlob(`stock-fotos/${Date.now()}-${i}-${safe}.${ext}`, file)
        // Stap 2: metadata registreren.
        const res = await fetch('/api/stock-photos', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url, title: meta.title || null, category: meta.category || null }),
        })
        if (!res.ok) {
          const e = await res.json().catch(() => ({}))
          throw new Error(e.error || 'Opslaan mislukt')
        }
      }
      setMeta({ title: '', category: '' })
      load()
    } catch (e: any) {
      setUploadError(e?.message || 'Upload mislukt')
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  async function remove(photo: StockPhoto) {
    if (!confirm('Deze foto verwijderen?')) return
    const res = await fetch(`/api/stock-photos?id=${photo.id}`, { method: 'DELETE' })
    if (res.ok) {
      setPhotos(p => p.filter(x => x.id !== photo.id))
      setLightbox(l => (l?.id === photo.id ? null : l))
    }
  }

  const canManage = (photo: StockPhoto) => isManager || photo.uploadedBy?.id === userId

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Icons.image className="text-workx-lime" size={22} /> Stock Foto's
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Professionele kantoorfoto's om vrij te gebruiken — voor de nieuwsbrief, een pitch, social media of presentaties.
            Klik op een foto om groot te bekijken, of download direct.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-primary flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <Icons.upload size={16} /> {uploading ? (uploadProgress || 'Uploaden…') : 'Foto toevoegen'}
          </button>
        )}
      </div>

      {/* Upload-zone (alleen beheerders) */}
      {isManager && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
          className={`card border-2 border-dashed p-4 transition-colors ${dragOver ? 'border-workx-lime bg-workx-lime/5' : 'border-white/10'}`}
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-gray-400 mb-1">Titel (optioneel)</label>
              <input
                value={meta.title}
                onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
                placeholder="bv. Werkplek met uitzicht"
                className="input-field w-full text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-gray-400 mb-1">Categorie (optioneel)</label>
              <input
                value={meta.category}
                onChange={e => setMeta(m => ({ ...m, category: e.target.value }))}
                placeholder="bv. Kantoor, Detail, Team"
                className="input-field w-full text-sm"
              />
            </div>
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Icons.plus size={16} /> Bestand kiezen
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Sleep hier afbeeldingen naartoe of klik op "Bestand kiezen". Je kunt meerdere foto's tegelijk uploaden (max. 50 MB per foto, volledige kwaliteit blijft behouden — geen compressie). Titel/categorie gelden voor deze upload.
          </p>
          {uploadError && <p className="text-xs text-red-400 mt-2">{uploadError}</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Galerij */}
      {loading ? (
        <div className="text-gray-400 py-10 text-center">Laden…</div>
      ) : photos.length === 0 ? (
        <div className="card p-10 text-center">
          <Icons.image className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-300 font-medium">Nog geen stock foto's</p>
          <p className="text-sm text-gray-500 mt-1">
            {isManager ? 'Voeg de eerste foto toe via de knop hierboven.' : 'Er zijn nog geen foto\'s toegevoegd.'}
          </p>
        </div>
      ) : (
        <div className="[column-fill:_balance] columns-1 sm:columns-2 lg:columns-3 gap-4 [&>*]:mb-4">
          {photos.map(photo => (
            <figure
              key={photo.id}
              className="group relative break-inside-avoid overflow-hidden rounded-xl ring-1 ring-white/10 bg-workx-dark cursor-zoom-in"
              onClick={() => setLightbox(photo)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.title || 'Workx stock foto'}
                loading="lazy"
                className="w-full h-auto block transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {/* overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <figcaption className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="min-w-0">
                  {photo.title && <p className="text-white text-sm font-medium truncate">{photo.title}</p>}
                  {photo.category && <p className="text-white/70 text-[11px] truncate">{photo.category}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {canManage(photo) && (
                    <button
                      onClick={e => { e.stopPropagation(); remove(photo) }}
                      title="Verwijderen"
                      className="p-2 rounded-lg bg-black/50 hover:bg-red-500/80 text-white backdrop-blur transition-colors"
                    >
                      <Icons.trash size={15} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); download(photo) }}
                    title="Download"
                    className="p-2 rounded-lg bg-workx-lime text-workx-dark hover:bg-workx-lime/90 transition-colors disabled:opacity-60"
                    disabled={downloading === photo.id}
                  >
                    <Icons.download size={15} />
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 fade-in"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
            title="Sluiten"
          >
            <Icons.x size={20} />
          </button>
          <div className="max-w-5xl w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.title || 'Workx stock foto'}
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
            <div className="mt-4 flex items-center gap-3 flex-wrap justify-center">
              <div className="text-center sm:text-left">
                {lightbox.title && <p className="text-white text-sm font-medium">{lightbox.title}</p>}
                <p className="text-white/50 text-[11px]">
                  {[lightbox.category, lightbox.uploadedBy?.name].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => download(lightbox)}
                disabled={downloading === lightbox.id}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                <Icons.download size={16} /> {downloading === lightbox.id ? 'Downloaden…' : 'Download foto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
