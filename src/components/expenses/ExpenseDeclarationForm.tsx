'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { jsPDF } from 'jspdf'
import { drawWorkxLogo, loadWorkxLogo } from '@/lib/pdf'

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
  items: ExpenseItem[]
  createdAt: string
  holdingName?: string
}

interface ExpenseDeclarationFormProps {
  onClose: () => void
}

export default function ExpenseDeclarationForm({ onClose }: ExpenseDeclarationFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Check if user is partner or admin
  const isPartner = session?.user?.role === 'PARTNER'
  const isAdmin = session?.user?.role === 'ADMIN'
  const canEditSettings = isPartner || isAdmin

  // Tab state (medewerker / holding)
  const [activeTab, setActiveTab] = useState<'medewerker' | 'holding'>('medewerker')

  // View state
  const [view, setView] = useState<'form' | 'history'>('form')
  const [savedDeclarations, setSavedDeclarations] = useState<ExpenseDeclaration[]>([])
  const [currentDeclaration, setCurrentDeclaration] = useState<ExpenseDeclaration | null>(null)

  // Kilometer rate setting
  const [kilometerRate, setKilometerRate] = useState(0.23)
  const [showRateSettings, setShowRateSettings] = useState(false)
  const [editingRate, setEditingRate] = useState('')

  // Form state
  const [employeeName, setEmployeeName] = useState(session?.user?.name || '')
  const [bankAccount, setBankAccount] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [holdingName, setHoldingName] = useState('')

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

  // Load kilometer rate setting
  useEffect(() => {
    const fetchKilometerRate = async () => {
      try {
        const res = await fetch('/api/settings?key=kilometerRate')
        if (res.ok) {
          const data = await res.json()
          setKilometerRate(data.value || 0.23)
        }
      } catch (error) {
        console.error('Error fetching kilometer rate:', error)
      }
    }
    fetchKilometerRate()
  }, [])

  // Load saved declarations
  useEffect(() => {
    const fetchDeclarations = async () => {
      try {
        const res = await fetch('/api/expenses')
        if (res.ok) {
          const data = await res.json()
          setSavedDeclarations(data)

          // Load the latest DRAFT declaration if exists
          const latestDraft = data.find((d: ExpenseDeclaration) => d.status === 'DRAFT')
          if (latestDraft) {
            loadDeclaration(latestDraft)
          }
        }
      } catch (error) {
        console.error('Error fetching declarations:', error)
      }
    }
    fetchDeclarations()
  }, [])

  // Load a declaration into the form
  const loadDeclaration = (declaration: ExpenseDeclaration) => {
    setCurrentDeclaration(declaration)
    setEmployeeName(declaration.employeeName)
    setBankAccount(declaration.bankAccount)
    setNote(declaration.note || '')
    setHoldingName(declaration.holdingName || '')
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
    setBankAccount('')
    setNote('')
    setHoldingName('')
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
      const newItems = [...items]
      newItems[index] = { ...newItems[index], attachmentUrl: '', attachmentName: '' }
      setItems(newItems)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const newItems = [...items]
      newItems[index] = {
        ...newItems[index],
        attachmentUrl: e.target?.result as string,
        attachmentName: file.name
      }
      setItems(newItems)
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
            ...item,
            // Include expense type and kilometers in description for storage
            description: item.expenseType === 'reiskosten_auto' && item.kilometers
              ? `Reiskosten: ${item.description} (${item.kilometers} km × €${kilometerRate.toFixed(2)})`
              : item.description,
            // Include charge to client info if provided
            chargeToClient: activeTab === 'medewerker' ? item.chargeToClient : undefined
          })),
          note: note.trim(),
          holdingName: activeTab === 'holding' ? holdingName.trim() : null,
          submit: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      const saved = await res.json()
      setCurrentDeclaration(saved)

      const listRes = await fetch('/api/expenses')
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

  // Generate professional PDF
  const generatePDF = async () => {
    const saved = await saveDeclaration()
    if (!saved) return

    setIsGeneratingPdf(true)

    try {
      // Pre-load the logo image
      const logoDataUrl = await loadWorkxLogo()

      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const isHolding = activeTab === 'holding'

      let y = 20

      // === HEADER ===
      if (!isHolding) {
        // Workx logo for employee declarations (flush top-left)
        drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)
        y = 30
      } else {
        // Holding header (no Workx logo)
        doc.setFontSize(22)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text(holdingName, 15, y + 5)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text('Declaratieformulier', 15, y + 14)
        y = 45
      }

      // Date on the right
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Datum: ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`, pageWidth - 15, 25, { align: 'right' })

      // === TITLE ===
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.3)
      doc.line(15, y, pageWidth - 15, y)
      y += 15

      if (!isHolding) {
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text('DECLARATIEFORMULIER', 15, y)
        y += 15
      }

      // === PERSONAL INFO BOX ===
      doc.setFillColor(248, 249, 250)
      doc.roundedRect(15, y, pageWidth - 30, 28, 3, 3, 'F')

      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('Naam medewerker:', 20, y + 10)
      doc.text('IBAN:', 20, y + 20)

      doc.setFontSize(10)
      doc.setTextColor(30, 30, 30)
      doc.setFont('helvetica', 'bold')
      doc.text(employeeName, 60, y + 10)
      doc.setFont('helvetica', 'normal')
      doc.text(formatIBAN(bankAccount), 60, y + 20)

      y += 40

      // === EXPENSE TABLE ===
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text('Kostenposten', 15, y)
      y += 8

      // Table header - different columns for Workx vs Holding
      const hasChargeColumn = !isHolding
      const colX = hasChargeColumn
        ? [15, 40, 105, 140, 175] // With charge column
        : [15, 43, 128, 163]      // Without charge column

      doc.setFillColor(249, 255, 133)
      doc.rect(15, y, pageWidth - 30, 8, 'F')

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text('Datum', colX[0] + 2, y + 5.5)
      doc.text('Omschrijving', colX[1] + 2, y + 5.5)
      if (hasChargeColumn) {
        doc.text('Doorbelasten', colX[2] + 2, y + 5.5)
        doc.text('Bedrag', colX[3] + 2, y + 5.5)
      } else {
        doc.text('Bedrag', colX[2] + 2, y + 5.5)
        doc.text('Bijlage', colX[3] + 2, y + 5.5)
      }

      y += 8

      // Table rows
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)

      const validItems = items.filter(i => i.description && i.date && i.amount > 0)
      validItems.forEach((item, index) => {
        const rowY = y + (index * 10)

        // Alternating row background
        if (index % 2 === 1) {
          doc.setFillColor(250, 250, 250)
          doc.rect(15, rowY, pageWidth - 30, 10, 'F')
        }

        // Row border
        doc.setDrawColor(230, 230, 230)
        doc.line(15, rowY + 10, pageWidth - 15, rowY + 10)

        doc.setTextColor(50, 50, 50)
        doc.text(formatDate(item.date), colX[0] + 2, rowY + 6.5)

        // Description with km info if applicable
        let desc = item.description
        if (item.expenseType === 'reiskosten_auto' && item.kilometers) {
          desc = `${item.description} (${item.kilometers} km)`
        }
        const maxDescLen = hasChargeColumn ? 35 : 45
        desc = desc.length > maxDescLen ? desc.substring(0, maxDescLen) + '...' : desc
        doc.text(desc, colX[1] + 2, rowY + 6.5)

        if (hasChargeColumn) {
          // Charge to client column
          if (item.chargeToClient) {
            const chargeText = item.chargeToClient.length > 18
              ? item.chargeToClient.substring(0, 15) + '...'
              : item.chargeToClient
            doc.text(chargeText, colX[2] + 2, rowY + 6.5)
          }
          doc.text(formatCurrency(item.amount), colX[3] + 2, rowY + 6.5)
        } else {
          doc.text(formatCurrency(item.amount), colX[2] + 2, rowY + 6.5)
          if (item.attachmentName) {
            doc.setTextColor(100, 100, 100)
            const attachName = item.attachmentName.length > 15
              ? item.attachmentName.substring(0, 12) + '...'
              : item.attachmentName
            doc.text(attachName, colX[3] + 2, rowY + 6.5)
          }
        }
      })

      y += validItems.length * 10 + 5

      // Total row
      doc.setFillColor(249, 255, 133)
      doc.rect(15, y, pageWidth - 30, 12, 'F')

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text('TOTAAL TE DECLAREREN:', 20, y + 8)
      doc.setFontSize(14)
      doc.text(formatCurrency(totalAmount), pageWidth - 20, y + 8, { align: 'right' })

      y += 20

      // === NOTES ===
      if (note.trim()) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text('Opmerkingen:', 15, y)
        y += 6

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(80, 80, 80)
        const noteLines = doc.splitTextToSize(note, pageWidth - 30)
        doc.text(noteLines, 15, y)
        y += noteLines.length * 4 + 10
      }

      // === SIGNATURE AREA ===
      y = Math.max(y, pageHeight - 70)

      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.3)
      doc.line(15, y, pageWidth - 15, y)
      y += 15

      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text('Handtekening:', 15, y)
      doc.text('Datum:', pageWidth / 2 + 10, y)

      y += 20
      doc.setDrawColor(150, 150, 150)
      doc.line(15, y, pageWidth / 2 - 10, y)
      doc.line(pageWidth / 2 + 10, y, pageWidth - 15, y)

      // === FOOTER ===
      if (!isHolding) {
        // Footer bar only for Workx declarations
        doc.setFillColor(80, 80, 80)
        doc.rect(0, pageHeight - 12, pageWidth, 12, 'F')

        doc.setTextColor(255, 255, 255)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(
          'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        )
      }

      // === ADD ATTACHMENTS AS SEPARATE PAGES ===
      const attachmentsWithData = validItems.filter(item => item.attachmentUrl && item.attachmentUrl.startsWith('data:'))

      for (const item of attachmentsWithData) {
        if (!item.attachmentUrl) continue

        doc.addPage()
        let attachY = 20

        // Attachment header
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        doc.text('BIJLAGE', 15, attachY)

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80, 80, 80)
        doc.text(`${item.description} - ${formatDate(item.date)} - ${formatCurrency(item.amount)}`, 15, attachY + 8)

        doc.setDrawColor(220, 220, 220)
        doc.line(15, attachY + 12, pageWidth - 15, attachY + 12)
        attachY += 25

        // Check if it's an image
        if (item.attachmentUrl.startsWith('data:image/')) {
          try {
            // Calculate image dimensions to fit page
            const maxWidth = pageWidth - 30
            const maxHeight = pageHeight - attachY - 20

            doc.addImage(
              item.attachmentUrl,
              item.attachmentUrl.includes('png') ? 'PNG' : 'JPEG',
              15,
              attachY,
              maxWidth,
              maxHeight,
              undefined,
              'MEDIUM'
            )
          } catch (e) {
            doc.setFontSize(10)
            doc.setTextColor(150, 50, 50)
            doc.text(`Kon bijlage niet laden: ${item.attachmentName}`, 15, attachY)
          }
        } else if (item.attachmentUrl.startsWith('data:application/pdf')) {
          // For PDFs, show a reference
          doc.setFillColor(248, 249, 250)
          doc.roundedRect(15, attachY, pageWidth - 30, 30, 3, 3, 'F')

          doc.setFontSize(10)
          doc.setTextColor(80, 80, 80)
          doc.text(`PDF Bijlage: ${item.attachmentName}`, 20, attachY + 12)
          doc.setFontSize(8)
          doc.text('(PDF bijlages kunnen niet direct in dit document worden weergegeven)', 20, attachY + 22)
        }
      }

      // Download the PDF
      const fileName = isHolding
        ? `Declaratie_${holdingName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        : `Declaratie_${employeeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

      doc.save(fileName)
      toast.success('PDF gedownload')

    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Kon PDF niet genereren')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto overflow-x-hidden"
      onClick={onClose}
    >
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4" style={{ paddingTop: '2vh' }}>
        {/* Modal */}
        <div
          ref={modalRef}
          className="w-full max-w-4xl bg-workx-dark border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl animate-modal-in overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 p-4 sm:p-6 border-b border-white/10 bg-workx-dark rounded-t-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center shrink-0">
                  <Icons.euro className="text-workx-lime" size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-white truncate">Declaratieformulier</h2>
                  <p className="text-sm text-gray-400 truncate">
                    {view === 'history' ? 'Eerdere declaraties' : items.length > 0 ? `${items.length} kostenpost${items.length !== 1 ? 'en' : ''}` : 'Voeg je kosten toe'}
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
                <button
                  onClick={() => setView(view === 'form' ? 'history' : 'form')}
                  className="btn-secondary flex items-center gap-1 sm:gap-2 text-sm px-2 sm:px-4 py-2"
                >
                  <Icons.clock size={16} />
                  <span className="hidden sm:inline">{view === 'form' ? 'Geschiedenis' : 'Terug'}</span>
                </button>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Icons.x size={20} className="text-gray-400" />
                </button>
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

          {view === 'history' ? (
            /* History View */
            <div className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-medium text-white">Opgeslagen declaraties</h3>
                <button onClick={startNewForm} className="btn-primary flex items-center justify-center gap-2 text-sm w-full sm:w-auto">
                  <Icons.plus size={16} />
                  Nieuw formulier
                </button>
              </div>

              {savedDeclarations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Icons.fileText size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Nog geen opgeslagen declaraties</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedDeclarations.map((decl) => (
                    <div
                      key={decl.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer gap-2"
                      onClick={() => loadDeclaration(decl)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-medium truncate">{decl.employeeName}</p>
                          {decl.holdingName && (
                            <span className="px-2 py-0.5 text-xs bg-white/10 rounded-full text-gray-400 truncate max-w-[150px]">
                              {decl.holdingName}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">
                          {new Date(decl.createdAt).toLocaleDateString('nl-NL')} • {decl.items.length} post{decl.items.length !== 1 ? 'en' : ''}
                        </p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-workx-lime font-bold text-lg">
                          {formatCurrency(decl.totalAmount)}
                        </p>
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
              <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4">
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
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="input-field text-sm py-1.5 w-full"
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
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                                  className="input-field text-sm py-1.5 w-full"
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

          {/* Footer Actions */}
          {view === 'form' && (
            <div className="sticky bottom-0 p-4 sm:p-6 border-t border-white/10 bg-workx-dark rounded-b-2xl">
              {/* Mobile: stacked buttons */}
              <div className="flex flex-col gap-3 sm:hidden">
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
                    className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 flex-1"
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
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                    ) : (
                      <Icons.fileText size={16} />
                    )}
                    Download PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
