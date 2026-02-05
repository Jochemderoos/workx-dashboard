'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import { drawWorkxLogo, loadWorkxLogo } from '@/lib/pdf'

interface Calculation {
  id: string
  invoiceAmount: number
  bonusPercentage: number
  invoicePaid: boolean  // Factuur is betaald door klant
  bonusPaid: boolean    // Bonus is uitbetaald aan medewerker
  bonusAmount: number
  invoiceNumber: string | null
  clientName: string | null
  createdAt: string
}

export default function BonusPage() {
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showBonusOverview, setShowBonusOverview] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ invoiceAmount: '', bonusPercentage: '20', invoicePaid: false, bonusPaid: false, invoiceNumber: '', clientName: '' })

  const calculatedBonus = form.invoiceAmount ? parseFloat(form.invoiceAmount) * (parseFloat(form.bonusPercentage) / 100) : 0

  // Fetch calculations from API on mount
  useEffect(() => {
    fetchCalculations()
  }, [])

  const fetchCalculations = async () => {
    try {
      const res = await fetch('/api/bonus')
      if (res.ok) {
        const data = await res.json()
        setCalculations(data)
      }
    } catch (error) {
      console.error('Error fetching calculations:', error)
      toast.error('Kon berekeningen niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setForm({ invoiceAmount: '', bonusPercentage: '20', invoicePaid: false, bonusPaid: false, invoiceNumber: '', clientName: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.invoiceAmount) return toast.error('Vul het factuurbedrag in')

    const invoiceAmount = parseFloat(form.invoiceAmount)
    const bonusPercentage = parseFloat(form.bonusPercentage)

    try {
      if (editingId) {
        // Update existing calculation
        const res = await fetch(`/api/bonus/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceAmount,
            bonusPercentage,
            invoicePaid: form.invoicePaid,
            bonusPaid: form.bonusPaid,
            invoiceNumber: form.invoiceNumber || null,
            clientName: form.clientName || null,
          })
        })
        if (res.ok) {
          const updated = await res.json()
          setCalculations(calculations.map(c => c.id === editingId ? updated : c))
          toast.success('Bijgewerkt')
        } else {
          toast.error('Bijwerken mislukt')
        }
      } else {
        // Create new calculation
        const res = await fetch('/api/bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceAmount,
            bonusPercentage,
            invoicePaid: form.invoicePaid,
            bonusPaid: form.bonusPaid,
            invoiceNumber: form.invoiceNumber || null,
            clientName: form.clientName || null,
          })
        })
        if (res.ok) {
          const newCalc = await res.json()
          setCalculations([newCalc, ...calculations])
          toast.success('Opgeslagen')
        } else {
          toast.error('Opslaan mislukt')
        }
      }
      resetForm()
    } catch (error) {
      console.error('Error saving calculation:', error)
      toast.error('Er ging iets mis')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Verwijderen?')) return
    try {
      const res = await fetch(`/api/bonus/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCalculations(calculations.filter(c => c.id !== id))
        toast.success('Verwijderd')
      } else {
        toast.error('Verwijderen mislukt')
      }
    } catch (error) {
      console.error('Error deleting calculation:', error)
      toast.error('Er ging iets mis')
    }
  }

  const handleEdit = (calc: Calculation) => {
    setForm({
      invoiceAmount: calc.invoiceAmount.toString(),
      bonusPercentage: calc.bonusPercentage.toString(),
      invoicePaid: calc.invoicePaid,
      bonusPaid: calc.bonusPaid,
      invoiceNumber: calc.invoiceNumber || '',
      clientName: calc.clientName || '',
    })
    setEditingId(calc.id)
    setShowForm(true)
  }

  const downloadPDF = async (calc: Calculation) => {
    // Pre-load the logo image
    const logoDataUrl = await loadWorkxLogo()

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Draw official Workx logo (flush top-left)
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    // Title next to logo
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Bonus Berekening', 60, 15)

    // Date
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(date, 60, 22)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 60, 28)

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(15, 55, pageWidth - 15, 55)

    let y = 70

    // Client info section
    if (calc.clientName || calc.invoiceNumber) {
      doc.setFillColor(248, 248, 248)
      doc.roundedRect(15, y - 5, pageWidth - 30, calc.clientName && calc.invoiceNumber ? 25 : 15, 4, 4, 'F')

      doc.setTextColor(100, 100, 100)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')

      if (calc.clientName) {
        doc.text('Klant', 20, y + 3)
        doc.setTextColor(51, 51, 51)
        doc.setFont('helvetica', 'bold')
        doc.text(calc.clientName, 60, y + 3)
        y += 10
      }
      if (calc.invoiceNumber) {
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')
        doc.text('Factuurnummer', 20, y + 3)
        doc.setTextColor(51, 51, 51)
        doc.setFont('helvetica', 'bold')
        doc.text(calc.invoiceNumber, 60, y + 3)
        y += 10
      }
      y += 15
    }

    // Calculation details
    const addRow = (label: string, value: string, color?: string) => {
      doc.setTextColor(100, 100, 100)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(label, 15, y)

      if (color === 'green') doc.setTextColor(0, 150, 0)
      else if (color === 'red') doc.setTextColor(200, 80, 80)
      else doc.setTextColor(51, 51, 51)

      doc.setFont('helvetica', 'bold')
      doc.text(value, pageWidth - 15, y, { align: 'right' })
      y += 10
    }

    addRow('Factuurbedrag (excl. BTW)', formatCurrency(calc.invoiceAmount))
    addRow('Bonus percentage', `${calc.bonusPercentage}%`)
    y += 5

    addRow('Factuur status', calc.invoicePaid ? 'Betaald' : 'Nog niet betaald', calc.invoicePaid ? 'green' : 'red')
    addRow('Bonus status', calc.bonusPaid ? 'Uitbetaald' : 'Nog uit te betalen', calc.bonusPaid ? 'green' : 'red')
    y += 10

    // Result box
    doc.setFillColor(255, 237, 74)
    doc.roundedRect(15, y, pageWidth - 30, 30, 4, 4, 'F')
    doc.setTextColor(45, 45, 45)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Berekende Bonus', 25, y + 12)
    doc.setFontSize(18)
    doc.text(formatCurrency(calc.bonusAmount), 25, y + 24)

    // Calculation note
    doc.setTextColor(80, 80, 80)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`${formatCurrency(calc.invoiceAmount)} × ${calc.bonusPercentage}%`, pageWidth - 25, y + 18, { align: 'right' })

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15
    doc.setFillColor(100, 100, 100)
    doc.rect(0, footerY - 5, pageWidth, 20, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
      pageWidth / 2,
      footerY + 2,
      { align: 'center' }
    )

    // Open PDF in new tab instead of downloading
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
  }

  // Download PDF with all bonuses that need to be paid
  const downloadBonusOverviewPDF = async () => {
    const bonusesToPay = calculations.filter(c => c.invoicePaid && !c.bonusPaid)
    if (bonusesToPay.length === 0) {
      toast.error('Geen bonussen om uit te betalen')
      return
    }

    // Pre-load the logo image
    const logoDataUrl = await loadWorkxLogo()

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Draw official Workx logo (flush top-left)
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    // Title
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Overzicht Te Betalen Bonussen', 60, 15)

    // Date
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const dateStr = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(dateStr, 60, 22)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 60, 28)

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(15, 55, pageWidth - 15, 55)

    // Summary box
    const totalBonus = bonusesToPay.reduce((sum, c) => sum + c.bonusAmount, 0)
    doc.setFillColor(255, 237, 74)
    doc.roundedRect(15, 62, pageWidth - 30, 20, 4, 4, 'F')
    doc.setTextColor(45, 45, 45)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`${bonusesToPay.length} bonussen klaar voor uitbetaling`, 25, 73)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(formatCurrency(totalBonus), pageWidth - 25, 76, { align: 'right' })

    // Table header
    let y = 95
    doc.setFillColor(51, 51, 51)
    doc.roundedRect(15, y - 6, pageWidth - 30, 12, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('KLANT', 20, y)
    doc.text('FACTUURNR.', 70, y)
    doc.text('BEDRAG', 110, y)
    doc.text('%', 145, y)
    doc.text('BONUS', pageWidth - 20, y, { align: 'right' })

    // Table rows
    y += 14
    doc.setFont('helvetica', 'normal')

    bonusesToPay.forEach((calc, index) => {
      if (y > 250) {
        doc.addPage()
        y = 30
      }
      // Alternate row background
      if (index % 2 === 0) {
        doc.setFillColor(248, 248, 248)
        doc.rect(15, y - 5, pageWidth - 30, 10, 'F')
      }

      doc.setTextColor(51, 51, 51)
      doc.setFontSize(9)
      doc.text(calc.clientName || '-', 20, y)
      doc.text(calc.invoiceNumber || '-', 70, y)
      doc.text(formatCurrency(calc.invoiceAmount), 110, y)
      doc.text(`${calc.bonusPercentage}%`, 145, y)
      doc.setFont('helvetica', 'bold')
      doc.text(formatCurrency(calc.bonusAmount), pageWidth - 20, y, { align: 'right' })
      doc.setFont('helvetica', 'normal')
      y += 10
    })

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15
    doc.setFillColor(100, 100, 100)
    doc.rect(0, footerY - 5, pageWidth, 20, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(
      'Workx advocaten  •  Herengracht 448, 1017 CA Amsterdam  •  +31 (0)20 308 03 20  •  info@workxadvocaten.nl',
      pageWidth / 2,
      footerY + 2,
      { align: 'center' }
    )

    // Open PDF in new tab instead of downloading
    const pdfBlob = doc.output('blob')
    const pdfUrl = URL.createObjectURL(pdfBlob)
    window.open(pdfUrl, '_blank')
    toast.success('PDF geopend')
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

  // Totaal = alle bonussen
  const total = calculations.reduce((s, c) => s + c.bonusAmount, 0)
  // Uitbetaald = factuur betaald EN bonus betaald
  const bonusPaidAmount = calculations.filter(c => c.bonusPaid).reduce((s, c) => s + c.bonusAmount, 0)
  // Te betalen = factuur betaald maar bonus nog NIET betaald
  const bonusesToPay = calculations.filter(c => c.invoicePaid && !c.bonusPaid)
  const bonusToPayAmount = bonusesToPay.reduce((s, c) => s + c.bonusAmount, 0)
  // Wachtend = factuur nog niet betaald
  const pendingInvoices = calculations.filter(c => !c.invoicePaid)
  const pendingAmount = pendingInvoices.reduce((s, c) => s + c.bonusAmount, 0)
  const paidPercentage = total > 0 ? (bonusPaidAmount / total) * 100 : 0

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
              <Icons.euro className="text-green-400" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Bonus Calculator</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Bereken en beheer je bonussen op basis van facturaties</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Popover.Root open={showBonusOverview} onOpenChange={setShowBonusOverview}>
            <Popover.Trigger asChild>
              <button
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-green-500/10 border border-green-500/20 rounded-lg sm:rounded-xl text-green-400 hover:bg-green-500/20 transition-all text-xs sm:text-base"
              >
                <Icons.euro size={14} className="sm:w-4 sm:h-4" />
                <span>Te betalen</span>
                {bonusesToPay.length > 0 && (
                  <span className="px-1.5 sm:px-2 py-0.5 bg-green-500/20 rounded-full text-xs">{bonusesToPay.length}</span>
                )}
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="w-[90vw] max-w-2xl bg-workx-gray rounded-2xl border border-white/10 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col z-50 animate-modal-in"
                sideOffset={8}
                collisionPadding={16}
                side="bottom"
                align="end"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                        <Icons.euro className="text-emerald-400" size={18} />
                      </div>
                      <div>
                        <h2 className="font-semibold text-white text-lg">Te betalen bonussen</h2>
                        <p className="text-sm text-gray-400">{bonusesToPay.length} bonussen klaar voor uitbetaling</p>
                      </div>
                    </div>
                    <Popover.Close className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                      <Icons.x size={18} />
                    </Popover.Close>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {bonusesToPay.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                        <Icons.check className="text-gray-600" size={28} />
                      </div>
                      <p className="text-gray-400">Alle bonussen zijn uitbetaald!</p>
                    </div>
                  ) : (
                    bonusesToPay.map((calc, index) => (
                      <div
                        key={calc.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <span className="text-emerald-400 font-semibold text-sm">{index + 1}</span>
                          </div>
                          <div>
                            <p className="font-medium text-white">{calc.clientName || 'Onbekende klant'}</p>
                            <p className="text-sm text-gray-400">
                              {calc.invoiceNumber ? `#${calc.invoiceNumber}` : 'Geen factuurnr.'} · {formatCurrency(calc.invoiceAmount)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-emerald-400 text-lg">{formatCurrency(calc.bonusAmount)}</p>
                          <p className="text-xs text-gray-500">{calc.bonusPercentage}%</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer with total and actions */}
                {bonusesToPay.length > 0 && (
                  <div className="p-6 border-t border-white/10 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-400">Totaal te betalen</span>
                      <span className="text-2xl font-semibold text-emerald-400">{formatCurrency(bonusToPayAmount)}</span>
                    </div>
                    <div className="flex gap-3">
                      <Popover.Close className="flex-1 btn-secondary">
                        Sluiten
                      </Popover.Close>
                      <button
                        onClick={() => { downloadBonusOverviewPDF(); }}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        <Icons.download size={16} />
                        Download PDF
                      </button>
                    </div>
                  </div>
                )}
                <Popover.Arrow className="fill-workx-gray" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <Popover.Root open={showForm} onOpenChange={(open) => { if (!open) resetForm(); else setShowForm(true); }}>
            <Popover.Trigger asChild>
              <button className="btn-primary flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-base">
                <Icons.plus size={14} className="sm:w-4 sm:h-4" />
                <span>Nieuw</span>
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="w-[90vw] max-w-lg bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
                sideOffset={8}
                collisionPadding={16}
                side="bottom"
                align="end"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                      <Icons.calculator className="text-workx-lime" size={18} />
                    </div>
                    <h2 className="font-semibold text-white text-lg">{editingId ? 'Bewerken' : 'Nieuwe berekening'}</h2>
                  </div>
                  <Popover.Close className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                    <Icons.x size={18} />
                  </Popover.Close>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Factuurbedrag (excl. BTW) *</label>
                    <div className="relative">
                      <Icons.euro className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                      <input
                        type="number"
                        step="0.01"
                        value={form.invoiceAmount}
                        onChange={(e) => setForm({ ...form, invoiceAmount: e.target.value })}
                        className="input-field pl-11"
                        placeholder="0,00"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Bonus percentage</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={form.bonusPercentage}
                        onChange={(e) => setForm({ ...form, bonusPercentage: e.target.value })}
                        className="input-field pr-10"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Klant</label>
                      <input
                        type="text"
                        value={form.clientName}
                        onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                        className="input-field"
                        placeholder="Klantnaam"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Factuurnummer</label>
                      <input
                        type="text"
                        value={form.invoiceNumber}
                        onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                        className="input-field"
                        placeholder="2024-001"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${form.invoicePaid ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                      <input
                        type="checkbox"
                        checked={form.invoicePaid}
                        onChange={(e) => setForm({ ...form, invoicePaid: e.target.checked, bonusPaid: e.target.checked ? form.bonusPaid : false })}
                        className="w-5 h-5 rounded accent-blue-400"
                      />
                      <div>
                        <span className="text-white text-sm font-medium">Factuur is betaald</span>
                        <p className="text-xs text-gray-400">Klant heeft de factuur betaald</p>
                      </div>
                      {form.invoicePaid && <Icons.check size={18} className="ml-auto text-blue-400" />}
                    </label>

                    <label className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${!form.invoicePaid ? 'opacity-50 cursor-not-allowed' : form.bonusPaid ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                      <input
                        type="checkbox"
                        checked={form.bonusPaid}
                        onChange={(e) => setForm({ ...form, bonusPaid: e.target.checked })}
                        disabled={!form.invoicePaid}
                        className="w-5 h-5 rounded accent-green-400"
                      />
                      <div>
                        <span className="text-white text-sm font-medium">Bonus is betaald</span>
                        <p className="text-xs text-gray-400">Bonus is uitbetaald aan medewerker</p>
                      </div>
                      {form.bonusPaid && <Icons.check size={18} className="ml-auto text-green-400" />}
                    </label>
                  </div>

                  {form.invoiceAmount && parseFloat(form.invoiceAmount) > 0 && (
                    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-workx-lime/10 to-workx-lime/5 border border-workx-lime/20 p-5">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                      <div className="relative">
                        <p className="text-sm text-gray-400 mb-1">Berekende bonus</p>
                        <p className="text-3xl font-semibold text-workx-lime">{formatCurrency(calculatedBonus)}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatCurrency(parseFloat(form.invoiceAmount))} × {form.bonusPercentage}%
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Popover.Close className="flex-1 btn-secondary">
                      Annuleren
                    </Popover.Close>
                    <button type="submit" className="flex-1 btn-primary">
                      {editingId ? 'Bijwerken' : 'Opslaan'}
                    </button>
                  </div>
                </form>
                <Popover.Arrow className="fill-workx-gray" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 sm:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.chart className="text-workx-lime" size={18} />
              </div>
              <span className="text-xs sm:text-xs text-gray-500">{calculations.length} totaal</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Totale bonus</p>
            <p className="text-2xl sm:text-3xl font-semibold text-white">{formatCurrency(total)}</p>
          </div>
        </div>

        <div className="card p-4 sm:p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Icons.check className="text-green-400" size={18} />
              </div>
              <span className="badge badge-lime text-xs sm:text-xs">{paidPercentage.toFixed(0)}%</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mb-1">Bonus uitbetaald</p>
            <p className="text-2xl sm:text-3xl font-semibold text-green-400">{formatCurrency(bonusPaidAmount)}</p>
          </div>
        </div>

        <div
          className="card p-6 relative overflow-hidden group cursor-pointer hover:border-green-500/30"
          onClick={() => { if (bonusesToPay.length > 0) { setShowBonusOverview(true) } }}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Icons.euro className="text-emerald-400" size={22} />
              </div>
              <span className="text-xs text-gray-500">{bonusesToPay.length} klaar</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Te betalen bonus</p>
            <p className="text-3xl font-semibold text-emerald-400">{formatCurrency(bonusToPayAmount)}</p>
          </div>
        </div>

        <div className="card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Icons.clock className="text-orange-400" size={22} />
              </div>
              <span className="text-xs text-gray-500">{pendingInvoices.length} wachtend</span>
            </div>
            <p className="text-sm text-gray-400 mb-1">Factuur niet betaald</p>
            <p className="text-3xl font-semibold text-orange-400">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Bonus uitbetalingsvoortgang</span>
            <span className="text-sm font-medium text-white">{paidPercentage.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
              style={{ width: `${(bonusPaidAmount / total) * 100}%` }}
              title="Bonus uitbetaald"
            />
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${(bonusToPayAmount / total) * 100}%` }}
              title="Te betalen"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              Uitbetaald: {formatCurrency(bonusPaidAmount)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Te betalen: {formatCurrency(bonusToPayAmount)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/20" />
              Wachtend: {formatCurrency(pendingAmount)}
            </span>
          </div>
        </div>
      )}

      {/* List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-white">Berekeningen</h2>
          <span className="text-sm text-gray-500">{calculations.length} totaal</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : calculations.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Icons.euro className="text-gray-600" size={32} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nog geen berekeningen</h3>
            <p className="text-gray-400 mb-6 max-w-sm mx-auto">
              Voeg je eerste bonusberekening toe om te beginnen met het bijhouden van je verdiensten.
            </p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Icons.plus size={16} className="mr-2" />
              Eerste berekening toevoegen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {calculations.map((calc, index) => {
              // Determine status and styling
              let statusIcon, statusBg, statusText, statusLabel
              if (calc.bonusPaid) {
                statusIcon = <Icons.check className="text-green-400" size={20} />
                statusBg = 'bg-green-500/10'
                statusText = 'bg-green-500/10 text-green-400'
                statusLabel = 'Bonus betaald'
              } else if (calc.invoicePaid) {
                statusIcon = <Icons.euro className="text-emerald-400" size={20} />
                statusBg = 'bg-emerald-500/10'
                statusText = 'bg-emerald-500/10 text-emerald-400'
                statusLabel = 'Te betalen'
              } else {
                statusIcon = <Icons.clock className="text-orange-400" size={20} />
                statusBg = 'bg-orange-500/10'
                statusText = 'bg-orange-500/10 text-orange-400'
                statusLabel = 'Factuur wachtend'
              }

              return (
                <div
                  key={calc.id}
                  className="card p-4 flex items-center justify-between group hover:border-white/10 transition-all"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusBg}`}>
                      {statusIcon}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-white text-lg">{formatCurrency(calc.bonusAmount)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusText}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                        <span>{formatCurrency(calc.invoiceAmount)} × {calc.bonusPercentage}%</span>
                        {calc.clientName && (
                          <>
                            <span className="text-gray-600">·</span>
                            <span>{calc.clientName}</span>
                          </>
                        )}
                        {calc.invoiceNumber && (
                          <>
                            <span className="text-gray-600">·</span>
                            <span>#{calc.invoiceNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadPDF(calc)} className="p-2.5 text-gray-400 hover:text-workx-lime rounded-lg hover:bg-white/5 transition-colors" title="Download PDF">
                      <Icons.download size={16} />
                    </button>
                    <button onClick={() => handleEdit(calc)} className="p-2.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Bewerken">
                      <Icons.edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(calc.id)} className="p-2.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" title="Verwijderen">
                      <Icons.trash size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
