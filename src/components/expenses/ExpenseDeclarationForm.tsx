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
}

export default function ExpenseDeclarationForm({ onClose }: ExpenseDeclarationFormProps) {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // View state
  const [view, setView] = useState<'form' | 'history'>('form')
  const [savedDeclarations, setSavedDeclarations] = useState<ExpenseDeclaration[]>([])
  const [currentDeclaration, setCurrentDeclaration] = useState<ExpenseDeclaration | null>(null)

  // Form state
  const [employeeName, setEmployeeName] = useState(session?.user?.name || '')
  const [bankAccount, setBankAccount] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([])

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
    setItems([])
    setView('form')
  }

  // Add new item
  const addItem = () => {
    setItems([...items, { description: '', date: new Date().toISOString().split('T')[0], amount: 0 }])
  }

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
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

  // Save declaration
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
      toast.error('Voeg minimaal één kostenpost toe')
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

  // Print
  const handlePrint = async () => {
    const saved = await saveDeclaration()
    if (!saved) return

    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 100)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                {view === 'history' ? 'Eerdere declaraties' : items.length > 0 ? `${items.length} kostenpost${items.length !== 1 ? 'en' : ''}` : 'Voeg je kosten toe'}
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
                      <p className="text-white font-medium">{decl.employeeName}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(decl.createdAt).toLocaleDateString('nl-NL')} • {decl.items.length} kostenpost{decl.items.length !== 1 ? 'en' : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-workx-lime font-bold text-lg">
                        € {decl.totalAmount.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Form View */
          <div className="p-6 space-y-6" id="expense-print-area">
            {/* Print Header */}
            <div className="hidden print:block mb-8 text-center">
              <h1 className="text-2xl font-bold mb-1">Declaratieformulier</h1>
              <p className="text-gray-500">Workx Advocaten - {new Date().toLocaleDateString('nl-NL')}</p>
            </div>

            {/* Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Naam medewerker</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="input-field"
                  placeholder="Je volledige naam"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">IBAN Rekeningnummer</label>
                <input
                  type="text"
                  value={formatIBAN(bankAccount)}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="input-field font-mono"
                  placeholder="NL00 BANK 0000 0000 00"
                />
              </div>
            </div>

            {/* Expense Table */}
            <div className="card p-0 overflow-hidden">
              <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-medium text-white flex items-center gap-2">
                  <Icons.fileText size={18} className="text-workx-lime" />
                  Kostenposten
                </h3>
                <button
                  onClick={addItem}
                  className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Icons.plus size={16} />
                  Kostenpost toevoegen
                </button>
              </div>

              {items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icons.plus size={32} className="text-gray-500" />
                  </div>
                  <p className="text-gray-400 mb-4">Nog geen kostenposten toegevoegd</p>
                  <button
                    onClick={addItem}
                    className="btn-primary flex items-center gap-2 mx-auto"
                  >
                    <Icons.plus size={16} />
                    Eerste kostenpost toevoegen
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/10">
                        <th className="px-4 py-3 font-medium">Datum</th>
                        <th className="px-4 py-3 font-medium">Omschrijving</th>
                        <th className="px-4 py-3 font-medium text-right">Bedrag</th>
                        <th className="px-4 py-3 font-medium">Bijlage</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-b border-white/5 hover:bg-white/5">
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={item.date}
                              onChange={(e) => updateItem(index, 'date', e.target.value)}
                              className="input-field text-sm py-1.5 w-36"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(index, 'description', e.target.value)}
                              className="input-field text-sm py-1.5"
                              placeholder="Bijv. Parkeren, Reiskosten..."
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">€</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.amount || ''}
                                onChange={(e) => updateItem(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="input-field text-sm py-1.5 w-24 text-right"
                                placeholder="0,00"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-white">
                              <Icons.paperclip size={14} />
                              <span className="truncate max-w-[100px]">
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
                        <td colSpan={2} className="px-4 py-4 text-right font-medium text-gray-400">
                          Totaal te declareren:
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-2xl font-bold text-workx-lime">
                            € {totalAmount.toFixed(2).replace('.', ',')}
                          </span>
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
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

            {/* Print signature area */}
            <div className="hidden print:block mt-8 pt-8 border-t border-gray-300">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-sm mb-16">Handtekening:</p>
                  <div className="border-b border-gray-400"></div>
                </div>
                <div>
                  <p className="text-sm mb-16">Datum:</p>
                  <div className="border-b border-gray-400"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {view === 'form' && (
          <div className="sticky bottom-0 flex items-center justify-between p-6 border-t border-white/10 bg-workx-dark rounded-b-2xl">
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
                onClick={handlePrint}
                disabled={isLoading || isPrinting || items.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
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
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #expense-print-area, #expense-print-area * { visibility: visible !important; }
          #expense-print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            background: white !important; color: black !important; padding: 40px !important;
          }
          #expense-print-area input, #expense-print-area textarea {
            border: none !important; background: transparent !important;
            color: black !important; padding: 0 !important;
          }
          #expense-print-area table { border-collapse: collapse; }
          #expense-print-area th, #expense-print-area td {
            border: 1px solid #ddd !important; padding: 8px !important;
          }
          #expense-print-area .btn-primary, #expense-print-area .btn-secondary { display: none !important; }
          .text-workx-lime { color: #000 !important; }
          .text-gray-400, .text-gray-500 { color: #666 !important; }
          .text-white { color: #000 !important; }
          .bg-workx-lime\\/10 { background: #f0f0f0 !important; }
        }
      `}</style>
    </div>
  )
}
