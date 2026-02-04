'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

interface ExpenseItem {
  id?: string
  description: string
  date: string
  amount: number
  attachmentUrl?: string
  attachmentName?: string
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
}

interface ExpenseDeclarationFormProps {
  onClose: () => void
  clickY?: number
}

export default function ExpenseDeclarationForm({ onClose, clickY }: ExpenseDeclarationFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // View state
  const [view, setView] = useState<'form' | 'history'>('form')
  const [savedDeclarations, setSavedDeclarations] = useState<ExpenseDeclaration[]>([])
  const [currentDeclaration, setCurrentDeclaration] = useState<ExpenseDeclaration | null>(null)

  // Form state
  const [employeeName, setEmployeeName] = useState(session?.user?.name || '')
  const [bankAccount, setBankAccount] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([{ description: '', date: '', amount: 0 }])

  // Calculate total
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

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
    setItems(
      declaration.items.map(i => ({
        ...i,
        date: i.date ? new Date(i.date).toISOString().split('T')[0] : ''
      }))
    )
    setView('form')
  }

  // Start new form
  const startNewForm = () => {
    setCurrentDeclaration(null)
    setEmployeeName(session?.user?.name || '')
    setBankAccount('')
    setNote('')
    setItems([{ description: '', date: '', amount: 0 }])
    setView('form')
  }

  // Add new item row
  const addItem = () => {
    setItems([...items, { description: '', date: '', amount: 0 }])
  }

  // Remove item row
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }

  // Update item
  const updateItem = (index: number, field: keyof ExpenseItem, value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  // Handle file attachment
  const handleFileAttachment = (index: number, file: File | null) => {
    if (!file) {
      updateItem(index, 'attachmentUrl', '')
      updateItem(index, 'attachmentName', '')
      return
    }

    // For now, store the file name - in production you'd upload to a storage service
    // Create a local URL for preview/print
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

  // Validate IBAN (basic check)
  const isValidIBAN = (iban: string) => {
    const cleaned = iban.replace(/\s/g, '').toUpperCase()
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(cleaned)
  }

  // Format IBAN for display
  const formatIBAN = (iban: string) => {
    const cleaned = iban.replace(/\s/g, '').toUpperCase()
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned
  }

  // Save declaration (auto-saves as DRAFT)
  const saveDeclaration = async () => {
    if (!employeeName.trim()) {
      toast.error('Vul je naam in')
      return false
    }

    if (!bankAccount.trim() || !isValidIBAN(bankAccount)) {
      toast.error('Vul een geldig IBAN nummer in')
      return false
    }

    const validItems = items.filter(i => i.description && i.date && i.amount > 0)
    if (validItems.length === 0) {
      toast.error('Voeg minimaal één complete kostenpost toe')
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
          items: validItems,
          note: note.trim(),
          submit: false, // Always save as draft
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Opslaan mislukt')
      }

      const saved = await res.json()
      setCurrentDeclaration(saved)

      // Refresh declarations list
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

  // Print/PDF generation
  const handlePrint = async () => {
    // First save the current state
    const saved = await saveDeclaration()
    if (!saved) return

    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }

  // Scroll modal into view when it mounts
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-workx-dark border border-white/10 rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-white/10 bg-workx-dark rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-workx-lime/20 flex items-center justify-center">
              <Icons.euro className="text-workx-lime" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Declaratieformulier</h2>
              <p className="text-sm text-gray-400">
                {currentDeclaration ? 'Formulier bewerken' : 'Nieuw formulier'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(view === 'form' ? 'history' : 'form')}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <Icons.clock size={16} />
              {view === 'form' ? 'Geschiedenis' : 'Terug'}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Icons.x size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {view === 'history' ? (
          /* History View */
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Opgeslagen declaraties</h3>
              <button onClick={startNewForm} className="btn-primary flex items-center gap-2 text-sm">
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
                    className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => loadDeclaration(decl)}
                  >
                    <div>
                      <p className="text-white font-medium">
                        {decl.employeeName}
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(decl.createdAt).toLocaleDateString('nl-NL')} • {decl.items.length} kostenpost{decl.items.length !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-workx-lime font-bold">
                        € {decl.totalAmount.toFixed(2).replace('.', ',')}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        decl.status === 'DRAFT' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                      }`}>
                        {decl.status === 'DRAFT' ? 'Concept' : 'Geprint'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Form View */
          <>
            <div ref={printRef} className="p-6 space-y-6">
              {/* Print Header (only visible when printing) */}
              <div className="hidden print:block mb-8 text-center">
                <h1 className="text-2xl font-bold mb-1">Declaratieformulier</h1>
                <p className="text-gray-500">Workx Advocaten</p>
                <p className="text-sm text-gray-400 mt-2">
                  Datum: {new Date().toLocaleDateString('nl-NL')}
                </p>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Naam medewerker *</label>
                  <input
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-field"
                    placeholder="Je volledige naam"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">IBAN Rekeningnummer *</label>
                  <input
                    type="text"
                    value={formatIBAN(bankAccount)}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="input-field font-mono"
                    placeholder="NL00 BANK 0000 0000 00"
                  />
                </div>
              </div>

              {/* Expense Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-gray-400">Kostenposten</label>
                  <button
                    onClick={addItem}
                    className="text-sm text-workx-lime hover:text-workx-lime/80 flex items-center gap-1"
                  >
                    <Icons.plus size={14} />
                    Kostenpost toevoegen
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item, index) => (
                    <div key={index} className="p-4 bg-white/5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Kostenpost {index + 1}</span>
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                          >
                            <Icons.trash size={16} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Omschrijving</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="input-field text-sm"
                            placeholder="Bijv. Reiskosten, Parkeren, Lunch cliënt..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Datum</label>
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateItem(index, 'date', e.target.value)}
                            className="input-field text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Bedrag (€)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.amount || ''}
                            onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                            className="input-field text-sm"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">Bon/Factuur bijlage</label>
                          <div className="flex items-center gap-2">
                            <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                              <Icons.paperclip size={16} className="text-gray-400" />
                              <span className="text-sm text-gray-400 truncate">
                                {item.attachmentName || 'Bestand kiezen...'}
                              </span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => handleFileAttachment(index, e.target.files?.[0] || null)}
                              />
                            </label>
                            {item.attachmentName && (
                              <button
                                onClick={() => handleFileAttachment(index, null)}
                                className="p-2 text-gray-500 hover:text-red-400"
                              >
                                <Icons.x size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                  <div className="bg-workx-lime/10 px-6 py-3 rounded-xl">
                    <span className="text-gray-400 text-sm mr-4">Totaal te declareren:</span>
                    <span className="text-workx-lime text-2xl font-bold">
                      € {totalAmount.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Opmerkingen (optioneel)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="Extra toelichting..."
                />
              </div>

              {/* Print section: Attachments list */}
              <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
                <h3 className="font-semibold mb-2">Bijlagen:</h3>
                <ul className="text-sm">
                  {items.filter(i => i.attachmentName).map((item, idx) => (
                    <li key={idx}>• {item.attachmentName} ({item.description})</li>
                  ))}
                </ul>
              </div>

              {/* Print signature area */}
              <div className="hidden print:block mt-8 pt-4 border-t border-gray-300">
                <div className="grid grid-cols-2 gap-8 mt-8">
                  <div>
                    <p className="text-sm mb-16">Handtekening medewerker:</p>
                    <div className="border-b border-gray-400"></div>
                  </div>
                  <div>
                    <p className="text-sm mb-16">Datum:</p>
                    <div className="border-b border-gray-400"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 flex items-center justify-between p-6 border-t border-white/10 bg-workx-dark rounded-b-2xl">
              <div className="flex gap-2">
                <button
                  onClick={startNewForm}
                  className="btn-secondary flex items-center gap-2"
                  title="Start een nieuw leeg formulier"
                >
                  <Icons.plus size={16} />
                  Nieuw formulier
                </button>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="btn-secondary">
                  Sluiten
                </button>
                <button
                  onClick={saveDeclaration}
                  disabled={isLoading}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isLoading ? (
                    <span className="w-4 h-4 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin" />
                  ) : (
                    <Icons.save size={16} />
                  )}
                  Opslaan
                </button>
                <button
                  onClick={handlePrint}
                  disabled={isLoading || isPrinting}
                  className="btn-primary flex items-center gap-2"
                >
                  {isPrinting ? (
                    <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                  ) : (
                    <Icons.fileText size={16} />
                  )}
                  Print formulier
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #expense-print-area,
          #expense-print-area * {
            visibility: visible !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          [data-print-content],
          [data-print-content] * {
            visibility: visible !important;
          }
          [data-print-content] {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 40px !important;
          }
          [data-print-content] input,
          [data-print-content] textarea {
            border: none !important;
            background: transparent !important;
            color: black !important;
            padding: 0 !important;
          }
          [data-print-content] .input-field {
            border-bottom: 1px solid #ccc !important;
          }
          .bg-workx-lime\\/10 {
            background: #f0f0f0 !important;
          }
          .text-workx-lime {
            color: #000 !important;
          }
          .text-gray-400,
          .text-gray-500 {
            color: #666 !important;
          }
          .text-white {
            color: #000 !important;
          }
          .bg-white\\/5 {
            background: #f5f5f5 !important;
            border: 1px solid #ddd !important;
          }
        }
      `}</style>
    </div>
  )
}
