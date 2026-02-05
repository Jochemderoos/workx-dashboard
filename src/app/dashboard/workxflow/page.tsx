'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

interface Production {
  id: string
  productionNumber: number
  title: string
  documentUrl?: string
  documentName?: string
  documentType?: string
  pageCount: number
  sortOrder: number
  file?: File // For local file before upload
  previewUrl?: string // For local preview
}

interface Bundle {
  id: string
  title: string
  caseNumber?: string
  clientName?: string
  mainDocumentUrl?: string
  mainDocumentName?: string
  mainDocumentType?: string
  status: string
  productions: Production[]
  createdAt: string
}

export default function WorkxflowPage() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [activeBundle, setActiveBundle] = useState<Bundle | null>(null)
  const [showNewBundleForm, setShowNewBundleForm] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const mainDocInputRef = useRef<HTMLInputElement>(null)
  const productionInputRef = useRef<HTMLInputElement>(null)

  // Check if running in Electron
  useEffect(() => {
    // @ts-ignore
    setIsElectron(typeof window !== 'undefined' && window.electronAPI !== undefined)
  }, [])

  // Fetch bundles
  useEffect(() => {
    fetchBundles()
  }, [])

  const fetchBundles = async () => {
    try {
      const res = await fetch('/api/workxflow')
      if (res.ok) {
        const data = await res.json()
        setBundles(data.bundles || [])
      }
    } catch (error) {
      console.error('Error fetching bundles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createBundle = async (title: string, caseNumber?: string, clientName?: string) => {
    try {
      const res = await fetch('/api/workxflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, caseNumber, clientName }),
      })
      if (res.ok) {
        const newBundle = await res.json()
        setBundles(prev => [newBundle, ...prev])
        setActiveBundle(newBundle)
        setShowNewBundleForm(false)
        toast.success('Bundle aangemaakt')
      } else {
        toast.error('Kon bundle niet aanmaken')
      }
    } catch (error) {
      toast.error('Kon bundle niet aanmaken')
    }
  }

  const uploadMainDocument = async (file: File) => {
    if (!activeBundle) return

    // For now, store as base64 (in production, use proper file storage)
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string

      try {
        const res = await fetch(`/api/workxflow/${activeBundle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mainDocumentUrl: dataUrl,
            mainDocumentName: file.name,
            mainDocumentType: file.type.includes('pdf') ? 'pdf' : 'docx',
          }),
        })
        if (res.ok) {
          const updated = await res.json()
          setActiveBundle(updated)
          setBundles(prev => prev.map(b => b.id === updated.id ? updated : b))
          toast.success('Processtuk geüpload')
        }
      } catch (error) {
        toast.error('Upload mislukt')
      }
    }
    reader.readAsDataURL(file)
  }

  const removeMainDocument = async () => {
    if (!activeBundle) return

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainDocumentUrl: null,
          mainDocumentName: null,
          mainDocumentType: null,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setActiveBundle(updated)
        setBundles(prev => prev.map(b => b.id === updated.id ? updated : b))
        toast.success('Processtuk verwijderd')
      }
    } catch (error) {
      toast.error('Verwijderen mislukt')
    }
  }

  const addProduction = async (file?: File) => {
    if (!activeBundle) return

    const nextNumber = activeBundle.productions.length + 1
    const production: Partial<Production> = {
      productionNumber: nextNumber,
      title: file ? file.name.replace(/\.[^/.]+$/, '') : `Productie ${nextNumber}`,
      sortOrder: nextNumber - 1,
      pageCount: 1,
    }

    if (file) {
      // Read file as base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        production.documentUrl = e.target?.result as string
        production.documentName = file.name
        production.documentType = file.type.includes('pdf') ? 'pdf' :
                                   file.type.includes('image') ? 'image' : 'docx'

        await saveProduction(production)
      }
      reader.readAsDataURL(file)
    } else {
      await saveProduction(production)
    }
  }

  const saveProduction = async (production: Partial<Production>) => {
    if (!activeBundle) return

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/productions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(production),
      })
      if (res.ok) {
        const newProduction = await res.json()
        setActiveBundle(prev => prev ? {
          ...prev,
          productions: [...prev.productions, newProduction]
        } : null)
        toast.success('Productie toegevoegd')
      }
    } catch (error) {
      toast.error('Kon productie niet toevoegen')
    }
  }

  const updateProduction = async (productionId: string, updates: Partial<Production>) => {
    if (!activeBundle) return

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/productions/${productionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setActiveBundle(prev => prev ? {
          ...prev,
          productions: prev.productions.map(p => p.id === productionId ? updated : p)
        } : null)
      }
    } catch (error) {
      toast.error('Kon productie niet bijwerken')
    }
  }

  const deleteProduction = async (productionId: string) => {
    if (!activeBundle) return

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/productions/${productionId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActiveBundle(prev => prev ? {
          ...prev,
          productions: prev.productions.filter(p => p.id !== productionId)
        } : null)
        toast.success('Productie verwijderd')
      }
    } catch (error) {
      toast.error('Kon productie niet verwijderen')
    }
  }

  const reorderProductions = async (fromIndex: number, toIndex: number) => {
    if (!activeBundle) return

    const newProductions = [...activeBundle.productions]
    const [moved] = newProductions.splice(fromIndex, 1)
    newProductions.splice(toIndex, 0, moved)

    // Update sort order and production numbers
    const updated = newProductions.map((p, i) => ({
      ...p,
      sortOrder: i,
      productionNumber: i + 1,
    }))

    setActiveBundle(prev => prev ? { ...prev, productions: updated } : null)

    // Save to server
    try {
      await fetch(`/api/workxflow/${activeBundle.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionIds: updated.map(p => p.id) }),
      })
    } catch (error) {
      console.error('Error saving order:', error)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return
    reorderProductions(draggedIndex, index)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const generatePdf = async () => {
    if (!activeBundle) return
    setIsGeneratingPdf(true)

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/pdf`, {
        method: 'POST',
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeBundle.title.replace(/\s+/g, '-')}-bundle.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('PDF gedownload')
      } else {
        toast.error('Kon PDF niet genereren')
      }
    } catch (error) {
      toast.error('Kon PDF niet genereren')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const printBundle = async () => {
    if (!activeBundle || !isElectron) {
      toast.error('Printen is alleen beschikbaar in de Workx Desktop app')
      return
    }

    setIsPrinting(true)

    try {
      // Generate PDF data
      const res = await fetch(`/api/workxflow/${activeBundle.id}/print-data`, {
        method: 'POST',
      })

      if (res.ok) {
        const printData = await res.json()

        // Send to Electron for printing
        // @ts-ignore
        const result = await window.electronAPI.printBundle(printData)

        if (result.success) {
          toast.success('Print opdracht verzonden')
          // Update status
          await fetch(`/api/workxflow/${activeBundle.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PRINTED' }),
          })
        } else {
          toast.error(result.error || 'Printen mislukt')
        }
      }
    } catch (error) {
      toast.error('Printen mislukt')
    } finally {
      setIsPrinting(false)
    }
  }

  const deleteBundle = async (bundleId: string) => {
    if (!confirm('Weet je zeker dat je deze bundle wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/workxflow/${bundleId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setBundles(prev => prev.filter(b => b.id !== bundleId))
        if (activeBundle?.id === bundleId) {
          setActiveBundle(null)
        }
        toast.success('Bundle verwijderd')
      }
    } catch (error) {
      toast.error('Kon bundle niet verwijderen')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center">
              <Icons.file className="text-workx-lime" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Workxflow</h1>
            {isElectron && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                Desktop
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">
            Document assembly voor dagvaardingen en producties
          </p>
        </div>

        <button
          onClick={() => setShowNewBundleForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90 transition-all"
        >
          <Icons.plus size={18} />
          Nieuwe Bundle
        </button>
      </div>


      {/* Desktop app info */}
      {!isElectron && (
        <div className="card p-4 border-green-500/30 bg-green-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Icons.printer className="text-green-400" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">Desktop App voor printen</h3>
                <p className="text-sm text-gray-400">
                  Voor het printen naar specifieke printer-lades (processtuk op briefpapier, productiesheets op geel papier).
                </p>
              </div>
            </div>
            <a
              href="https://github.com/Jochemderoos/workx-dashboard/releases/download/v1.0.0/WorkxDesktop.exe"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors whitespace-nowrap"
            >
              <Icons.download size={18} />
              Download voor Windows
            </a>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Bundle list */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h2 className="font-medium text-white mb-4">Bundles</h2>

            {bundles.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                <Icons.file className="mx-auto mb-3 text-gray-600" size={32} />
                <p className="text-gray-400 text-sm">Nog geen bundles</p>
                <button
                  onClick={() => setShowNewBundleForm(true)}
                  className="mt-3 text-workx-lime hover:underline text-sm"
                >
                  Maak je eerste bundle
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {bundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    onClick={() => setActiveBundle(bundle)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      activeBundle?.id === bundle.id
                        ? 'border-workx-lime/50 bg-workx-lime/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      bundle.status === 'PRINTED' ? 'bg-green-500/20' : 'bg-white/10'
                    }`}>
                      <Icons.file className={bundle.status === 'PRINTED' ? 'text-green-400' : 'text-gray-400'} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{bundle.title}</p>
                      <p className="text-xs text-gray-500">
                        {bundle.productions.length} producties
                        {bundle.caseNumber && ` • ${bundle.caseNumber}`}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteBundle(bundle.id) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Icons.trash size={14} />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active bundle editor */}
        <div className="lg:col-span-2">
          {activeBundle ? (
            <div className="space-y-4 h-full">
              {/* Bundle info */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-medium text-white">{activeBundle.title}</h2>
                    {activeBundle.caseNumber && (
                      <p className="text-sm text-gray-400">Zaak: {activeBundle.caseNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={generatePdf}
                      disabled={isGeneratingPdf}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15 text-sm"
                    >
                      {isGeneratingPdf ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icons.download size={16} />
                      )}
                      PDF
                    </button>
                    {isElectron && (
                      <button
                        onClick={printBundle}
                        disabled={isPrinting}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90 text-sm"
                      >
                        {isPrinting ? (
                          <span className="w-4 h-4 border-2 border-workx-dark border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Icons.printer size={16} />
                        )}
                        Printen
                      </button>
                    )}
                  </div>
                </div>

                {/* Main document upload */}
                <div className="border-2 border-dashed border-white/10 rounded-xl p-4">
                  {activeBundle.mainDocumentUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Icons.file className="text-blue-400" size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{activeBundle.mainDocumentName}</p>
                        <p className="text-xs text-gray-500">Processtuk</p>
                      </div>
                      <button
                        onClick={() => mainDocInputRef.current?.click()}
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
                        title="Vervangen"
                      >
                        <Icons.refresh size={16} />
                      </button>
                      <button
                        onClick={removeMainDocument}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Verwijderen"
                      >
                        <Icons.trash size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => mainDocInputRef.current?.click()}
                      className="text-center py-4 cursor-pointer hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Icons.upload className="mx-auto mb-2 text-gray-500" size={24} />
                      <p className="text-sm text-gray-400">Upload processtuk (PDF of Word)</p>
                      <p className="text-xs text-gray-600 mt-1">Dit document wordt zonder logo geprint</p>
                    </div>
                  )}
                  <input
                    ref={mainDocInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => e.target.files?.[0] && uploadMainDocument(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Productions */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-white">
                    Producties ({activeBundle.productions.length})
                  </h3>
                  <button
                    onClick={() => productionInputRef.current?.click()}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-workx-lime/20 text-workx-lime hover:bg-workx-lime/30 text-sm"
                  >
                    <Icons.upload size={14} />
                    Upload productie
                  </button>
                </div>

                <input
                  ref={productionInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  multiple
                  onChange={(e) => {
                    const files = e.target.files
                    if (files) {
                      Array.from(files).forEach(file => addProduction(file))
                    }
                    e.target.value = ''
                  }}
                  className="hidden"
                />

                {activeBundle.productions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                    <Icons.layers className="mx-auto mb-3 text-gray-600" size={32} />
                    <p className="text-gray-400 text-sm">Nog geen producties</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Producties worden op geel papier met logo geprint
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeBundle.productions
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((production, index) => (
                        <div
                          key={production.id}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            draggedIndex === index
                              ? 'border-workx-lime bg-workx-lime/10'
                              : 'border-white/10 bg-white/5'
                          } cursor-grab active:cursor-grabbing`}
                        >
                          <div className="text-gray-500">
                            <Icons.gripVertical size={16} />
                          </div>

                          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-yellow-400 font-bold text-sm">
                              {production.productionNumber}
                            </span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={production.title}
                              onChange={(e) => updateProduction(production.id, { title: e.target.value })}
                              className="w-full bg-transparent text-sm text-white border-none outline-none focus:ring-0"
                              placeholder="Titel productie..."
                            />
                            {production.documentName && (
                              <p className="text-xs text-gray-500 truncate">{production.documentName}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={production.productionNumber}
                              onChange={(e) => updateProduction(production.id, {
                                productionNumber: parseInt(e.target.value) || 1
                              })}
                              className="w-12 px-2 py-1 rounded bg-white/10 text-center text-xs text-gray-300 border border-white/10"
                              title="Productienummer"
                            />
                            <button
                              onClick={() => deleteProduction(production.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Icons.x size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* Info about printing */}
                <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-xs text-yellow-400">
                    <strong>Print info:</strong> Productiesheets worden automatisch gegenereerd met
                    "PRODUCTIE [nummer]" en worden geprint op geel papier met Workx logo (lade 2).
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Icons.file className="mx-auto mb-4 text-gray-600" size={48} />
              <h2 className="text-lg font-medium text-white mb-2">Selecteer een bundle</h2>
              <p className="text-gray-400 text-sm mb-4">
                Kies een bestaande bundle of maak een nieuwe aan
              </p>
              <button
                onClick={() => setShowNewBundleForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
              >
                <Icons.plus size={16} />
                Nieuwe Bundle
              </button>
            </div>
          )}
        </div>

        {/* Preview sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-4 sticky top-4">
            <h2 className="font-medium text-white mb-4 flex items-center gap-2">
              <Icons.eye size={16} className="text-workx-lime" />
              Document Preview
            </h2>

            {activeBundle ? (
              <div className="space-y-1">
                {/* Main document (processtuk) */}
                {activeBundle.mainDocumentUrl ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Icons.file className="text-blue-400" size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-blue-300 truncate">
                        {activeBundle.mainDocumentName || 'Processtuk'}
                      </p>
                      <p className="text-[10px] text-blue-400/60">Lade 1 • Briefpapier</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-white/20">
                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Icons.file className="text-gray-600" size={14} />
                    </div>
                    <p className="text-xs text-gray-500">Geen processtuk geüpload</p>
                  </div>
                )}

                {/* Productions with sheets */}
                {activeBundle.productions.length > 0 ? (
                  activeBundle.productions
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((production) => (
                      <div key={production.id} className="space-y-1">
                        {/* Production sheet (yellow) */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                          <div className="w-8 h-8 rounded bg-yellow-500/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-yellow-300 font-bold text-xs">
                              {production.productionNumber}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-yellow-300">
                              PRODUCTIE {production.productionNumber}
                            </p>
                            <p className="text-[10px] text-yellow-400/60">Lade 2 • Geel papier</p>
                          </div>
                        </div>

                        {/* Production document */}
                        {production.documentUrl ? (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 ml-4">
                            <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                              <Icons.file className="text-gray-400" size={10} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] text-gray-400 truncate">
                                {production.title || production.documentName}
                              </p>
                              <p className="text-[9px] text-gray-500">Lade 1 • Briefpapier</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-lg border border-dashed border-white/10 ml-4">
                            <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                              <Icons.file className="text-gray-600" size={10} />
                            </div>
                            <p className="text-[10px] text-gray-600 truncate">
                              {production.title || 'Geen document'}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-4 border-2 border-dashed border-white/10 rounded-lg">
                    <p className="text-xs text-gray-500">Nog geen producties</p>
                  </div>
                )}

                {/* Summary */}
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Totaal pagina's:</span>
                    <span className="text-white font-medium">
                      {(activeBundle.mainDocumentUrl ? 1 : 0) +
                       activeBundle.productions.length * 2}
                      <span className="text-gray-500 font-normal ml-1">
                        (geschat)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Gele vellen:</span>
                    <span className="text-yellow-400 font-medium">
                      {activeBundle.productions.length}
                    </span>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Legenda</p>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500/50" />
                    <span className="text-[10px] text-gray-400">Processtuk (lade 1)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50" />
                    <span className="text-[10px] text-gray-400">Productievel (lade 2, geel)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-white/10 border border-white/20" />
                    <span className="text-[10px] text-gray-400">Bijlage (lade 1)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                <Icons.eye className="mx-auto mb-2 text-gray-600" size={24} />
                <p className="text-xs text-gray-500">Selecteer een bundle<br />om preview te zien</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New bundle modal */}
      {showNewBundleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Nieuwe Bundle</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.target as HTMLFormElement
                const formData = new FormData(form)
                createBundle(
                  formData.get('title') as string,
                  formData.get('caseNumber') as string || undefined,
                  formData.get('clientName') as string || undefined
                )
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-1">Titel *</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                  placeholder="bijv. Dagvaarding Janssen vs. Pietersen"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Zaaknummer (optioneel)</label>
                <input
                  type="text"
                  name="caseNumber"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                  placeholder="bijv. 2024/12345"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cliënt (optioneel)</label>
                <input
                  type="text"
                  name="clientName"
                  className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-white"
                  placeholder="bijv. Janssen B.V."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewBundleForm(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
                >
                  Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
