'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

// Debounce hook
function useDebounceCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return debouncedFn
}

interface Production {
  id: string
  productionNumber: string
  title: string
  documentUrl?: string
  documentName?: string
  documentType?: string
  pageCount: number
  sortOrder: number
  file?: File // For local file before upload
  previewUrl?: string // For local preview
}

interface BundleLock {
  id: string
  lockedById: string
  lockedBy: { id: string; name: string }
  expiresAt: string
}

interface BundleAccessEntry {
  id: string
  userId: string
  accessLevel: string
  user: { id: string; name: string; avatarUrl: string | null }
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
  productionLabel: string // PRODUCTIE | BIJLAGE
  includeProductielijst: boolean
  productions: Production[]
  createdAt: string
  isOwner?: boolean
  accessLevel?: string
  lock?: BundleLock | null
  access?: BundleAccessEntry[]
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
  const [showPrinterSettings, setShowPrinterSettings] = useState(false)
  const [printerSettings, setPrinterSettings] = useState({
    selectedPrinter: '',
    tray1Name: 'Auto',
    tray2Name: 'Manual',
    colorMode: 'color' as 'color' | 'monochrome',
    duplex: false,
    processtukTray: 1 as number,      // Lade voor processtuk
    productiebladenTray: 2 as number, // Lade voor productiebladen (geel)
    bijlagenTray: 1 as number,        // Lade voor bijlagen
  })
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [includeLogoOnProcesstuk, setIncludeLogoOnProcesstuk] = useState(true)

  // Sharing & locking state
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [shareTeamMembers, setShareTeamMembers] = useState<Array<{ id: string; name: string; avatarUrl: string | null }>>([])
  const [lockRefreshTimer, setLockRefreshTimer] = useState<NodeJS.Timeout | null>(null)

  const mainDocInputRef = useRef<HTMLInputElement>(null)
  const productionInputRef = useRef<HTMLInputElement>(null)

