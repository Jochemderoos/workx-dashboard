'use client'

import { useState, useEffect, useRef } from 'react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

interface Template {
  id: string
  name: string
  category: string
  description: string | null
  fileType: string
  fileSize: number
  placeholders: string | null
  isActive: boolean
  usageCount: number
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: 'arbeidsrecht', label: 'Arbeidsrecht' },
  { value: 'procesrecht', label: 'Procesrecht' },
  { value: 'contracten', label: 'Contracten' },
  { value: 'correspondentie', label: 'Correspondentie' },
  { value: 'overig', label: 'Overig' },
]

const ALLOWED_EXTENSIONS = ['docx', 'pdf', 'txt', 'md']

export default function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [generateTemplateId, setGenerateTemplateId] = useState<string | null>(null)
  const [generatePrompt, setGeneratePrompt] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadForm, setUploadForm] = useState({
    name: '',
    category: 'arbeidsrecht',
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/claude/templates')
      if (res.ok) {
        setTemplates(await res.json())
      }
    } catch {
      toast.error('Kon templates niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const uploadMultipleTemplates = async (files: File[]) => {
    const validFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() || ''
      return ALLOWED_EXTENSIONS.includes(ext)
    })

    if (validFiles.length === 0) {
      toast.error('Geen geldige bestanden geselecteerd (DOCX, PDF, TXT, MD)')
      return
    }

    setIsUploading(true)
    const results: Array<{ name: string; success: boolean }> = []

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      setUploadProgress(`Template ${i + 1}/${validFiles.length} uploaden: ${file.name}...`)

      try {
        const fd = new FormData()
        fd.append('file', file)
        // Use filename without extension as template name
        fd.append('name', file.name.replace(/\.[^.]+$/, ''))
        fd.append('category', uploadForm.category)

        const res = await fetch('/api/claude/templates', {
          method: 'POST',
          body: fd,
        })

        if (res.ok) {
          const template = await res.json()
          setTemplates(prev => [template, ...prev])
          results.push({ name: file.name, success: true })
        } else {
          results.push({ name: file.name, success: false })
        }
      } catch {
        results.push({ name: file.name, success: false })
      }
    }

    setIsUploading(false)
    setUploadProgress('')
    setShowUpload(false)

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    if (succeeded > 0) {
      toast.success(`${succeeded} template${succeeded !== 1 ? 's' : ''} toegevoegd!${failed > 0 ? ` (${failed} mislukt)` : ''}`)
    } else {
      toast.error('Upload mislukt')
    }
  }

  const uploadTemplate = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Bestandstype .${ext} niet ondersteund`)
      return
    }

    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('name', uploadForm.name.trim() || file.name.replace(/\.[^.]+$/, ''))
      fd.append('category', uploadForm.category)

      const res = await fetch('/api/claude/templates', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload mislukt')
      }

      const template = await res.json()
      setTemplates([template, ...templates])
      setShowUpload(false)
      setUploadForm({ name: '', category: 'arbeidsrecht' })
      toast.success(`Template "${template.name}" toegevoegd! Claude analyseert de structuur.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setIsUploading(false)
    }
  }

  const deleteTemplate = async (id: string) => {
    try {
      await fetch(`/api/claude/templates/${id}`, { method: 'DELETE' })
      setTemplates(templates.filter(t => t.id !== id))
      toast.success('Template verwijderd')
    } catch {
      toast.error('Kon template niet verwijderen')
    }
  }

  const downloadTemplate = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/claude/templates/${id}`)
      if (!res.ok) throw new Error('Download mislukt')

      const data = await res.json()
      if (!data.fileBase64) {
        toast.error('Geen origineel bestand beschikbaar')
        return
      }

      // Convert data URL to blob and download
      const resp = await fetch(data.fileBase64)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}.${data.fileType}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download mislukt')
    }
  }

  const startGenerate = (templateId: string) => {
    setGenerateTemplateId(templateId)
    setGeneratePrompt('')
    setGeneratedContent('')
  }

  const generateDocument = async () => {
    if (!generateTemplateId || !generatePrompt.trim()) return

    setIsGenerating(true)
    setGeneratedContent('')

    try {
      const res = await fetch(`/api/claude/templates/${generateTemplateId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: generatePrompt }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Generatie mislukt')
      }

      // Read SSE stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ') && !line.startsWith('data: {')) {
              setGeneratedContent(prev => prev + line.slice(6))
            } else if (line.startsWith('event: done')) {
              toast.success('Document gegenereerd!')
            } else if (line.startsWith('event: error')) {
              // Next data line is error
            }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generatie mislukt')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent)
    toast.success('Gekopieerd naar klembord!')
  }

  const getPlaceholders = (template: Template): string[] => {
    if (!template.placeholders) return []
    try {
      return JSON.parse(template.placeholders)
    } catch {
      return []
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/60">Workx Templates</p>
          <p className="text-xs text-white/30">
            Upload Workx templates — Claude kan ze invullen met de juiste gegevens
          </p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
        >
          <Icons.upload size={16} />
          Template uploaden
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">Nieuw Workx template</h3>
            <button onClick={() => setShowUpload(false)} className="p-1 text-white/30 hover:text-white">
              <Icons.x size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Template naam</label>
              <input
                type="text"
                value={uploadForm.name}
                onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                placeholder="bijv. Vaststellingsovereenkomst"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 block mb-1">Categorie</label>
              <select
                value={uploadForm.category}
                onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-workx-lime/40"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-workx-dark">{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf,.txt,.md"
              multiple
              onChange={(e) => {
                const files = e.target.files
                if (files && files.length > 0) {
                  uploadMultipleTemplates(Array.from(files))
                }
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full p-6 rounded-xl border-2 border-dashed border-white/10 hover:border-workx-lime/30 text-center cursor-pointer transition-all hover:bg-white/[0.02]"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const files = Array.from(e.dataTransfer.files)
                if (files.length > 0) uploadMultipleTemplates(files)
              }}
            >
              {isUploading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-full border-2 border-workx-lime/30 border-t-workx-lime animate-spin" />
                  <span className="text-sm text-workx-lime/80">{uploadProgress}</span>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white/5 flex items-center justify-center">
                    <Icons.fileText size={20} className="text-white/40" />
                  </div>
                  <p className="text-sm text-white/50">
                    Klik of sleep bestanden hierheen
                  </p>
                  <p className="text-[11px] text-white/25 mt-1">
                    Meerdere bestanden tegelijk mogelijk — DOCX (aanbevolen), PDF, TXT
                  </p>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl bg-white/[0.02] border border-white/10 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
            <Icons.fileText size={24} className="text-white/20" />
          </div>
          <p className="text-sm text-white/40 mb-1">Nog geen templates</p>
          <p className="text-xs text-white/25 max-w-md mx-auto">
            Upload Workx templates (vaststellingsovereenkomsten, dagvaardingen, brieven, etc.)
            zodat Claude ze kan invullen met de juiste gegevens. De Word-stijl en het logo worden bewaard.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const placeholders = getPlaceholders(template)
            const isGenerateOpen = generateTemplateId === template.id

            return (
              <div key={template.id} className="rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors group">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* File icon */}
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    {template.fileType === 'docx' ? (
                      <span className="text-blue-400 text-xs font-bold">W</span>
                    ) : template.fileType === 'pdf' ? (
                      <span className="text-red-400 text-xs font-bold">PDF</span>
                    ) : (
                      <Icons.fileText size={16} className="text-white/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white/80 font-medium truncate">{template.name}</p>
                      <span className="text-[10px] text-white/30 uppercase">{template.fileType}</span>
                      <span className="text-[10px] text-white/20">{formatSize(template.fileSize)}</span>
                    </div>
                    {template.description && (
                      <p className="text-[11px] text-white/35 truncate mt-0.5">{template.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {placeholders.length > 0 && (
                        <span className="text-[10px] text-white/25">
                          {placeholders.length} invulveld{placeholders.length !== 1 ? 'en' : ''}
                        </span>
                      )}
                      {template.usageCount > 0 && (
                        <span className="text-[10px] text-workx-lime/50">
                          {template.usageCount}x gebruikt
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => isGenerateOpen ? setGenerateTemplateId(null) : startGenerate(template.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 transition-colors"
                      title="Claude vult dit template in"
                    >
                      <Icons.sparkles size={12} />
                      <span>Invullen</span>
                    </button>
                    <button
                      onClick={() => downloadTemplate(template.id, template.name)}
                      className="p-2 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                      title="Download origineel"
                    >
                      <Icons.download size={14} />
                    </button>
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Verwijderen"
                    >
                      <Icons.trash size={14} />
                    </button>
                  </div>
                </div>

                {/* Generate panel */}
                {isGenerateOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
                    {placeholders.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] text-white/30">Invulvelden:</span>
                        {placeholders.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    <div>
                      <textarea
                        value={generatePrompt}
                        onChange={(e) => setGeneratePrompt(e.target.value)}
                        placeholder="Beschrijf de gegevens voor dit template, bijv: 'Vaststellingsovereenkomst voor Jan de Vries, functie Senior Ontwikkelaar bij TechCo BV, salaris €6.500 bruto per maand, in dienst sinds 1 maart 2019, einddatum 1 april 2025, transitievergoeding €18.500...'"
                        rows={3}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-workx-lime/40 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={generateDocument}
                        disabled={isGenerating || !generatePrompt.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <>
                            <div className="w-4 h-4 rounded-full border-2 border-workx-dark/30 border-t-workx-dark animate-spin" />
                            Genereren...
                          </>
                        ) : (
                          <>
                            <Icons.sparkles size={14} />
                            Genereer document
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setGenerateTemplateId(null)}
                        className="px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        Annuleren
                      </button>
                    </div>

                    {/* Generated content */}
                    {generatedContent && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-white/40 font-medium">Gegenereerd document</span>
                          <button
                            onClick={copyToClipboard}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-white/40 hover:text-workx-lime hover:bg-workx-lime/10 transition-colors"
                          >
                            <Icons.copy size={12} />
                            Kopiëren
                          </button>
                        </div>
                        <div className="max-h-96 overflow-y-auto rounded-lg bg-white/[0.02] border border-white/10 p-4">
                          <pre className="text-xs text-white/70 whitespace-pre-wrap font-mono leading-relaxed">
                            {generatedContent}
                          </pre>
                        </div>
                        <p className="text-[10px] text-white/25">
                          Tip: Kopieer de tekst en plak in het originele Word template om de Workx stijl te behouden.
                          Of vraag Claude in de chat om aanpassingen te maken.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Info box */}
      <div className="rounded-xl bg-white/[0.02] border border-white/10 p-4">
        <div className="flex gap-3">
          <Icons.info size={16} className="text-workx-lime/60 mt-0.5 shrink-0" />
          <div className="text-[11px] text-white/40 space-y-1.5">
            <p><strong className="text-white/60">Hoe werken Workx Templates?</strong></p>
            <p>Upload je Word templates (DOCX). Claude analyseert de structuur en herkent automatisch de invulvelden. Als je op &quot;Invullen&quot; klikt, genereert Claude een ingevuld document op basis van de gegevens die je opgeeft.</p>
            <p><strong className="text-white/50">De Word-stijl behouden:</strong> Het originele bestand wordt bewaard. Kopieer de gegenereerde tekst in het Word template, of download het origineel en pas het handmatig aan.</p>
            <p>Je kunt ook in de <strong className="text-white/50">chat</strong> vragen: &quot;Vul de vaststellingsovereenkomst in voor ...&quot; — Claude kent je templates!</p>
          </div>
        </div>
      </div>
    </div>
  )
}
