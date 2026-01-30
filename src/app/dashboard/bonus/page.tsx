'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { Icons } from '@/components/ui/Icons'

interface Calculation {
  id: string
  invoiceAmount: number
  bonusPercentage: number
  isPaid: boolean
  bonusAmount: number
  invoiceNumber: string | null
  clientName: string | null
  createdAt: string
}

// Demo data - works without database
const DEMO_CALCULATIONS: Calculation[] = [
  { id: '1', invoiceAmount: 15000, bonusPercentage: 10, isPaid: true, bonusAmount: 1500, invoiceNumber: '2025-001', clientName: 'Bakker B.V.', createdAt: '2025-01-15' },
  { id: '2', invoiceAmount: 8500, bonusPercentage: 10, isPaid: true, bonusAmount: 850, invoiceNumber: '2025-002', clientName: 'De Vries Holdings', createdAt: '2025-01-20' },
  { id: '3', invoiceAmount: 22000, bonusPercentage: 12, isPaid: false, bonusAmount: 2640, invoiceNumber: '2025-003', clientName: 'Jansen & Partners', createdAt: '2025-01-25' },
  { id: '4', invoiceAmount: 5000, bonusPercentage: 10, isPaid: false, bonusAmount: 500, invoiceNumber: '2025-004', clientName: 'Tech Solutions', createdAt: '2025-01-28' },
]

export default function BonusPage() {
  const [calculations, setCalculations] = useState<Calculation[]>(DEMO_CALCULATIONS)
  const [isLoading, setIsLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ invoiceAmount: '', bonusPercentage: '10', isPaid: false, invoiceNumber: '', clientName: '' })

  const calculatedBonus = form.invoiceAmount ? parseFloat(form.invoiceAmount) * (parseFloat(form.bonusPercentage) / 100) : 0

  const resetForm = () => {
    setForm({ invoiceAmount: '', bonusPercentage: '10', isPaid: false, invoiceNumber: '', clientName: '' })
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
        isPaid: form.isPaid,
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
        isPaid: form.isPaid,
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
      isPaid: calc.isPaid,
      invoiceNumber: calc.invoiceNumber || '',
      clientName: calc.clientName || '',
    })
    setEditingId(calc.id)
    setShowForm(true)
  }

  const downloadPDF = (calc: Calculation) => {
    const doc = new jsPDF()
    doc.setFillColor(249, 255, 133)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 35, 'F')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Workx Advocaten', 20, 22)
    doc.setFontSize(10)
    doc.text('Bonus Berekening', 20, 30)
    doc.setTextColor(60, 60, 60)
    let y = 50
    doc.setFontSize(11)
    if (calc.clientName) { doc.text(`Klant: ${calc.clientName}`, 20, y); y += 10 }
    if (calc.invoiceNumber) { doc.text(`Factuurnummer: ${calc.invoiceNumber}`, 20, y); y += 10 }
    doc.text(`Factuurbedrag: ${formatCurrency(calc.invoiceAmount)}`, 20, y)
    doc.text(`Percentage: ${calc.bonusPercentage}%`, 20, y + 10)
    doc.text(`Status: ${calc.isPaid ? 'Betaald' : 'Nog niet betaald'}`, 20, y + 20)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`Bonus: ${formatCurrency(calc.bonusAmount)}`, 20, y + 35)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Gegenereerd op ${new Date().toLocaleDateString('nl-NL')}`, 20, 280)
    doc.save(`bonus-${calc.clientName || calc.id.slice(0, 8)}.pdf`)
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

  const total = calculations.reduce((s, c) => s + c.bonusAmount, 0)
  const paid = calculations.filter(c => c.isPaid).reduce((s, c) => s + c.bonusAmount, 0)
  const pending = calculations.filter(c => !c.isPaid).reduce((s, c) => s + c.bonusAmount, 0)
  const paidPercentage = total > 0 ? (paid / total) * 100 : 0

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
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Icons.plus size={16} />
          Nieuwe berekening
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-workx-lime/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-workx-lime/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                <Icons.chart className="text-workx-lime" size={22} />
              </div>
              <span className="text-xs text-white/30">{calculations.length} berekeningen</span>
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
            <p className="text-sm text-white/50 mb-1">Uitbetaald</p>
            <p className="text-3xl font-semibold text-green-400">{formatCurrency(paid)}</p>
          </div>
        </div>

        <div className="card p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-500/10 transition-colors" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Icons.clock className="text-orange-400" size={22} />
              </div>
              <span className="text-xs text-white/30">{calculations.filter(c => !c.isPaid).length} openstaand</span>
            </div>
            <p className="text-sm text-white/50 mb-1">Openstaand</p>
            <p className="text-3xl font-semibold text-orange-400">{formatCurrency(pending)}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {total > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-white/60">Uitbetalingsvoortgang</span>
            <span className="text-sm font-medium text-white">{paidPercentage.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-workx-lime rounded-full transition-all duration-500"
              style={{ width: `${paidPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/40">
            <span>Uitbetaald: {formatCurrency(paid)}</span>
            <span>Openstaand: {formatCurrency(pending)}</span>
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
            {calculations.map((calc, index) => (
              <div
                key={calc.id}
                className="card p-4 flex items-center justify-between group hover:border-white/10 transition-all"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${calc.isPaid ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                    {calc.isPaid ? (
                      <Icons.check className="text-green-400" size={20} />
                    ) : (
                      <Icons.clock className="text-orange-400" size={20} />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-white text-lg">{formatCurrency(calc.bonusAmount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${calc.isPaid ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {calc.isPaid ? 'Betaald' : 'Openstaand'}
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
            ))}
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

              <label className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="checkbox"
                  checked={form.isPaid}
                  onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
                  className="w-5 h-5 rounded accent-workx-lime"
                />
                <div>
                  <span className="text-white text-sm font-medium">Factuur is betaald</span>
                  <p className="text-xs text-white/40">Bonus wordt als uitbetaald gemarkeerd</p>
                </div>
              </label>

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
    </div>
  )
}
