'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { Icons } from '@/components/ui/Icons'
import { drawWorkxLogo } from '@/lib/pdf'

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
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showBonusOverview, setShowBonusOverview] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ invoiceAmount: '', bonusPercentage: '10', invoicePaid: false, bonusPaid: false, invoiceNumber: '', clientName: '' })

  const calculatedBonus = form.invoiceAmount ? parseFloat(form.invoiceAmount) * (parseFloat(form.bonusPercentage) / 100) : 0

  const resetForm = () => {
    setForm({ invoiceAmount: '', bonusPercentage: '10', invoicePaid: false, bonusPaid: false, invoiceNumber: '', clientName: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.invoiceAmount) return toast.error('Vul het factuurbedrag in')

    const invoiceAmount = parseFloat(form.invoiceAmount)
    const bonusPercentage = parseFloat(form.bonusPercentage)
    const bonusAmount = invoiceAmount * (bonusPercentage / 100)

    if (editingId) {
      setCalculations(calculations.map(c => c.id === editingId ? {
        ...c,
        invoiceAmount,
        bonusPercentage,
        bonusAmount,
        invoicePaid: form.invoicePaid,
        bonusPaid: form.bonusPaid,
        invoiceNumber: form.invoiceNumber || null,
        clientName: form.clientName || null,
      } : c))
      toast.success('Bijgewerkt')
    } else {
      const newCalc: Calculation = {
        id: Date.now().toString(),
        invoiceAmount,
        bonusPercentage,
        bonusAmount,
        invoicePaid: form.invoicePaid,
        bonusPaid: form.bonusPaid,
        invoiceNumber: form.invoiceNumber || null,
        clientName: form.clientName || null,
        createdAt: new Date().toISOString(),
      }
      setCalculations([newCalc, ...calculations])
      toast.success('Opgeslagen')
    }
    resetForm()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Verwijderen?')) return
    setCalculations(calculations.filter(c => c.id !== id))
    toast.success('Verwijderd')
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

  const downloadPDF = (calc: Calculation) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Draw authentic Workx logo
    drawWorkxLogo(doc, 15, 15, 55)

    // Title next to logo
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Bonus Berekening', 80, 30)

    // Date
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const date = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(date, 80, 38)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 15, 50)

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

    doc.save(`bonus-${calc.clientName || calc.id.slice(0, 8)}.pdf`)
  }

  // Download PDF with all bonuses that need to be paid
  const downloadBonusOverviewPDF = () => {
    const bonusesToPay = calculations.filter(c => c.invoicePaid && !c.bonusPaid)
    if (bonusesToPay.length === 0) {
      toast.error('Geen bonussen om uit te betalen')
      return
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    // Draw authentic Workx logo
    drawWorkxLogo(doc, 15, 15, 55)

    // Title
    doc.setTextColor(51, 51, 51)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Overzicht Te Betalen Bonussen', 80, 28)

    // Date
    doc.setTextColor(100, 100, 100)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const dateStr = new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
    doc.text(dateStr, 80, 36)

    // Tagline
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text('Gemaakt met de Workx App', 15, 50)

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

    doc.save(`te-betalen-bonussen-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF gedownload')
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
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/10 flex items-center justify-center">
              <Icons.euro className="text-green-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Bonus Calculator</h1>
          </div>
          <p className="text-white/40">Bereken en beheer je bonussen op basis van facturaties</p>
        </div>
        <div className="flex items-center gap-3">
          {bonusesToPay.length > 0 && (
            <button
              onClick={() => setShowBonusOverview(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 hover:bg-green-500/20 transition-all"
            >
              <Icons.euro size={16} />
              Te betalen bonus
              <span className="ml-1 px-2 py-0.5 bg-green-500/20 rounded-full text-xs">{bonusesToPay.length}</span>
            </button>
          )}
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Icons.plus size={16} />
            Nieuwe berekening
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.chart className="text-workx-lime" size={22} />
              </div>
              <span className="text-xs text-white/30">{calculations.length} totaal</span>
            </div>
            <p className="text-sm text-white/50 mb-1">Totale bonus</p>
            <p className="text-3xl font-semibold text-white">{formatCurrency(total)}</p>
          </div>
        </div>

        <div className="card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-green-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Icons.check className="text-green-400" size={22} />
              </div>
              <span className="badge badge-lime">{paidPercentage.toFixed(0)}%</span>
            </div>
            <p className="text-sm text-white/50 mb-1">Bonus uitbetaald</p>
            <p className="text-3xl font-semibold text-green-400">{formatCurrency(bonusPaidAmount)}</p>
          </div>
        </div>

        <div className="card p-6 relative overflow-hidden group cursor-pointer hover:border-green-500/30" onClick={() => bonusesToPay.length > 0 && setShowBonusOverview(true)}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Icons.euro className="text-emerald-400" size={22} />
              </div>
              <span className="text-xs text-white/30">{bonusesToPay.length} klaar</span>
            </div>
            <p className="text-sm text-white/50 mb-1">Te betalen bonus</p>
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
              <span className="text-xs text-white/30">{pendingInvoices.length} wachtend</span>
            </div>
            <p className="text-sm text-white/50 mb-1">Factuur niet betaald</p>
            <p className="text-3xl font-semibold text-orange-400">{formatCurrency(pendingAmount)}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">Bonus uitbetalingsvoortgang</span>
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
          <div className="flex justify-between mt-2 text-xs text-white/40">
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
          <span className="text-sm text-white/30">{calculations.length} totaal</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
          </div>
        ) : calculations.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Icons.euro className="text-white/20" size={32} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nog geen berekeningen</h3>
            <p className="text-white/40 mb-6 max-w-sm mx-auto">
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
                      <div className="flex items-center gap-3 mt-1 text-sm text-white/40">
                        <span>{formatCurrency(calc.invoiceAmount)} × {calc.bonusPercentage}%</span>
                        {calc.clientName && (
                          <>
                            <span className="text-white/20">·</span>
                            <span>{calc.clientName}</span>
                          </>
                        )}
                        {calc.invoiceNumber && (
                          <>
                            <span className="text-white/20">·</span>
                            <span>#{calc.invoiceNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadPDF(calc)} className="p-2.5 text-white/40 hover:text-workx-lime rounded-lg hover:bg-white/5 transition-colors" title="Download PDF">
                      <Icons.download size={16} />
                    </button>
                    <button onClick={() => handleEdit(calc)} className="p-2.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors" title="Bewerken">
                      <Icons.edit size={16} />
                    </button>
                    <button onClick={() => handleDelete(calc.id)} className="p-2.5 text-white/40 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors" title="Verwijderen">
                      <Icons.trash size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={resetForm}>
          <div className="bg-workx-gray rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                  <Icons.calculator className="text-workx-lime" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">{editingId ? 'Bewerken' : 'Nieuwe berekening'}</h2>
              </div>
              <button onClick={resetForm} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-2">Factuurbedrag (excl. BTW) *</label>
                <div className="relative">
                  <Icons.euro className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
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
                <label className="block text-sm text-white/60 mb-2">Bonus percentage</label>
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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Klant</label>
                  <input
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                    className="input-field"
                    placeholder="Klantnaam"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Factuurnummer</label>
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
                    <p className="text-xs text-white/40">Klant heeft de factuur betaald</p>
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
                    <p className="text-xs text-white/40">Bonus is uitbetaald aan medewerker</p>
                  </div>
                  {form.bonusPaid && <Icons.check size={18} className="ml-auto text-green-400" />}
                </label>
              </div>

              {form.invoiceAmount && parseFloat(form.invoiceAmount) > 0 && (
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-workx-lime/10 to-workx-lime/5 border border-workx-lime/20 p-5">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-workx-lime/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative">
                    <p className="text-sm text-white/60 mb-1">Berekende bonus</p>
                    <p className="text-3xl font-semibold text-workx-lime">{formatCurrency(calculatedBonus)}</p>
                    <p className="text-xs text-white/40 mt-2">
                      {formatCurrency(parseFloat(form.invoiceAmount))} × {form.bonusPercentage}%
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm} className="flex-1 btn-secondary">
                  Annuleren
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingId ? 'Bijwerken' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bonus Overview Modal */}
      {showBonusOverview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in" onClick={() => setShowBonusOverview(false)}>
          <div className="bg-workx-gray rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                    <Icons.euro className="text-emerald-400" size={18} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-white text-lg">Te betalen bonussen</h2>
                    <p className="text-sm text-white/40">{bonusesToPay.length} bonussen klaar voor uitbetaling</p>
                  </div>
                </div>
                <button onClick={() => setShowBonusOverview(false)} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  <Icons.x size={18} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {bonusesToPay.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icons.check className="text-white/20" size={28} />
                  </div>
                  <p className="text-white/60">Alle bonussen zijn uitbetaald!</p>
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
                        <p className="text-sm text-white/40">
                          {calc.invoiceNumber ? `#${calc.invoiceNumber}` : 'Geen factuurnr.'} · {formatCurrency(calc.invoiceAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-emerald-400 text-lg">{formatCurrency(calc.bonusAmount)}</p>
                      <p className="text-xs text-white/30">{calc.bonusPercentage}%</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with total and actions */}
            {bonusesToPay.length > 0 && (
              <div className="p-6 border-t border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white/60">Totaal te betalen</span>
                  <span className="text-2xl font-semibold text-emerald-400">{formatCurrency(bonusToPayAmount)}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowBonusOverview(false)}
                    className="flex-1 btn-secondary"
                  >
                    Sluiten
                  </button>
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
          </div>
        </div>
      )}
    </div>
  )
}
