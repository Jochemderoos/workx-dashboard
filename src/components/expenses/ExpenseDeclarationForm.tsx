'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { buildExpensePDF } from '@/lib/expense-pdf'

interface ExpenseItem {
  id?: string
  description: string
  date: string
  amount: number
  attachmentUrl?: string
  attachmentName?: string
  expenseType?: 'reiskosten_auto' | 'overig'
  kilometers?: number
  chargeToClient?: string // Doorbelasten aan zaak/klant
}

interface ExpenseDeclaration {
  id: string
  employeeName: string
  bankAccount: string
  status: string
  totalAmount: number
  note?: string
  invoiceNumber?: string
  items: ExpenseItem[]
  createdAt: string
  holdingName?: string
}

interface ExpenseDeclarationFormProps {
  onClose: () => void
  inline?: boolean
}

export default function ExpenseDeclarationForm({ onClose, inline = false }: ExpenseDeclarationFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Check if user is partner or admin
  const isPartner = session?.user?.role === 'PARTNER'
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEditSettings = isPartner || isAdmin

  // Tab state (medewerker / holding)
  const [activeTab, setActiveTab] = useState<'medewerker' | 'holding'>('medewerker')

  // View state
  const [view, setView] = useState<'form' | 'history'>('history')
  const [savedDeclarations, setSavedDeclarations] = useState<ExpenseDeclaration[]>([])
  const [currentDeclaration, setCurrentDeclaration] = useState<ExpenseDeclaration | null>(null)

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Kilometer rate setting
  const [kilometerRate, setKilometerRate] = useState(0.23)
  const [showRateSettings, setShowRateSettings] = useState(false)
  const [editingRate, setEditingRate] = useState('')

  // Form state
  const [employeeName, setEmployeeName] = useState(session?.user?.name || '')
  const [bankAccount, setBankAccount] = useState('')
  const [savedIban, setSavedIban] = useState('') // IBAN from profile
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [holdingName, setHoldingName] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Load kilometer rate + saved IBAN from profile
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [rateRes, profileRes] = await Promise.all([
          fetch('/api/settings?key=kilometerRate'),
          fetch('/api/user/profile'),
        ])
        if (rateRes.ok) {
          const data = await rateRes.json()
          setKilometerRate(data.value || 0.23)
        }
        if (profileRes.ok) {
          const profile = await profileRes.json()
          if (profile.iban) {
            setSavedIban(profile.iban)
            // Only pre-fill if no bank account entered yet
            setBankAccount(prev => prev || profile.iban)
          }
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      }
    }
    fetchSettings()
  }, [])

  // Load saved declarations (own only)
  useEffect(() => {
    const fetchDeclarations = async () => {
      try {
        const userId = session?.user?.id
        const url = userId ? `/api/expenses?userId=${userId}` : '/api/expenses'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setSavedDeclarations(data)

          // Always start with overview of own declarations
          // If there's a draft, pre-load it so "Doorgaan met concept" works
          const latestDraft = data.find((d: ExpenseDeclaration) => d.status === 'DRAFT')
          if (latestDraft) {
            loadDeclaration(latestDraft)
            // Stay in history view — user can click "Doorgaan" to edit
          }
          setView('history')
        }
      } catch (error) {
        console.error('Error fetching declarations:', error)
      }
    }
    if (session?.user?.id) fetchDeclarations()
  }, [session?.user?.id])

  // Load a declaration into the form
  const loadDeclaration = (declaration: ExpenseDeclaration) => {
    setCurrentDeclaration(declaration)
    setEmployeeName(declaration.employeeName)
    setBankAccount(declaration.bankAccount)
    setNote(declaration.note || '')
    setHoldingName(declaration.holdingName || '')
    setInvoiceNumber(declaration.invoiceNumber || '')
    setItems(
      declaration.items.map(i => ({
        ...i,
        date: i.date ? new Date(i.date).toISOString().split('T')[0] : '',
        expenseType: i.expenseType || 'overig',
        kilometers: i.kilometers || 0
      }))
    )
    // Set tab based on whether it's a holding declaration
    if (declaration.holdingName) {
      setActiveTab('holding')
    }
    setView('form')
  }

  // Start new form
  const startNewForm = () => {
    setCurrentDeclaration(null)
    setEmployeeName(session?.user?.name || '')
    setBankAccount(savedIban || '')
    setNote('')
    setHoldingName('')
    setInvoiceNumber('')
    setItems([])
    setView('form')
  }

  // Add new item
  const addItem = (type: 'reiskosten_auto' | 'overig') => {
    setItems([...items, {
      description: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      expenseType: type,
      kilometers: 0,
      chargeToClient: ''
    }])
  }

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  // Update item
  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // If updating kilometers, recalculate amount
    if (field === 'kilometers' && newItems[index].expenseType === 'reiskosten_auto') {
      const km = typeof value === 'number' ? value : parseFloat(value as string) || 0
      newItems[index].amount = Math.round(km * kilometerRate * 100) / 100
    }

    setItems(newItems)
  }

  // Handle file attachment
  const handleFileAttachment = (index: number, file: File | null) => {
    if (!file) {
      setItems(prev => prev.map((item, i) =>
        i === index ? { ...item, attachmentUrl: '', attachmentName: '' } : item
      ))
      return
    }

    // Check file size (max 4MB to stay within API limits)
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Bestand is te groot (max 4MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      // Use functional update to avoid stale closure
      setItems(prev => prev.map((item, i) =>
        i === index ? { ...item, attachmentUrl: e.target?.result as string, attachmentName: file.name } : item
      ))
    }
    reader.readAsDataURL(file)
  }

  // Save kilometer rate
  const saveKilometerRate = async () => {
    const newRate = parseFloat(editingRate)
    if (isNaN(newRate) || newRate <= 0) {
      toast.error('Voer een geldig tarief in')
      return
    }

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'kilometerRate',
          value: newRate
        })
      })

      if (res.ok) {
        setKilometerRate(newRate)
        setShowRateSettings(false)
        toast.success('Kilometertarief opgeslagen')

        // Recalculate all auto travel items
        const newItems = items.map(item => {
          if (item.expenseType === 'reiskosten_auto' && item.kilometers) {
            return {
              ...item,
              amount: Math.round(item.kilometers * newRate * 100) / 100
            }
          }
          return item
        })
        setItems(newItems)
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      toast.error('Kon tarief niet opslaan')
    }
  }

  // Validate IBAN
  const isValidIBAN = (iban: string) => {
    const cleaned = iban.replace(/\s/g, '').toUpperCase()
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(cleaned)
  }

  // Format IBAN
  const formatIBAN = (iban: string) => {
    const cleaned = iban.replace(/\s/g, '').toUpperCase()
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  // Save declaration
  const saveDeclaration = async () => {
    if (activeTab === 'holding' && !holdingName.trim()) {
      toast.error('Vul de naam van de Holding BV in')
      return false
    }

    if (!employeeName.trim()) {
      toast.error('Vul je naam in')
      return false
    }

    if (!bankAccount.trim() || !isValidIBAN(bankAccount)) {
      toast.error('Vul een geldig IBAN nummer in')
      return false
    }

    const validItems = items.filter(i => i.date && i.amount > 0)
    if (validItems.length === 0) {
      toast.error('Voeg minimaal één kostenpost toe')
      return false
    }

    // Check that all reiskosten_auto items have a description
    const missingDescription = validItems.find(i => i.expenseType === 'reiskosten_auto' && !i.description?.trim())
    if (missingDescription) {
      toast.error('Vul een reis omschrijving in voor alle reiskosten')
      return false
    }

    // Check that all overig items have a description
    const missingOverigDescription = validItems.find(i => i.expenseType === 'overig' && !i.description?.trim())
    if (missingOverigDescription) {
      toast.error('Vul een omschrijving in voor alle kostenposten')
      return false
    }

    setIsLoading(true)
    try {
      const method = currentDeclaration ? 'PUT' : 'POST'
      const url = currentDeclaration
        ? `/api/expenses/${currentDeclaration.id}`
        : '/api/expenses'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: employeeName.trim(),
          bankAccount: bankAccount.replace(/\s/g, '').toUpperCase(),
          items: validItems.map(item => ({
            description: item.description,
            date: item.date,
            amount: item.amount,
            attachmentUrl: item.attachmentUrl,
            attachmentName: item.attachmentName,
            expenseType: item.expenseType,
            kilometers: item.expenseType === 'reiskosten_auto' ? item.kilometers : undefined,
            chargeToClient: activeTab === 'medewerker' ? item.chargeToClient : undefined,
          })),
          note: note.trim(),
          holdingName: activeTab === 'holding' ? holdingName.trim() : null,
          invoiceNumber: invoiceNumber.trim() || null,
          submit: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      const saved = await res.json()
      setCurrentDeclaration(saved)

      // Save IBAN to profile if changed
      const cleanIban = bankAccount.replace(/\s/g, '').toUpperCase()
      if (cleanIban && cleanIban !== savedIban) {
        fetch('/api/user/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iban: cleanIban }),
        }).then(() => setSavedIban(cleanIban)).catch(() => {})
      }

      const listRes = await fetch(`/api/expenses${session?.user?.id ? `?userId=${session.user.id}` : ''}`)
      if (listRes.ok) {
        setSavedDeclarations(await listRes.json())
      }

      toast.success('Declaratie opgeslagen')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kon niet opslaan')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  // Submit declaration (sets status to SUBMITTED)
  const submitDeclaration = async () => {
    if (activeTab === 'holding' && !holdingName.trim()) {
      toast.error('Vul de naam van de Holding BV in')
      return
    }
    if (!employeeName.trim()) {
      toast.error('Vul je naam in')
      return
    }
    if (!bankAccount.trim() || !isValidIBAN(bankAccount)) {
      toast.error('Vul een geldig IBAN nummer in')
      return
    }
    const validItems = items.filter(i => i.date && i.amount > 0)
    if (validItems.length === 0) {
      toast.error('Voeg minimaal één kostenpost toe')
      return
    }
    const missingDescription = validItems.find(i => i.expenseType === 'reiskosten_auto' && !i.description?.trim())
    if (missingDescription) {
      toast.error('Vul een reis omschrijving in voor alle reiskosten')
      return
    }
    const missingOverigDescription = validItems.find(i => i.expenseType === 'overig' && !i.description?.trim())
    if (missingOverigDescription) {
      toast.error('Vul een omschrijving in voor alle kostenposten')
      return
    }

    setIsSubmitting(true)
    try {
      const method = currentDeclaration ? 'PUT' : 'POST'
      const url = currentDeclaration
        ? `/api/expenses/${currentDeclaration.id}`
        : '/api/expenses'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: employeeName.trim(),
          bankAccount: bankAccount.replace(/\s/g, '').toUpperCase(),
          items: validItems.map(item => ({
            description: item.description,
            date: item.date,
            amount: item.amount,
            attachmentUrl: item.attachmentUrl,
            attachmentName: item.attachmentName,
            expenseType: item.expenseType,
            kilometers: item.expenseType === 'reiskosten_auto' ? item.kilometers : undefined,
            chargeToClient: activeTab === 'medewerker' ? item.chargeToClient : undefined,
          })),
          note: note.trim(),
          holdingName: activeTab === 'holding' ? holdingName.trim() : null,
          invoiceNumber: invoiceNumber.trim() || null,
          submit: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Indienen mislukt')
      }

      // Refresh declarations list
      const listRes = await fetch(`/api/expenses${session?.user?.id ? `?userId=${session.user.id}` : ''}`)
      if (listRes.ok) {
        setSavedDeclarations(await listRes.json())
      }

      toast.success('Declaratie ingediend!')
      setShowSubmitConfirm(false)
      startNewForm()
      setView('history')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kon niet indienen')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Generate and download PDF
  const generatePDF = async () => {
    const saved = await saveDeclaration()
    if (!saved) return

    setIsGeneratingPdf(true)

    try {
      const result = await buildExpensePDF({
        employeeName,
        bankAccount,
        holdingName: activeTab === 'holding' ? holdingName : null,
        invoiceNumber,
        note,
        createdAt: currentDeclaration?.createdAt || new Date().toISOString(),
        items: items.filter(i => i.description && i.date && i.amount > 0),
      })
      if (!result) return

      result.doc.save(result.fileName)
      toast.success('PDF gedownload')

      // Show persistent toast for each PDF attachment with a download button
      if (result.pdfAttachments && result.pdfAttachments.length > 0) {
        for (const dl of result.pdfAttachments) {
          const blobUrl = URL.createObjectURL(dl.blob)
          toast(
            (t) => {
              const handleClick = () => {
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = dl.fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(blobUrl)
                toast.dismiss(t.id)
              }
              return (
                <div className="flex items-center gap-3">
                  <span className="text-sm">📎 {dl.fileName}</span>
                  <button
                    onClick={handleClick}
                    className="px-3 py-1 bg-workx-lime text-black text-sm font-medium rounded-lg hover:opacity-90"
                  >
                    Download
                  </button>
                </div>
              )
            },
            { duration: 30000 }
          )
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Kon PDF niet genereren')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Download PDF for a saved declaration (from history)
  const downloadDeclarationPDF = async (decl: ExpenseDeclaration) => {
    try {
      // Fetch full declaration data including attachment URLs (not in list response)
      const fullRes = await fetch(`/api/expenses/${decl.id}`)
      if (!fullRes.ok) throw new Error('Kon declaratie niet ophalen')
      const fullDecl = await fullRes.json()

      const result = await buildExpensePDF({
        employeeName: fullDecl.employeeName,
        bankAccount: fullDecl.bankAccount,
        holdingName: fullDecl.holdingName || null,
        invoiceNumber: fullDecl.invoiceNumber || '',
        note: fullDecl.note || '',
        createdAt: fullDecl.createdAt,
        items: fullDecl.items.map((i: any) => ({
          ...i,
          date: i.date ? new Date(i.date).toISOString().split('T')[0] : '',
          expenseType: i.expenseType || 'overig',
          kilometers: i.kilometers || 0,
        })),
      })
      if (!result) return

      result.doc.save(result.fileName)
      toast.success('PDF gedownload')

      // Show persistent toast for each PDF attachment with a download button
      if (result.pdfAttachments && result.pdfAttachments.length > 0) {
        for (const dl of result.pdfAttachments) {
          const blobUrl = URL.createObjectURL(dl.blob)
          toast(
            (t) => {
              const handleClick = () => {
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = dl.fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(blobUrl)
                toast.dismiss(t.id)
              }
              return (
                <div className="flex items-center gap-3">
                  <span className="text-sm">📎 {dl.fileName}</span>
                  <button
                    onClick={handleClick}
                    className="px-3 py-1 bg-workx-lime text-black text-sm font-medium rounded-lg hover:opacity-90"
                  >
                    Download
                  </button>
                </div>
              )
            },
            { duration: 30000 }
          )
        }
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Kon PDF niet genereren')
    }
  }

  // Download attachment for a saved declaration
  const downloadAttachment = async (decl: ExpenseDeclaration) => {
    try {
      const fullRes = await fetch(`/api/expenses/${decl.id}`)
      if (!fullRes.ok) throw new Error('Kon declaratie niet ophalen')
      const fullDecl = await fullRes.json()

      for (const item of fullDecl.items) {
        if (!item.attachmentUrl || !item.attachmentName) continue
        const base64 = item.attachmentUrl.split(',')[1]
        if (!base64) continue
        const mimeMatch = item.attachmentUrl.match(/^data:([^;]+)/)
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
        const binaryStr = atob(base64)
        const bytes = new Uint8Array(binaryStr.length)
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j)
        }
        const blob = new Blob([bytes], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = item.attachmentName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success(`Bijlage "${item.attachmentName}" gedownload`)
        return // Download first attachment found
      }
      toast.error('Geen bijlage gevonden')
    } catch {
      toast.error('Kon bijlage niet downloaden')
    }
  }

  // Delete declaration
  const deleteDeclaration = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze declaratie wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedDeclarations(prev => prev.filter(d => d.id !== id))
        toast.success('Declaratie verwijderd')
      } else {
        toast.error('Kon declaratie niet verwijderen')
      }
    } catch {
      toast.error('Kon declaratie niet verwijderen')
    }
  }


  const content = (
    <div ref={modalRef} className={`w-full flex flex-col ${!inline ? 'max-w-4xl' : ''}`}>
        <div className="w-full flex flex-col">
          {/* Header - always visible, never scrolled */}
          <div className="flex-shrink-0 p-4 sm:p-6 border-b border-white/10 bg-workx-dark rounded-t-2xl relative z-10">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center shrink-0">
                  <Icons.euro className="text-workx-lime" size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
                    {view === 'history' ? 'Mijn declaraties' : 'Declaratieformulier'}
                  </h2>
                  <p className="text-sm text-gray-400 truncate">
                    {view === 'history' ? `${savedDeclarations.length} declaratie${savedDeclarations.length !== 1 ? 's' : ''}` : items.length > 0 ? `${items.length} kostenpost${items.length !== 1 ? 'en' : ''}` : 'Voeg je kosten toe'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {canEditSettings && (
                  <button
                    onClick={() => {
                      setEditingRate(kilometerRate.toString())
                      setShowRateSettings(true)
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                    title="Kilometertarief instellen"
                  >
                    <Icons.settings size={18} />
                  </button>
                )}
                {view === 'form' ? (
                  <button
                    onClick={() => setView('history')}
                    className="btn-secondary flex items-center gap-1 sm:gap-2 text-sm px-2 sm:px-4 py-2"
                  >
                    <Icons.chevronLeft size={16} />
                    <span className="hidden sm:inline">Terug</span>
                  </button>
                ) : (
                  <button
                    onClick={startNewForm}
                    className="flex items-center gap-1 sm:gap-2 text-sm px-3 sm:px-4 py-2 rounded-lg bg-workx-lime text-black font-medium hover:opacity-90 transition-colors"
                  >
                    <Icons.plus size={16} />
                    <span className="hidden sm:inline">Nieuwe declaratie</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Kilometer Rate Settings Modal */}
          {showRateSettings && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowRateSettings(false)}>
              <div className="bg-workx-dark border border-white/10 rounded-2xl p-4 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Icons.car size={20} className="text-workx-lime" />
                  Kilometertarief instellen
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                  Dit tarief wordt gebruikt om reiskosten automatisch te berekenen op basis van het aantal kilometers.
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-gray-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingRate}
                    onChange={(e) => setEditingRate(e.target.value)}
                    className="input-field flex-1"
                    placeholder="0.23"
                  />
                  <span className="text-gray-400">per km</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowRateSettings(false)} className="btn-secondary">
                    Annuleren
                  </button>
                  <button onClick={saveKilometerRate} className="btn-primary">
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Submit Confirmation Dialog */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowSubmitConfirm(false)}>
              <div className="bg-workx-dark border border-white/10 rounded-2xl p-4 sm:p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Icons.alertTriangle size={20} className="text-orange-400" />
                  Declaratie indienen
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Weet je zeker dat je wilt indienen? Na indienen kun je niet meer bewerken.
                </p>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowSubmitConfirm(false)} className="btn-secondary">
                    Annuleren
                  </button>
                  <button
                    onClick={submitDeclaration}
                    disabled={isSubmitting}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                    ) : (
                      <Icons.send size={16} />
                    )}
                    Indienen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs for Partners */}
          {isPartner && view === 'form' && (
            <div className="px-4 sm:px-6 pt-4">
              <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                <button
                  onClick={() => setActiveTab('medewerker')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'medewerker'
                      ? 'bg-workx-lime text-workx-dark'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Icons.user size={16} className="shrink-0" />
                    <span className="truncate">Persoonlijk</span>
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('holding')}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'holding'
                      ? 'bg-workx-lime text-workx-dark'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Icons.briefcase size={16} className="shrink-0" />
                    <span className="truncate">Holding</span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {view === 'history' ? (
            /* History View */
            <div className="p-4 sm:p-6">
              {/* Draft banner */}
              {savedDeclarations.some(d => d.status === 'DRAFT') && (
                <button
                  onClick={() => {
                    const draft = savedDeclarations.find(d => d.status === 'DRAFT')
                    if (draft) { loadDeclaration(draft); setView('form') }
                  }}
                  className="w-full mb-4 p-3 rounded-xl bg-workx-lime/10 border border-workx-lime/20 flex items-center gap-3 hover:bg-workx-lime/15 transition-colors"
                >
                  <Icons.edit size={18} className="text-workx-lime shrink-0" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-white">Concept declaratie</p>
                    <p className="text-xs text-gray-400">Klik om verder te gaan met je concept</p>
                  </div>
                  <Icons.arrowRight size={16} className="text-workx-lime ml-auto shrink-0" />
                </button>
              )}

              {/* Search */}
              {savedDeclarations.length > 0 && (
                <div className="relative mb-4">
                  <Icons.search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Zoek op naam, factuurnummer..."
                    className="input-field w-full pl-10 !rounded-xl"
                  />
                </div>
              )}

              {savedDeclarations.filter(d => d.status !== 'DRAFT').length === 0 && !savedDeclarations.some(d => d.status === 'DRAFT') ? (
                <div className="text-center py-12 text-gray-400">
                  <Icons.fileText size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="mb-4">Nog geen declaraties</p>
                  <button onClick={startNewForm} className="px-4 py-2 rounded-lg bg-workx-lime text-black font-medium hover:opacity-90 transition-colors">
                    Eerste declaratie aanmaken
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedDeclarations
                    .filter(decl => decl.status !== 'DRAFT')
                    .filter(decl => {
                      if (!searchQuery.trim()) return true
                      const q = searchQuery.toLowerCase()
                      return (
                        decl.employeeName.toLowerCase().includes(q) ||
                        (decl.invoiceNumber || '').toLowerCase().includes(q) ||
                        (decl.holdingName || '').toLowerCase().includes(q) ||
                        decl.status.toLowerCase().includes(q)
                      )
                    })
                    .map((decl) => (
                    <div
                      key={decl.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl transition-colors gap-2 cursor-pointer ${
                        decl.status === 'PAID'
                          ? 'bg-white/[0.02] opacity-50 hover:opacity-80'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => loadDeclaration(decl)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-medium truncate ${decl.status === 'PAID' ? 'text-gray-400' : 'text-white'}`}>{decl.employeeName}</p>
                          {decl.status === 'DRAFT' && (
                            <span className="px-2 py-0.5 text-xs bg-gray-500/20 rounded-full text-gray-400 font-medium">
                              Concept
                            </span>
                          )}
                          {decl.status === 'SUBMITTED' && (
                            <span className="px-2 py-0.5 text-xs bg-orange-500/20 rounded-full text-orange-400 font-medium">
                              Onbetaald
                            </span>
                          )}
                          {decl.status === 'PAID' && (
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 rounded-full text-green-400 font-medium">
                              Betaald
                            </span>
                          )}
                          {decl.holdingName && (
                            <span className="px-2 py-0.5 text-xs bg-white/10 rounded-full text-gray-400 truncate max-w-[150px]">
                              {decl.holdingName}
                            </span>
                          )}
                          {decl.invoiceNumber && (
                            <span className="px-2 py-0.5 text-xs bg-workx-lime/10 rounded-full text-workx-lime">
                              #{decl.invoiceNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(decl.createdAt).toLocaleDateString('nl-NL')} • {decl.items.length} post{decl.items.length !== 1 ? 'en' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {decl.status !== 'DRAFT' && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadDeclarationPDF(decl)
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium hover:bg-workx-lime/20 transition-colors"
                            >
                              <Icons.download size={14} />
                              PDF
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadAttachment(decl)
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
                            >
                              <Icons.paperclip size={14} />
                              Bijlage
                            </button>
                          </>
                        )}
                        {decl.status !== 'PAID' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteDeclaration(decl.id)
                            }}
                            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Verwijderen"
                          >
                            <Icons.trash size={14} />
                          </button>
                        )}
                        <div className="text-left sm:text-right shrink-0 ml-1">
                          <p className={`font-bold text-lg ${decl.status === 'PAID' ? 'text-gray-500' : 'text-workx-lime'}`}>
                            {formatCurrency(decl.totalAmount)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Form View */
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-x-hidden">
              {/* Holding Name (for partners on holding tab) */}
              {activeTab === 'holding' && (
                <div className="p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl">
                  <label className="block text-sm text-orange-400 mb-2 font-medium">
                    Naam Holding BV
                  </label>
                  <input
                    type="text"
                    value={holdingName}
                    onChange={(e) => setHoldingName(e.target.value)}
                    className="input-field text-lg"
                    placeholder="Bijv. Jansen Holding B.V."
                  />
                  <p className="text-xs text-orange-400/60 mt-2">
                    Dit formulier is voor declaraties via je Holding. De PDF wordt zonder Workx logo gegenereerd.
                  </p>
                </div>
              )}

              {/* Personal Info */}
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Naam medewerker</label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-field w-full"
                    placeholder="Je volledige naam"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">IBAN Rekeningnummer</label>
                  <input
                    type="text"
                    value={formatIBAN(bankAccount)}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="input-field w-full font-mono text-sm"
                    placeholder="NL00 BANK 0000 0000 00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Factuurnummer (optioneel)</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="input-field w-full"
                    placeholder="Bijv. 512"
                  />
                </div>
              </div>

              {/* Expense Table */}
              <div className="card p-0 overflow-hidden max-w-full">
                <div className="bg-white/5 px-3 sm:px-4 py-3 border-b border-white/10">
                  <div className="flex flex-col gap-3">
                    <h3 className="font-medium text-white flex items-center gap-2">
                      <Icons.fileText size={18} className="text-workx-lime shrink-0" />
                      <span>Kostenposten</span>
                      <span className="text-xs text-gray-500 font-normal">
                        (€{kilometerRate.toFixed(2)}/km)
                      </span>
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => addItem('reiskosten_auto')}
                        className="btn-secondary text-sm py-1.5 px-3 flex items-center gap-1.5 flex-1 justify-center"
                      >
                        <Icons.car size={16} className="shrink-0" />
                        <span>Auto</span>
                      </button>
                      <button
                        onClick={() => addItem('overig')}
                        className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5 flex-1 justify-center"
                      >
                        <Icons.plus size={16} className="shrink-0" />
                        <span>Nieuw</span>
                      </button>
                    </div>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                      <Icons.plus size={32} className="text-gray-500" />
                    </div>
                    <p className="text-gray-400 mb-4">Nog geen kostenposten toegevoegd</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        onClick={() => addItem('reiskosten_auto')}
                        className="btn-secondary flex items-center justify-center gap-2"
                      >
                        <Icons.car size={16} />
                        Reiskosten auto
                      </button>
                      <button
                        onClick={() => addItem('overig')}
                        className="btn-primary flex items-center justify-center gap-2"
                      >
                        <Icons.plus size={16} />
                        Andere kosten
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile view: Cards */}
                    <div className="sm:hidden divide-y divide-white/5">
                      {items.map((item, index) => (
                        <div key={index} className="p-4 space-y-3">
                          {/* Header with type badge and delete */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              item.expenseType === 'reiskosten_auto'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {item.expenseType === 'reiskosten_auto' ? 'Reiskosten auto' : 'Overige kosten'}
                            </span>
                            <button
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                            >
                              <Icons.trash size={16} />
                            </button>
                          </div>

                          {/* Description field - always shown, required for reiskosten */}
                          <textarea
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="input-field text-sm py-1.5 w-full resize-none"
                            rows={2}
                            placeholder={item.expenseType === 'reiskosten_auto' ? 'Reis omschrijving (bijv. Amsterdam - Rotterdam)...' : 'Omschrijving...'}
                          />

                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 mb-1 block">Datum</label>
                              <DatePicker
                                selected={item.date ? new Date(item.date + 'T12:00:00') : null}
                                onChange={(date) => updateItem(index, 'date', date ? date.toISOString().split('T')[0] : '')}
                                placeholder="Datum..."
                                dateFormat="d MMM yyyy"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-xs text-gray-500 mb-1 block">
                                {item.expenseType === 'reiskosten_auto' ? 'Kilometers' : 'Bedrag'}
                              </label>
                              {item.expenseType === 'reiskosten_auto' ? (
                                <div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="1"
                                      min="0"
                                      value={item.kilometers || ''}
                                      onChange={(e) => updateItem(index, 'kilometers', parseFloat(e.target.value) || 0)}
                                      className="input-field text-sm py-1.5 w-full text-right"
                                      placeholder="0"
                                    />
                                    <span className="text-gray-400 text-sm shrink-0">km</span>
                                  </div>
                                  <div className="text-xs text-gray-500 text-right mt-1">
                                    = {formatCurrency(item.amount || 0)}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400">€</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.amount || ''}
                                    onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                    className="input-field text-sm py-1.5 w-full text-right"
                                    placeholder="0,00"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Charge to client field - only for Workx (not holding) */}
                          {activeTab === 'medewerker' && (
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Doorbelasten aan zaak/klant (optioneel)</label>
                              <input
                                type="text"
                                value={item.chargeToClient || ''}
                                onChange={(e) => updateItem(index, 'chargeToClient', e.target.value)}
                                className="input-field text-sm py-1.5 w-full"
                                placeholder="Naam zaak of klant..."
                              />
                            </div>
                          )}

                          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white p-2 bg-white/5 rounded-lg">
                            {item.attachmentUrl ? (
                              <Icons.check size={14} className="text-green-400 shrink-0" />
                            ) : (
                              <Icons.paperclip size={14} className="shrink-0" />
                            )}
                            <span className="truncate">
                              {item.attachmentName || 'Bijlage toevoegen...'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => handleFileAttachment(index, e.target.files?.[0] || null)}
                            />
                          </label>
                        </div>
                      ))}

                      {/* Mobile total */}
                      <div className="p-4 bg-workx-lime/10">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 font-medium">Totaal:</span>
                          <span className="text-2xl font-bold text-workx-lime">
                            {formatCurrency(totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Desktop view: Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                            <th className="px-4 py-3 font-medium w-[100px]">Type</th>
                            <th className="px-4 py-3 font-medium">Omschrijving</th>
                            <th className="px-4 py-3 font-medium w-[140px]">Datum</th>
                            <th className="px-4 py-3 font-medium text-right w-[120px]">Km / Bedrag</th>
                            {activeTab === 'medewerker' && (
                              <th className="px-4 py-3 font-medium w-[150px]">Doorbelasten</th>
                            )}
                            <th className="px-4 py-3 font-medium w-[100px]">Bijlage</th>
                            <th className="px-4 py-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                                  item.expenseType === 'reiskosten_auto'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {item.expenseType === 'reiskosten_auto' ? 'Auto' : 'Overig'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <textarea
                                  value={item.description}
                                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                                  className="input-field text-sm py-1.5 w-full resize-none"
                                  rows={2}
                                  placeholder={item.expenseType === 'reiskosten_auto' ? 'Reis omschrijving (bijv. Amsterdam - Rotterdam)...' : 'Omschrijving...'}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <DatePicker
                                  selected={item.date ? new Date(item.date + 'T12:00:00') : null}
                                  onChange={(date) => updateItem(index, 'date', date ? date.toISOString().split('T')[0] : '')}
                                  placeholder="Datum..."
                                  dateFormat="d MMM yyyy"
                                />
                              </td>
                              <td className="px-4 py-3">
                                {item.expenseType === 'reiskosten_auto' ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        value={item.kilometers || ''}
                                        onChange={(e) => updateItem(index, 'kilometers', parseFloat(e.target.value) || 0)}
                                        className="input-field text-sm py-1.5 w-16 text-right"
                                        placeholder="0"
                                      />
                                      <span className="text-gray-400 text-sm">km</span>
                                    </div>
                                    <div className="text-xs text-gray-500 text-right">
                                      = {formatCurrency(item.amount || 0)}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-gray-400">€</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.amount || ''}
                                      onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                      className="input-field text-sm py-1.5 w-20 text-right"
                                      placeholder="0,00"
                                    />
                                  </div>
                                )}
                              </td>
                              {activeTab === 'medewerker' && (
                                <td className="px-4 py-3">
                                  <input
                                    type="text"
                                    value={item.chargeToClient || ''}
                                    onChange={(e) => updateItem(index, 'chargeToClient', e.target.value)}
                                    className="input-field text-sm py-1.5 w-full"
                                    placeholder="Zaak/klant..."
                                  />
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white">
                                  {item.attachmentUrl ? (
                                    <Icons.check size={14} className="text-green-400" />
                                  ) : (
                                    <Icons.paperclip size={14} />
                                  )}
                                  <span className="truncate max-w-[80px]">
                                    {item.attachmentName || 'Bijlage...'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    className="hidden"
                                    onChange={(e) => handleFileAttachment(index, e.target.files?.[0] || null)}
                                  />
                                </label>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => removeItem(index)}
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Icons.trash size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-workx-lime/10">
                            <td colSpan={activeTab === 'medewerker' ? 3 : 2} className="px-4 py-4 text-right font-medium text-gray-400">
                              Totaal te declareren:
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-2xl font-bold text-workx-lime">
                                {formatCurrency(totalAmount)}
                              </span>
                            </td>
                            <td colSpan={activeTab === 'medewerker' ? 3 : 2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Opmerkingen (optioneel)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field min-h-[60px]"
                  placeholder="Extra toelichting..."
                />
              </div>
            </div>
          )}

          </div>{/* End scrollable content area */}

          {/* Footer Actions */}
          {view === 'form' && (
            <div className="flex-shrink-0 p-4 sm:p-6 border-t border-white/10 bg-workx-dark rounded-b-2xl">
              {/* Mobile: stacked buttons */}
              <div className="flex flex-col gap-3 sm:hidden">
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={isLoading || isSubmitting || items.length === 0}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 w-full font-semibold"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                  ) : (
                    <Icons.send size={16} />
                  )}
                  Indienen
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={saveDeclaration}
                    disabled={isLoading || items.length === 0}
                    className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 flex-1"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                    ) : (
                      <Icons.save size={16} />
                    )}
                    Opslaan
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isLoading || isGeneratingPdf || items.length === 0}
                    className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 flex-1"
                  >
                    {isGeneratingPdf ? (
                      <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                    ) : (
                      <Icons.fileText size={16} />
                    )}
                    PDF
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={startNewForm}
                    className="btn-secondary flex items-center justify-center gap-2 flex-1"
                  >
                    <Icons.plus size={16} />
                    Nieuw
                  </button>
                  <button onClick={onClose} className="btn-secondary flex-1">
                    Sluiten
                  </button>
                </div>
              </div>

              {/* Desktop: horizontal layout */}
              <div className="hidden sm:flex items-center justify-between">
                <button
                  onClick={startNewForm}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Icons.plus size={16} />
                  Nieuw formulier
                </button>

                <div className="flex gap-2">
                  <button onClick={onClose} className="btn-secondary">
                    Sluiten
                  </button>
                  <button
                    onClick={saveDeclaration}
                    disabled={isLoading || items.length === 0}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                    ) : (
                      <Icons.save size={16} />
                    )}
                    Opslaan
                  </button>
                  <button
                    onClick={generatePDF}
                    disabled={isLoading || isGeneratingPdf || items.length === 0}
                    className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                    ) : (
                      <Icons.fileText size={16} />
                    )}
                    Download PDF
                  </button>
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    disabled={isLoading || isSubmitting || items.length === 0}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50 font-semibold"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                    ) : (
                      <Icons.send size={16} />
                    )}
                    Indienen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
  )

  if (inline) return content

  // Modal wrapper for non-inline usage (e.g. hr-docs)
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4"
      style={{ paddingTop: '2vh' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-workx-dark border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl animate-modal-in flex flex-col"
        style={{ maxHeight: 'calc(100dvh - 4vh - 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </div>
    </div>
  )
}
