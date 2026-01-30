'use client'

import { useState } from 'react'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'

export default function TransitiePage() {
  const [form, setForm] = useState({
    startDate: '',
    endDate: '',
    salary: '',
    vacationMoney: true,
    vacationPercent: '8',
    thirteenthMonth: false,
    employeeName: '',
  })
  const [result, setResult] = useState<{ years: number; months: number; amount: number; totalSalary: number } | null>(null)

  const calculate = () => {
    if (!form.startDate || !form.endDate || !form.salary) {
      return toast.error('Vul alle verplichte velden in')
    }

    const start = new Date(form.startDate)
    const end = new Date(form.endDate)
    if (end <= start) return toast.error('Einddatum moet na startdatum')

    let years = end.getFullYear() - start.getFullYear()
    let months = end.getMonth() - start.getMonth()
    if (months < 0) { years--; months += 12 }

    const totalMonths = years * 12 + months
    const base = parseFloat(form.salary)
    const vacation = form.vacationMoney ? base * (parseFloat(form.vacationPercent) / 100) : 0
    const thirteenth = form.thirteenthMonth ? base / 12 : 0
    const totalSalary = base + vacation + thirteenth
    const amount = (totalSalary / 3) * (totalMonths / 12)

    setResult({ years, months, amount: Math.round(amount * 100) / 100, totalSalary })
    toast.success('Berekend')
  }

  const reset = () => {
    setForm({ startDate: '', endDate: '', salary: '', vacationMoney: true, vacationPercent: '8', thirteenthMonth: false, employeeName: '' })
    setResult(null)
  }

  const downloadPDF = () => {
    if (!result) return
    const doc = new jsPDF()

    // Header
    doc.setFillColor(249, 255, 133)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, 'F')
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.text('Workx Advocaten', 20, 25)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Transitievergoeding Berekening', 20, 35)

    // Content
    doc.setTextColor(60, 60, 60)
    doc.setFontSize(11)
    let y = 60

    if (form.employeeName) {
      doc.setFont('helvetica', 'bold')
      doc.text('Werknemer:', 20, y)
      doc.setFont('helvetica', 'normal')
      doc.text(form.employeeName, 70, y)
      y += 12
    }

    doc.setFont('helvetica', 'bold')
    doc.text('Dienstverband:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${result.years} jaar en ${result.months} maanden`, 70, y)
    y += 10

    doc.text(`Van ${new Date(form.startDate).toLocaleDateString('nl-NL')} tot ${new Date(form.endDate).toLocaleDateString('nl-NL')}`, 70, y)
    y += 15

    doc.setFont('helvetica', 'bold')
    doc.text('Salaris (incl.):', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatCurrency(result.totalSalary) + ' per maand', 70, y)
    y += 25

    // Result box
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(20, y, 170, 35, 3, 3, 'F')
    doc.setFontSize(12)
    doc.setTextColor(100, 100, 100)
    doc.text('Transitievergoeding', 30, y + 15)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(formatCurrency(result.amount), 30, y + 28)

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Gegenereerd op ${new Date().toLocaleDateString('nl-NL')} | Formule: 1/3 bruto maandsalaris x dienstjaren`, 20, 280)

    doc.save(`transitie-${form.employeeName || 'berekening'}.pdf`)
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)

  return (
    <div className="max-w-4xl space-y-8 fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center">
            <Icons.calculator className="text-purple-400" size={20} />
          </div>
          <h1 className="text-2xl font-semibold text-white">Transitievergoeding</h1>
        </div>
        <p className="text-white/40">Bereken de wettelijke transitievergoeding voor werknemers</p>
      </div>

      {/* Info Card */}
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Icons.info className="text-purple-400" size={18} />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">Wettelijke formule</h3>
            <p className="text-sm text-white/60">
              De transitievergoeding bedraagt <span className="text-purple-400 font-medium">1/3 bruto maandsalaris</span> per gewerkt jaar (naar rato voor onvolledige jaren).
              Het maandsalaris is inclusief vakantiegeld en eventuele vaste toeslagen.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 card p-6 space-y-5">
          <h2 className="font-medium text-white flex items-center gap-2">
            <Icons.edit size={16} className="text-white/40" />
            Gegevens invoeren
          </h2>

          <div>
            <label className="block text-sm text-white/60 mb-2">Werknemer (optioneel)</label>
            <div className="relative">
              <Icons.user className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="text"
                value={form.employeeName}
                onChange={(e) => setForm({ ...form, employeeName: e.target.value })}
                className="input-field pl-11"
                placeholder="Naam werknemer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-2">Startdatum dienstverband *</label>
              <div className="relative">
                <Icons.calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="input-field pl-11"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-2">Einddatum dienstverband *</label>
              <div className="relative">
                <Icons.calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="input-field pl-11"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-2">Bruto maandsalaris (excl. vakantiegeld) *</label>
            <div className="relative">
              <Icons.euro className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
              <input
                type="number"
                step="0.01"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                className="input-field pl-11"
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={form.vacationMoney}
                onChange={(e) => setForm({ ...form, vacationMoney: e.target.checked })}
                className="w-5 h-5 rounded accent-workx-lime"
              />
              <div className="flex-1">
                <span className="text-white text-sm font-medium">Vakantiegeld</span>
                <p className="text-xs text-white/40">Standaard 8% van het bruto jaarsalaris</p>
              </div>
              {form.vacationMoney && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={form.vacationPercent}
                    onChange={(e) => setForm({ ...form, vacationPercent: e.target.value })}
                    className="w-16 bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-workx-lime/50"
                  />
                  <span className="text-white/40 text-sm">%</span>
                </div>
              )}
            </label>

            <label className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={form.thirteenthMonth}
                onChange={(e) => setForm({ ...form, thirteenthMonth: e.target.checked })}
                className="w-5 h-5 rounded accent-workx-lime"
              />
              <div className="flex-1">
                <span className="text-white text-sm font-medium">13e maand</span>
                <p className="text-xs text-white/40">Extra maandsalaris per jaar</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={reset} className="btn-secondary flex items-center gap-2">
              <Icons.refresh size={16} />
              Reset
            </button>
            <button onClick={calculate} className="flex-1 btn-primary flex items-center justify-center gap-2">
              <Icons.calculator size={16} />
              Bereken transitievergoeding
            </button>
          </div>
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          {result ? (
            <div className="card p-6 space-y-6 sticky top-8">
              {/* Main result */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-6 text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <p className="text-sm text-white/60 mb-2">Transitievergoeding</p>
                  <p className="text-4xl font-semibold text-purple-400 mb-1">{formatCurrency(result.amount)}</p>
                  <p className="text-xs text-white/40">Netto te ontvangen</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.calendar size={14} className="text-white/40" />
                    Dienstverband
                  </span>
                  <span className="text-sm font-medium text-white">{result.years} jaar, {result.months} maanden</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.euro size={14} className="text-white/40" />
                    Maandsalaris (incl.)
                  </span>
                  <span className="text-sm font-medium text-white">{formatCurrency(result.totalSalary)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-sm text-white/60 flex items-center gap-2">
                    <Icons.chart size={14} className="text-white/40" />
                    1/3 maandsalaris
                  </span>
                  <span className="text-sm font-medium text-white">{formatCurrency(result.totalSalary / 3)}</span>
                </div>
              </div>

              {/* Actions */}
              <button onClick={downloadPDF} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Icons.download size={16} />
                Download PDF rapport
              </button>

              {form.employeeName && (
                <p className="text-center text-xs text-white/30">
                  Berekening voor {form.employeeName}
                </p>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center sticky top-8">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icons.calculator className="text-white/20" size={28} />
              </div>
              <h3 className="text-white font-medium mb-2">Klaar om te berekenen</h3>
              <p className="text-white/40 text-sm">
                Vul de gegevens in om de transitievergoeding te berekenen
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legal disclaimer */}
      <div className="card p-4 border-white/5">
        <div className="flex items-start gap-3">
          <Icons.shield size={16} className="text-white/30 mt-0.5" />
          <p className="text-xs text-white/40 leading-relaxed">
            <strong className="text-white/50">Disclaimer:</strong> Deze berekening is indicatief en gebaseerd op de wettelijke regeling per 1 januari 2020.
            De daadwerkelijke transitievergoeding kan afwijken door CAO-afspraken of andere bijzondere omstandigheden.
            Raadpleeg een arbeidsrechtspecialist voor een definitieve berekening.
          </p>
        </div>
      </div>
    </div>
  )
}