  // Check if running in Electron and load printer settings
  useEffect(() => {
    // @ts-ignore
    const electronAvailable = typeof window !== 'undefined' && window.electronAPI !== undefined
    setIsElectron(electronAvailable)

    if (electronAvailable) {
      // Load printer settings
      // @ts-ignore
      window.electronAPI.getPrinterSettings().then((settings: any) => {
        setPrinterSettings(settings)
      })
      // Load available printers
      // @ts-ignore
      window.electronAPI.getPrinters().then((result: any) => {
        if (result.success && result.printers) {
          const names = result.printers.map((p: any) => p.name || p.deviceName || p)
          setAvailablePrinters(names)
        }
      })
    }
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

  // Lock management - acquire lock when opening a bundle for editing
  const acquireLock = async (bundleId: string) => {
    try {
      const res = await fetch(`/api/workxflow/${bundleId}/lock`, { method: 'POST' })
      if (res.status === 423) {
        const data = await res.json()
        toast.error(data.error || 'Bundle is vergrendeld')
        return false
      }
      return res.ok
    } catch {
      return true // Allow editing if lock service fails
    }
  }

  const releaseLock = async (bundleId: string) => {
    try {
      await fetch(`/api/workxflow/${bundleId}/lock`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  // Auto-refresh lock every 2 minutes while editing
  useEffect(() => {
    if (activeBundle) {
      const timer = setInterval(() => {
        acquireLock(activeBundle.id) // Refresh lock
      }, 2 * 60 * 1000)
      setLockRefreshTimer(timer)

      return () => clearInterval(timer)
    } else if (lockRefreshTimer) {
      clearInterval(lockRefreshTimer)
      setLockRefreshTimer(null)
    }
  }, [activeBundle?.id])

  // Release lock when switching bundles or leaving page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeBundle) {
        // Use sendBeacon for reliable delivery on page close
        navigator.sendBeacon(`/api/workxflow/${activeBundle.id}/lock?_method=DELETE`, '')
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [activeBundle?.id])

  const selectBundle = async (bundle: Bundle) => {
    // Release lock on previous bundle
    if (activeBundle && activeBundle.id !== bundle.id) {
      await releaseLock(activeBundle.id)
    }

    // Acquire lock on new bundle
    const locked = await acquireLock(bundle.id)
    if (!locked) return // Don't switch if locked by someone else

    setActiveBundle(bundle)
    setShowSharePanel(false)
  }

  // Sharing functions
  const loadTeamMembers = async () => {
    try {
      const res = await fetch('/api/responsibilities')
      if (res.ok) {
        const data = await res.json()
        setShareTeamMembers(
          (data.teamMembers || []).map((u: any) => ({
            id: u.id,
            name: u.name,
            avatarUrl: u.avatarUrl,
          }))
        )
      }
    } catch { /* ignore */ }
  }

  const shareBundle = async (userId: string) => {
    if (!activeBundle) return
    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, accessLevel: 'EDITOR' }),
      })
      if (res.ok) {
        const access = await res.json()
        setActiveBundle(prev => prev ? {
          ...prev,
          access: [...(prev.access || []), access],
        } : null)
        toast.success('Bundle gedeeld')
      }
    } catch {
      toast.error('Kon niet delen')
    }
  }

  const removeShare = async (userId: string) => {
    if (!activeBundle) return
    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/share?userId=${userId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setActiveBundle(prev => prev ? {
          ...prev,
          access: (prev.access || []).filter(a => a.userId !== userId),
        } : null)
        toast.success('Toegang verwijderd')
      }
    } catch {
      toast.error('Kon toegang niet verwijderen')
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
        toast.success('Processtuk aangemaakt')
      } else {
        toast.error('Kon processtuk niet aanmaken')
      }
    } catch (error) {
      toast.error('Kon processtuk niet aanmaken')
    }
  }

  const uploadMainDocument = async (file: File) => {
    if (!activeBundle) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      let fileData = e.target?.result as string
      let fileName = file.name
      let docType = 'other'
      const lowerName = file.name.toLowerCase()

      // Check if it's an Office file that needs conversion
      const isOfficeFile = /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(lowerName)

      if (isOfficeFile) {
        // Convert to PDF using ConvertAPI
        setIsConverting(true)
        toast.loading('Processtuk wordt geconverteerd naar PDF...', { id: 'converting-main' })

        try {
          const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileData: fileData,
              fileName: fileName,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            fileData = result.pdfData
            fileName = result.pdfName
            docType = 'pdf'
            toast.success('Geconverteerd naar PDF!', { id: 'converting-main' })
          } else {
            const error = await response.json()
            console.error('Conversion failed:', error)
            toast.error('Conversie mislukt, origineel bestand wordt opgeslagen', { id: 'converting-main' })
            docType = 'docx'
          }
        } catch (err) {
          console.error('Conversion error:', err)
          toast.error('Conversie mislukt, origineel bestand wordt opgeslagen', { id: 'converting-main' })
          docType = 'docx'
        } finally {
          setIsConverting(false)
        }
      } else if (file.type.includes('pdf') || lowerName.endsWith('.pdf')) {
        docType = 'pdf'
      }

      try {
        const res = await fetch(`/api/workxflow/${activeBundle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mainDocumentUrl: fileData,
            mainDocumentName: fileName,
            mainDocumentType: docType,
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
    const label = activeBundle.productionLabel === 'BIJLAGE' ? 'Bijlage' : 'Productie'
    const production: Partial<Production> = {
      productionNumber: String(nextNumber),
      title: file ? file.name.replace(/\.[^/.]+$/, '') : `${label} ${nextNumber}`,
      sortOrder: nextNumber - 1,
      pageCount: 1,
    }

    if (file) {
      // Read file as base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        let fileData = e.target?.result as string
        let fileName = file.name
        let docType = 'other'
        const lowerName = file.name.toLowerCase()

        // Check if it's an Office file that needs conversion
        const isOfficeFile = /\.(doc|docx|xls|xlsx|ppt|pptx)$/.test(lowerName)

        if (isOfficeFile) {
          // Convert to PDF using ConvertAPI
          setIsConverting(true)
          toast.loading('Bestand wordt geconverteerd naar PDF...', { id: 'converting' })

          try {
            const response = await fetch('/api/convert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileData: fileData,
                fileName: fileName,
              }),
            })

            if (response.ok) {
              const result = await response.json()
              fileData = result.pdfData
              fileName = result.pdfName
              docType = 'pdf'
              toast.success('Geconverteerd naar PDF!', { id: 'converting' })
            } else {
              const error = await response.json()
              console.error('Conversion failed:', error)
              toast.error('Conversie mislukt, origineel bestand wordt opgeslagen', { id: 'converting' })
              // Keep original file type
              if (/\.(doc|docx)$/.test(lowerName)) docType = 'docx'
              else if (/\.(xls|xlsx)$/.test(lowerName)) docType = 'excel'
              else if (/\.(ppt|pptx)$/.test(lowerName)) docType = 'powerpoint'
            }
          } catch (err) {
            console.error('Conversion error:', err)
            toast.error('Conversie mislukt, origineel bestand wordt opgeslagen', { id: 'converting' })
            if (/\.(doc|docx)$/.test(lowerName)) docType = 'docx'
            else if (/\.(xls|xlsx)$/.test(lowerName)) docType = 'excel'
            else if (/\.(ppt|pptx)$/.test(lowerName)) docType = 'powerpoint'
          } finally {
            setIsConverting(false)
          }
        } else if (file.type.includes('pdf') || lowerName.endsWith('.pdf')) {
          docType = 'pdf'
        } else if (file.type.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/.test(lowerName)) {
          docType = 'image'
        }

        production.documentUrl = fileData
        production.documentName = fileName
        production.documentType = docType

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

  // Local edit state for debounced fields (title, productionNumber)
  const [localEdits, setLocalEdits] = useState<Record<string, { title?: string; productionNumber?: string }>>({})

  const updateProductionServer = useCallback(async (bundleId: string, productionId: string, updates: Partial<Production>) => {
    try {
      const res = await fetch(`/api/workxflow/${bundleId}/productions/${productionId}`, {
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
  }, [])

  const debouncedUpdateProduction = useDebounceCallback(updateProductionServer, 500)

  // For title and productionNumber: update local state immediately, debounce server call
  const updateProductionField = (productionId: string, field: 'title' | 'productionNumber', value: string) => {
    setLocalEdits(prev => ({
      ...prev,
      [productionId]: { ...prev[productionId], [field]: value },
    }))
    if (activeBundle) {
      debouncedUpdateProduction(activeBundle.id, productionId, { [field]: value })
    }
  }

  // For non-debounced updates (like file uploads)
  const updateProduction = async (productionId: string, updates: Partial<Production>) => {
    if (!activeBundle) return
    await updateProductionServer(activeBundle.id, productionId, updates)
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

    // Store original state for rollback
    const originalProductions = [...activeBundle.productions]

    const newProductions = [...activeBundle.productions]
    const [moved] = newProductions.splice(fromIndex, 1)
    newProductions.splice(toIndex, 0, moved)

    // Update sort order and production numbers
    const updated = newProductions.map((p, i) => ({
      ...p,
      sortOrder: i,
      productionNumber: String(i + 1),
    }))

    // Optimistic UI update
    setActiveBundle(prev => prev ? { ...prev, productions: updated } : null)

    // Save to server with rollback on error
    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productionIds: updated.map(p => p.id) }),
      })
      if (!res.ok) throw new Error('Server error')
    } catch (error) {
      console.error('Error saving order:', error)
      // Rollback to original state
      setActiveBundle(prev => prev ? { ...prev, productions: originalProductions } : null)
      toast.error('Kon volgorde niet opslaan')
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

  const generatePdf = async (split = false) => {
    if (!activeBundle) return
    setIsGeneratingPdf(true)

    try {
      const res = await fetch(`/api/workxflow/${activeBundle.id}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeLogoOnProcesstuk, split, maxSizeMB: 20 }),
      })

      if (res.ok) {
        const contentType = res.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
          // Split mode: multiple PDFs returned as JSON
          const data = await res.json()
          if (data.split && data.parts) {
            for (const part of data.parts) {
              const base64Data = part.data.split(',')[1]
              const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
              const blob = new Blob([bytes], { type: 'application/pdf' })
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = part.name
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              // Small delay between downloads
              await new Promise(r => setTimeout(r, 500))
            }
            toast.success(`${data.parts.length} PDF-delen gedownload (totaal ${data.totalSizeMB} MB)`)
          }
        } else {
          // Single PDF
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${activeBundle.title.replace(/\s+/g, '-')}-compleet.pdf`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          toast.success('PDF gedownload')
        }
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

        // Override tray assignments based on user settings
        for (const job of printData.printJobs) {
          if (job.name === 'Processtuk') job.tray = printerSettings.processtukTray
          else if (job.name === 'Productiebladen') job.tray = printerSettings.productiebladenTray
          else job.tray = printerSettings.bijlagenTray
        }

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
    if (!confirm('Weet je zeker dat je dit processtuk wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/workxflow/${bundleId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setBundles(prev => prev.filter(b => b.id !== bundleId))
        if (activeBundle?.id === bundleId) {
          setActiveBundle(null)
        }
        toast.success('Processtuk verwijderd')
      }
    } catch (error) {
      toast.error('Kon processtuk niet verwijderen')
    }
  }

  const savePrinterSettings = async () => {
    if (!isElectron) return

    try {
      // @ts-ignore
      const result = await window.electronAPI.savePrinterSettings(printerSettings)
      if (result.success) {
        toast.success('Printer instellingen opgeslagen')
        setShowPrinterSettings(false)
      } else {
        toast.error('Kon instellingen niet opslaan')
      }
    } catch (error) {
      toast.error('Kon instellingen niet opslaan')
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
    <div className="space-y-6 animate-fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-workx-lime/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-[5%] w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

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

        <div className="flex items-center gap-2">
          {isElectron && (
            <button
              onClick={() => setShowPrinterSettings(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 text-gray-300 hover:bg-white/15 transition-all"
              title="Printer instellingen"
            >
              <Icons.settings size={18} />
            </button>
          )}
          <button
            onClick={() => setShowNewBundleForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90 transition-all"
          >
            <Icons.plus size={18} />
            Nieuw Processtuk
          </button>
        </div>
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
            <h2 className="font-medium text-white mb-4">Processtukken</h2>

            {bundles.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                <Icons.file className="mx-auto mb-3 text-gray-600" size={32} />
                <p className="text-gray-400 text-sm">Nog geen processtukken</p>
                <button
                  onClick={() => setShowNewBundleForm(true)}
                  className="mt-3 text-workx-lime hover:underline text-sm"
                >
                  Maak je eerste processtuk
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {bundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    onClick={() => selectBundle(bundle)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      activeBundle?.id === bundle.id
                        ? 'border-workx-lime/50 bg-workx-lime/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      bundle.status === 'PRINTED' ? 'bg-green-500/20' : bundle.lock ? 'bg-yellow-500/20' : 'bg-white/10'
                    }`}>
                      {bundle.lock && bundle.lock.lockedBy?.id !== session?.user?.id ? (
                        <Icons.lock className="text-yellow-400" size={18} />
                      ) : (
                        <Icons.file className={bundle.status === 'PRINTED' ? 'text-green-400' : 'text-gray-400'} size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-white truncate">{bundle.title}</p>
                        {bundle.isOwner === false && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex-shrink-0">Gedeeld</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {bundle.productions.length} {bundle.productionLabel === 'BIJLAGE' ? 'bijlagen' : 'producties'}
                        {bundle.caseNumber && ` • ${bundle.caseNumber}`}
                        {bundle.lock && bundle.lock.lockedBy?.id !== session?.user?.id && (
                          <span className="text-yellow-400"> • {bundle.lock.lockedBy.name} bewerkt</span>
                        )}
                      </p>
                    </div>
                    {(bundle.isOwner !== false) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteBundle(bundle.id) }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Icons.trash size={14} />
                      </button>
                    )}
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
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-white">{activeBundle.title}</h2>
                      {activeBundle.access && activeBundle.access.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {activeBundle.access.slice(0, 3).map(a => (
                            <div key={a.userId} className="w-6 h-6 rounded-full bg-blue-500/30 border-2 border-workx-dark flex items-center justify-center text-[9px] font-bold text-blue-300" title={a.user.name}>
                              {a.user.name.charAt(0)}
                            </div>
                          ))}
                          {activeBundle.access.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-white/10 border-2 border-workx-dark flex items-center justify-center text-[9px] text-gray-400">
                              +{activeBundle.access.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {activeBundle.caseNumber && (
                      <p className="text-sm text-gray-400">Zaak: {activeBundle.caseNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Share button - owner only */}
                    {activeBundle.isOwner !== false && (
                      <button
                        onClick={() => { setShowSharePanel(!showSharePanel); if (!showSharePanel) loadTeamMembers() }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 text-sm"
                        title="Deel met collega's"
                      >
                        <Icons.users size={14} />
                        Delen
                      </button>
                    )}
                    <button
                      onClick={() => generatePdf(false)}
                      disabled={isGeneratingPdf}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 text-sm font-medium"
                      title="Download complete PDF met processtuk, overzicht en alle producties"
                    >
                      {isGeneratingPdf ? (
                        <span className="w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icons.download size={16} />
                      )}
                      Volledige PDF
                    </button>
                    <button
                      onClick={() => generatePdf(true)}
                      disabled={isGeneratingPdf}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 text-sm"
                      title="Download PDF in delen (max 20 MB per bestand)"
                    >
                      <Icons.layers size={16} />
                      In Delen
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

                {/* Share panel */}
                {showSharePanel && activeBundle.isOwner !== false && (
                  <div className="mt-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                    <h4 className="text-sm font-medium text-blue-300 mb-3 flex items-center gap-2">
                      <Icons.users size={14} />
                      Delen met collega&apos;s
                    </h4>

                    {/* Current shares */}
                    {activeBundle.access && activeBundle.access.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {activeBundle.access.map(a => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-300">
                              {a.user.name.charAt(0)}
                            </div>
                            <span className="text-white flex-1">{a.user.name}</span>
                            <span className="text-xs text-gray-500">{a.accessLevel === 'EDITOR' ? 'Bewerker' : 'Kijker'}</span>
                            <button
                              onClick={() => removeShare(a.userId)}
                              className="p-1 rounded hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                            >
                              <Icons.x size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new share */}
                    <div className="flex flex-wrap gap-2">
                      {shareTeamMembers
                        .filter(m => m.id !== session?.user?.id && !(activeBundle.access || []).some(a => a.userId === m.id))
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => shareBundle(m.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:bg-blue-500/10 hover:border-blue-500/30 hover:text-blue-300 transition-all"
                          >
                            <Icons.plus size={12} />
                            {m.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

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

                {/* PDF opties */}
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeLogoOnProcesstuk}
                      onChange={(e) => setIncludeLogoOnProcesstuk(e.target.checked)}
                      className="w-4 h-4 rounded text-workx-lime bg-white/10 border-white/20 focus:ring-workx-lime"
                    />
                    <span className="text-sm text-gray-300">Logo toevoegen aan processtuk in PDF</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeBundle.includeProductielijst}
                      onChange={async (e) => {
                        const val = e.target.checked
                        setActiveBundle(prev => prev ? { ...prev, includeProductielijst: val } : null)
                        await fetch(`/api/workxflow/${activeBundle.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ includeProductielijst: val }),
                        })
                      }}
                      className="w-4 h-4 rounded text-workx-lime bg-white/10 border-white/20 focus:ring-workx-lime"
                    />
                    <span className="text-sm text-gray-300">Productielijst opnemen in PDF</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">Naamgeving:</span>
                    <select
                      value={activeBundle.productionLabel}
                      onChange={async (e) => {
                        const val = e.target.value
                        setActiveBundle(prev => prev ? { ...prev, productionLabel: val } : null)
                        setBundles(prev => prev.map(b => b.id === activeBundle.id ? { ...b, productionLabel: val } : b))
                        await fetch(`/api/workxflow/${activeBundle.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ productionLabel: val }),
                        })
                      }}
                      className="px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-white text-sm"
                    >
                      <option value="PRODUCTIE">Producties</option>
                      <option value="BIJLAGE">Bijlagen</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Productions */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-white">
                    {activeBundle.productionLabel === 'BIJLAGE' ? 'Bijlagen' : 'Producties'} ({activeBundle.productions.length})
                  </h3>
                  <button
                    onClick={() => productionInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-500/30 text-sm font-medium"
                  >
                    <Icons.upload size={16} />
                    Upload {activeBundle.productionLabel === 'BIJLAGE' ? 'Bijlage' : 'Productie'}
                  </button>
                </div>

                <input
                  ref={productionInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
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
                              value={localEdits[production.id]?.title ?? production.title}
                              onChange={(e) => updateProductionField(production.id, 'title', e.target.value)}
                              className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 px-2 py-1 rounded text-sm text-white border border-transparent hover:border-white/20 focus:border-workx-lime/50 outline-none transition-all"
                              placeholder="Klik om titel te bewerken..."
                            />
                            {production.documentName && (
                              <p className="text-xs text-gray-500 truncate mt-1 px-2">{production.documentName}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={localEdits[production.id]?.productionNumber ?? production.productionNumber}
                              onChange={(e) => updateProductionField(production.id, 'productionNumber', e.target.value)}
                              className="w-14 px-2 py-1 rounded bg-white/10 text-center text-xs text-gray-300 border border-white/10"
                              title="Nummer (bijv. 1, 1a, 1b)"
                              placeholder="Nr"
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

              </div>
            </div>
          ) : (
            <div className="card p-8 text-center">
              <Icons.file className="mx-auto mb-4 text-gray-600" size={48} />
              <h2 className="text-lg font-medium text-white mb-2">Selecteer een processtuk</h2>
              <p className="text-gray-400 text-sm mb-4">
                Kies een bestaand processtuk of maak een nieuwe aan
              </p>
              <button
                onClick={() => setShowNewBundleForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
              >
                <Icons.plus size={16} />
                Nieuw Processtuk
              </button>
            </div>
          )}
        </div>

        {/* Live Preview sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h2 className="font-medium text-white mb-4 flex items-center gap-2">
              <Icons.eye size={16} className="text-workx-lime" />
              Voorbeeld
            </h2>

            {activeBundle ? (
              <div className="space-y-4">
                {/* Main document (processtuk) with logo preview */}
                <div className="space-y-2 group">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Processtuk</p>
                    {activeBundle.mainDocumentUrl && (
                      <button
                        onClick={removeMainDocument}
                        className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        title="Verwijderen"
                      >
                        <Icons.trash size={12} />
                      </button>
                    )}
                  </div>
                  {activeBundle.mainDocumentUrl ? (
                    <div
                      className="relative bg-white rounded-lg overflow-hidden shadow-lg cursor-pointer hover:ring-2 hover:ring-workx-lime/50 transition-all"
                      style={{ aspectRatio: '210/297' }}
                      onClick={() => mainDocInputRef.current?.click()}
                      title="Klik om te vervangen"
                    >
                      {/* Workx logo overlay (top-left, flush) - using actual image */}
                      {includeLogoOnProcesstuk && (
                        <div className="absolute top-0 left-0 z-10">
                          <img
                            src="/workx-logo.png"
                            alt="Workx"
                            className="h-6 w-auto"
                          />
                        </div>
                      )}
                      {/* Document preview */}
                      {activeBundle.mainDocumentType === 'pdf' ? (
                        <iframe
                          src={activeBundle.mainDocumentUrl}
                          className="w-full h-full pointer-events-none border-0"
                          title="Processtuk preview"
                        />
                      ) : (
                        <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                          <div className="text-center p-2">
                            <div className="w-12 h-12 mx-auto mb-2 bg-blue-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold">DOC</span>
                            </div>
                            <p className="text-[9px] text-blue-700 font-medium">Word Document</p>
                            <p className="text-[7px] text-gray-500 mt-1 px-2 truncate">{activeBundle.mainDocumentName}</p>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600 to-blue-600/80 p-2">
                        <p className="text-[9px] text-white truncate font-medium">{activeBundle.mainDocumentName}</p>
                        <p className="text-[7px] text-blue-200">Klik om te vervangen</p>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="bg-white/5 rounded-lg border-2 border-dashed border-white/20 hover:border-workx-lime/50 flex items-center justify-center p-6 cursor-pointer transition-all"
                      style={{ aspectRatio: '210/297' }}
                      onClick={() => mainDocInputRef.current?.click()}
                    >
                      <div className="text-center">
                        <Icons.upload className="mx-auto text-gray-600 mb-2" size={24} />
                        <p className="text-xs text-gray-500">Klik om te uploaden</p>
                        <p className="text-[9px] text-gray-600 mt-1">PDF of Word document</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Productions with visual sheets */}
                {activeBundle.productions.length > 0 ? (
                  activeBundle.productions
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((production, index) => (
                      <div
                        key={production.id}
                        className="space-y-2 pt-2 border-t border-white/10 group relative"
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        {/* Header with drag handle and delete */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                              <Icons.gripVertical size={12} />
                            </span>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                              {activeBundle.productionLabel === 'BIJLAGE' ? 'Bijlage' : 'Productie'} {production.productionNumber}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteProduction(production.id)}
                            className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            title="Verwijderen"
                          >
                            <Icons.trash size={12} />
                          </button>
                        </div>

                        {/* Production sheet preview (yellow page with correct logo) */}
                        <div
                          className="relative rounded-lg overflow-hidden shadow-lg"
                          style={{
                            aspectRatio: '210/297',
                            background: '#f9ff85'
                          }}
                        >
                          {/* Workx logo (top-left, flush) - real image */}
                          <div className="absolute top-0 left-0">
                            <img
                              src="/workx-logo.png"
                              alt="Workx"
                              className="h-6 w-auto"
                            />
                          </div>
                          {/* Centered production text */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-[#1e1e1e] font-bold text-base tracking-wide">
                              {activeBundle.productionLabel === 'BIJLAGE' ? 'BIJLAGE' : 'PRODUCTIE'} {production.productionNumber}
                            </p>
                            <p className="text-[#1e1e1e]/60 text-[9px] mt-2 px-4 text-center line-clamp-2">
                              {production.title}
                            </p>
                          </div>
                          {/* Yellow indicator */}
                          <div className="absolute bottom-0 left-0 right-0 bg-yellow-600/40 p-1.5">
                            <p className="text-[8px] text-yellow-900 text-center font-medium">Lade {printerSettings.productiebladenTray} • Geel papier</p>
                          </div>
                        </div>

                        {/* Production document thumbnail */}
                        {production.documentUrl ? (
                          <div className="relative bg-white rounded-lg overflow-hidden shadow-md group/doc" style={{ aspectRatio: '210/297' }}>
                            {production.documentType === 'image' ? (
                              <img
                                src={production.documentUrl}
                                alt={production.title}
                                className="w-full h-full object-contain bg-gray-50"
                              />
                            ) : production.documentType === 'pdf' ? (
                              <iframe
                                src={production.documentUrl}
                                className="w-full h-full border-0"
                                title={`${activeBundle.productionLabel === 'BIJLAGE' ? 'Bijlage' : 'Productie'} ${production.productionNumber}`}
                              />
                            ) : production.documentType === 'excel' ? (
                              <div className="w-full h-full bg-green-50 flex items-center justify-center">
                                <div className="text-center p-2">
                                  <div className="w-10 h-10 mx-auto mb-2 bg-green-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">XLS</span>
                                  </div>
                                  <p className="text-[9px] text-green-700 font-medium">Excel</p>
                                  <p className="text-[7px] text-gray-500 mt-1 px-2 truncate">{production.documentName}</p>
                                </div>
                              </div>
                            ) : production.documentType === 'powerpoint' ? (
                              <div className="w-full h-full bg-orange-50 flex items-center justify-center">
                                <div className="text-center p-2">
                                  <div className="w-10 h-10 mx-auto mb-2 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">PPT</span>
                                  </div>
                                  <p className="text-[9px] text-orange-700 font-medium">PowerPoint</p>
                                  <p className="text-[7px] text-gray-500 mt-1 px-2 truncate">{production.documentName}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                                <div className="text-center p-2">
                                  <div className="w-10 h-10 mx-auto mb-2 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-sm">DOC</span>
                                  </div>
                                  <p className="text-[9px] text-blue-700 font-medium">Word</p>
                                  <p className="text-[7px] text-gray-500 mt-1 px-2 truncate">{production.documentName}</p>
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-700 to-gray-700/80 p-1.5">
                              <p className="text-[8px] text-white truncate font-medium">{production.documentName || production.title}</p>
                              <p className="text-[7px] text-gray-300">Lade {printerSettings.bijlagenTray} • Blanco papier</p>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white/5 rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center p-4" style={{ aspectRatio: '210/297' }}>
                            <div className="text-center">
                              <Icons.file className="mx-auto text-gray-600 mb-1" size={20} />
                              <p className="text-[9px] text-gray-500">Geen bijlage</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="text-center py-6 border-2 border-dashed border-white/10 rounded-lg">
                    <Icons.layers className="mx-auto text-gray-600 mb-2" size={28} />
                    <p className="text-sm text-gray-500">Nog geen producties</p>
                    <p className="text-[10px] text-gray-600 mt-1">Upload producties om preview te zien</p>
                  </div>
                )}

                {/* Summary */}
                <div className="pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Totaal documenten:</span>
                    <span className="text-white font-medium">
                      {(activeBundle.mainDocumentUrl ? 1 : 0) +
                       activeBundle.productions.length +
                       activeBundle.productions.filter(p => p.documentUrl).length}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Gele {activeBundle.productionLabel === 'BIJLAGE' ? 'bijlagevellen' : 'productievellen'}:</span>
                    <span className="text-yellow-400 font-medium">
                      {activeBundle.productions.length}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-lg">
                <Icons.eye className="mx-auto mb-2 text-gray-600" size={24} />
                <p className="text-xs text-gray-500">Selecteer een processtuk<br />om preview te zien</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New bundle modal */}
      {showNewBundleForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-white mb-4">Nieuw Processtuk</h3>
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

      {/* Printer settings modal */}
      {showPrinterSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white">Printer Instellingen</h3>
              <button
                onClick={() => setShowPrinterSettings(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10"
              >
                <Icons.x size={18} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Printer selection */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Printer</label>
                <select
                  value={printerSettings.selectedPrinter}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, selectedPrinter: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/10 text-white"
                >
                  <option value="">Standaard printer</option>
                  {availablePrinters.map((printer) => (
                    <option key={printer} value={printer}>{printer}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Selecteer de printer voor Workxflow documenten</p>
              </div>

              {/* Tray 1 - Briefpapier */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Lade voor Briefpapier
                  <span className="text-blue-400 ml-2 text-xs font-normal">(processtuk + bijlagen)</span>
                </label>
                <input
                  type="text"
                  value={printerSettings.tray1Name}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, tray1Name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/10 text-white"
                  placeholder="bijv. Tray 1, Auto, Cassette 1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Veelvoorkomende waarden: Auto, Manual, Tray 1, Tray 2, Cassette 1, Drawer 1
                </p>
              </div>

              {/* Tray 2 - Geel papier */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Lade voor Geel Papier
                  <span className="text-yellow-400 ml-2 text-xs font-normal">(productievellen)</span>
                </label>
                <input
                  type="text"
                  value={printerSettings.tray2Name}
                  onChange={(e) => setPrinterSettings(prev => ({ ...prev, tray2Name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/10 border border-white/10 text-white"
                  placeholder="bijv. Tray 2, Manual, Cassette 2"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Dit is de lade waar het gele papier met logo in zit
                </p>
              </div>

              {/* Tray assignment per job type */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Lade-toewijzing per onderdeel</label>
                <p className="text-xs text-gray-500 mb-3">Kies welke lade voor elk onderdeel wordt gebruikt</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-32">Processtuk</span>
                    <select
                      value={printerSettings.processtukTray}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, processtukTray: Number(e.target.value) }))}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-sm"
                    >
                      <option value={1}>Lade 1 — {printerSettings.tray1Name}</option>
                      <option value={2}>Lade 2 — {printerSettings.tray2Name}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-yellow-400 w-32">Productiebladen</span>
                    <select
                      value={printerSettings.productiebladenTray}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, productiebladenTray: Number(e.target.value) }))}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-sm"
                    >
                      <option value={1}>Lade 1 — {printerSettings.tray1Name}</option>
                      <option value={2}>Lade 2 — {printerSettings.tray2Name}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-32">Bijlagen</span>
                    <select
                      value={printerSettings.bijlagenTray}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, bijlagenTray: Number(e.target.value) }))}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 border border-white/10 text-white text-sm"
                    >
                      <option value={1}>Lade 1 — {printerSettings.tray1Name}</option>
                      <option value={2}>Lade 2 — {printerSettings.tray2Name}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Color mode */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Kleurmodus</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      value="color"
                      checked={printerSettings.colorMode === 'color'}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, colorMode: 'color' }))}
                      className="w-4 h-4 text-workx-lime bg-white/10 border-white/20 focus:ring-workx-lime"
                    />
                    <span className="text-sm text-gray-300">Kleur</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="colorMode"
                      value="monochrome"
                      checked={printerSettings.colorMode === 'monochrome'}
                      onChange={(e) => setPrinterSettings(prev => ({ ...prev, colorMode: 'monochrome' }))}
                      className="w-4 h-4 text-workx-lime bg-white/10 border-white/20 focus:ring-workx-lime"
                    />
                    <span className="text-sm text-gray-300">Zwart/wit</span>
                  </label>
                </div>
              </div>

              {/* Duplex */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printerSettings.duplex}
                    onChange={(e) => setPrinterSettings(prev => ({ ...prev, duplex: e.target.checked }))}
                    className="w-4 h-4 rounded text-workx-lime bg-white/10 border-white/20 focus:ring-workx-lime"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Dubbelzijdig printen</span>
                    <p className="text-xs text-gray-500">Print op beide zijden van het papier</p>
                  </div>
                </label>
              </div>

              {/* Info box */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-xs text-blue-300">
                  <strong>Tip:</strong> De lade-namen verschillen per printer. Check de printerinstellingen
                  of print een testpagina om de juiste namen te vinden.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/10">
              <button
                onClick={() => setShowPrinterSettings(false)}
                className="px-4 py-2 rounded-lg bg-white/10 text-gray-300 hover:bg-white/15"
              >
                Annuleren
              </button>
              <button
                onClick={savePrinterSettings}
                className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
