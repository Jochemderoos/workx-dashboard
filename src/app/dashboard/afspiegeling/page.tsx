'use client'

import { useState, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { formatDateForAPI } from '@/lib/date-utils'
import { drawWorkxLogo, loadWorkxLogo } from '@/lib/pdf'

interface Employee {
  id: string
  name: string
  birthDate: string
  startDate: string
  functionCategory: string
}

interface AgeGroup {
  label: string
  minAge: number
  maxAge: number
  employees: Employee[]
  toBeDissmissed: number
  dismissedEmployees: Employee[]
}

const AGE_GROUPS = [
  { label: '15-25', minAge: 15, maxAge: 24, color: 'from-blue-500/20 to-blue-600/10', text: 'text-blue-400' },
  { label: '25-35', minAge: 25, maxAge: 34, color: 'from-green-500/20 to-green-600/10', text: 'text-green-400' },
  { label: '35-45', minAge: 35, maxAge: 44, color: 'from-yellow-500/20 to-yellow-600/10', text: 'text-yellow-400' },
  { label: '45-55', minAge: 45, maxAge: 54, color: 'from-orange-500/20 to-orange-600/10', text: 'text-orange-400' },
  { label: '55+', minAge: 55, maxAge: 999, color: 'from-red-500/20 to-red-600/10', text: 'text-red-400' },
]

export default function AfspiegelingPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [dismissalCount, setDismissalCount] = useState(0)
  const [functionFilter, setFunctionFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ name: '', birthDate: '', startDate: '', functionCategory: '' })
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showFormCategoryDropdown, setShowFormCategoryDropdown] = useState(false)

  const categories = useMemo(() => Array.from(new Set(employees.map(e => e.functionCategory))).sort(), [employees])
  const filtered = useMemo(() => functionFilter ? employees.filter(e => e.functionCategory === functionFilter) : employees, [employees, functionFilter])

  const getAge = (birth: string) => {
    const today = new Date()
    const b = new Date(birth)
    if (isNaN(b.getTime())) return 0
    let age = today.getFullYear() - b.getFullYear()
    if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--
    return age
  }

  const getTenure = (start: string) => Math.floor((Date.now() - new Date(start).getTime()) / (1000 * 60 * 60 * 24))
  const formatTenure = (start: string) => {
    const days = getTenure(start)
    const years = Math.floor(days / 365)
    const months = Math.floor((days % 365) / 30)
    return years > 0 ? `${years}j ${months}m` : `${months}m`
  }

  const result = useMemo(() => {
    if (filtered.length === 0 || dismissalCount <= 0 || dismissalCount > filtered.length) return null

    const groups: AgeGroup[] = AGE_GROUPS.map(g => ({
      ...g,
      employees: filtered.filter(e => { const age = getAge(e.birthDate); return age >= g.minAge && age <= g.maxAge }).sort((a, b) => getTenure(a.startDate) - getTenure(b.startDate)),
      toBeDissmissed: 0,
      dismissedEmployees: [],
    }))

    const percentage = dismissalCount / filtered.length
    const raw = groups.map(g => ({ g, floor: Math.floor(g.employees.length * percentage), rem: (g.employees.length * percentage) % 1 }))

    let assigned = 0
    raw.forEach(r => { r.g.toBeDissmissed = r.floor; assigned += r.floor })

    const remaining = dismissalCount - assigned
    const sorted = [...raw].filter(r => r.g.employees.length > r.g.toBeDissmissed).sort((a, b) => b.rem - a.rem)
    for (let i = 0; i < remaining && i < sorted.length; i++) sorted[i].g.toBeDissmissed++

    groups.forEach(g => { g.dismissedEmployees = g.employees.slice(0, g.toBeDissmissed) })

    return { groups, total: filtered.length, count: dismissalCount, percentage: percentage * 100 }
  }, [filtered, dismissalCount])

  const addEmployee = () => {
    if (!newEmployee.name || !newEmployee.birthDate || !newEmployee.startDate || !newEmployee.functionCategory) {
      return toast.error('Vul alle velden in')
    }
    setEmployees([...employees, { id: Date.now().toString(), ...newEmployee }])
    setNewEmployee({ name: '', birthDate: '', startDate: '', functionCategory: '' })
    setShowForm(false)
    toast.success('Werknemer toegevoegd')
  }

  const downloadPDF = async () => {
    if (!result) return

    // Pre-load the logo image
    const logoDataUrl = await loadWorkxLogo()

    const doc = new jsPDF()

    // Draw official Workx logo (flush top-left)
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)

    // Title next to logo
    doc.setTextColor(30, 30, 30)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('Afspiegelingsberekening', 60, 15)

    // Tagline
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('Gemaakt met de Workx App', 60, 22)

    // Stats
    doc.setTextColor(60, 60, 60)
    let y = 40
    doc.setFontSize(11)
    doc.text(`Totaal werknemers: ${result.total}`, 20, y)
    doc.text(`Te ontslaan: ${result.count} (${result.percentage.toFixed(1)}%)`, 20, y + 8)
    if (functionFilter) doc.text(`Functiecategorie: ${functionFilter}`, 20, y + 16)

    y += 35

    // Age groups
    doc.setFont('helvetica', 'bold')
    doc.text('Verdeling per leeftijdsgroep:', 20, y)
    y += 10
    doc.setFont('helvetica', 'normal')

    result.groups.forEach(g => {
      doc.text(`${g.label} jaar: ${g.employees.length} werknemers → ${g.toBeDissmissed} ontslag`, 25, y)
      y += 7
    })

    // Dismissed employees
    if (result.groups.some(g => g.dismissedEmployees.length > 0)) {
      y += 10
      doc.setFont('helvetica', 'bold')
      doc.text('Voor ontslag voorgedragen:', 20, y)
      y += 10
      doc.setFont('helvetica', 'normal')

      let num = 1
      result.groups.forEach(g => {
        g.dismissedEmployees.forEach(emp => {
          doc.text(`${num}. ${emp.name} (${getAge(emp.birthDate)}j, ${formatTenure(emp.startDate)})`, 25, y)
          y += 7
          num++
        })
      })
    }

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(`Gegenereerd op ${new Date().toLocaleDateString('nl-NL')} | UWV Afspiegelingsbeginsel`, 20, 280)

    doc.save(`afspiegeling-${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success('PDF gedownload')
  }

  return (
    <div className="space-y-8 fade-in relative">
      {/* Decorative glows */}
      <div className="absolute top-0 right-[10%] w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-32 left-[5%] w-48 h-48 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center">
            <Icons.layers className="text-red-400" size={20} />
          </div>
          <h1 className="text-2xl font-semibold text-white">Afspiegeling</h1>
        </div>
        <p className="text-gray-400">Bereken de ontslagvolgorde volgens het UWV afspiegelingsbeginsel</p>
      </div>

      {/* Info Card */}
      <div className="card p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Icons.info className="text-red-400" size={18} />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">UWV Afspiegelingsbeginsel</h3>
            <p className="text-sm text-gray-400">
              Werknemers worden ingedeeld in <span className="text-red-400 font-medium">5 leeftijdsgroepen</span>.
              Per groep wordt evenredig ontslagen, waarbij binnen elke groep de werknemer met het
              <span className="text-red-400 font-medium"> kortste dienstverband</span> als eerste komt.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-4">
          {/* Employees Card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <Icons.users className="text-gray-400" size={16} />
                </div>
                <span className="font-medium text-white">Werknemers</span>
                <span className="badge badge-lime">{employees.length}</span>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-workx-lime transition-colors"
              >
                <Icons.plus size={18} />
              </button>
            </div>

            {employees.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icons.users className="text-white/20" size={28} />
                </div>
                <p className="text-gray-400 mb-4">Nog geen werknemers toegevoegd</p>
                <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
                  <Icons.plus size={14} className="mr-2" />
                  Werknemer toevoegen
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                {employees.map((emp, index) => {
                  const age = getAge(emp.birthDate)
                  const group = AGE_GROUPS.find(g => age >= g.minAge && age <= g.maxAge)
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 group transition-all"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${group?.color || 'from-white/10 to-white/5'} flex items-center justify-center`}>
                          <span className={`text-sm font-semibold ${group?.text || 'text-gray-400'}`}>
                            {emp.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white">{emp.name}</p>
                          <p className="text-xs text-gray-400">
                            {age}j · {formatTenure(emp.startDate)} · {emp.functionCategory}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setEmployees(employees.filter(e => e.id !== emp.id))}
                        className="p-2 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Icons.trash size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Settings Card */}
          <div className="card p-5 space-y-4">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Icons.settings size={16} className="text-gray-400" />
              Berekening configureren
            </h3>

            {categories.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Functiecategorie</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="w-full flex items-center gap-3 px-3 py-3 bg-white/5 border border-white/10 rounded-xl text-left hover:border-white/20 hover:bg-white/10 transition-all focus:outline-none focus:border-workx-lime/30"
                  >
                    <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                      <Icons.layers size={14} className="text-white/50" />
                    </div>
                    <span className="flex-1 text-white text-sm">
                      {functionFilter ? `${functionFilter} (${employees.filter(e => e.functionCategory === functionFilter).length})` : `Alle categorieën (${employees.length})`}
                    </span>
                    <Icons.chevronDown size={16} className={`text-gray-400 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showCategoryDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCategoryDropdown(false)} />
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in max-h-64 overflow-y-auto">
                        <div className="py-1">
                          <button
                            onClick={() => { setFunctionFilter(''); setShowCategoryDropdown(false) }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${!functionFilter ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                              <Icons.layers size={14} className="text-white/50" />
                            </div>
                            <span className="flex-1">Alle categorieën</span>
                            <span className="text-gray-400 text-xs">{employees.length}</span>
                            {!functionFilter && <Icons.check size={16} className="ml-2 text-workx-lime" />}
                          </button>
                          {categories.map(c => (
                            <button
                              key={c}
                              onClick={() => { setFunctionFilter(c); setShowCategoryDropdown(false) }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${functionFilter === c ? 'bg-workx-lime/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                                <Icons.briefcase size={14} className="text-workx-lime" />
                              </div>
                              <span className="flex-1">{c}</span>
                              <span className="text-gray-400 text-xs">{employees.filter(e => e.functionCategory === c).length}</span>
                              {functionFilter === c && <Icons.check size={16} className="ml-2 text-workx-lime" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2">Aantal te ontslaan werknemers</label>
              <input
                type="number"
                min="0"
                max={filtered.length}
                value={dismissalCount || ''}
                onChange={(e) => setDismissalCount(parseInt(e.target.value) || 0)}
                className="input-field"
                placeholder="0"
              />
              {filtered.length > 0 && dismissalCount > 0 && (
                <p className="text-xs text-white/30 mt-1.5">
                  {((dismissalCount / filtered.length) * 100).toFixed(1)}% van {filtered.length} werknemers
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Result Section */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-white flex items-center gap-2">
              <Icons.chart size={16} className="text-gray-400" />
              Resultaat
            </h3>
            {result && (
              <button
                onClick={downloadPDF}
                className="flex items-center gap-2 text-sm text-workx-lime hover:underline"
              >
                <Icons.download size={14} />
                Download PDF
              </button>
            )}
          </div>

          {!result ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Icons.layers className="text-white/20" size={28} />
              </div>
              <p className="text-gray-400">Voeg werknemers toe en stel het aantal in</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white/5 text-center">
                  <p className="text-2xl font-semibold text-white">{result.total}</p>
                  <p className="text-xs text-gray-400">Totaal</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 text-center">
                  <p className="text-2xl font-semibold text-red-400">{result.count}</p>
                  <p className="text-xs text-gray-400">Ontslag</p>
                </div>
                <div className="p-4 rounded-xl bg-workx-lime/10 text-center">
                  <p className="text-2xl font-semibold text-workx-lime">{result.percentage.toFixed(0)}%</p>
                  <p className="text-xs text-gray-400">Krimp</p>
                </div>
              </div>

              {/* Age Groups */}
              <div>
                <h4 className="text-sm text-gray-400 mb-3">Verdeling per leeftijdsgroep</h4>
                <div className="space-y-2">
                  {result.groups.map((g) => {
                    const groupConfig = AGE_GROUPS.find(ag => ag.label === g.label)
                    return (
                      <div key={g.label} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className={`w-3 h-3 rounded-full ${
                          g.employees.length === 0 ? 'bg-white/20' : g.toBeDissmissed > 0 ? 'bg-red-400' : 'bg-green-400'
                        }`} />
                        <span className={`text-sm font-medium ${groupConfig?.text || 'text-gray-400'}`}>{g.label} jaar</span>
                        <div className="flex-1" />
                        <span className="text-sm text-gray-400">{g.employees.length}</span>
                        <Icons.arrowRight size={12} className="text-white/20" />
                        <span className={`text-sm font-medium ${g.toBeDissmissed > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {g.toBeDissmissed}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dismissed Employees */}
              {result.groups.some(g => g.dismissedEmployees.length > 0) && (
                <div>
                  <h4 className="text-sm text-gray-400 mb-3">Voor ontslag voorgedragen</h4>
                  <div className="space-y-2">
                    {result.groups.flatMap(g => g.dismissedEmployees).sort((a, b) => getTenure(a.startDate) - getTenure(b.startDate)).map((emp, i) => {
                      const age = getAge(emp.birthDate)
                      const group = AGE_GROUPS.find(g => age >= g.minAge && age <= g.maxAge)
                      return (
                        <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                          <span className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 text-xs flex items-center justify-center font-medium">
                            {i + 1}
                          </span>
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${group?.color || 'from-white/10 to-white/5'} flex items-center justify-center`}>
                            <span className={`text-xs font-semibold ${group?.text || 'text-gray-400'}`}>
                              {emp.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-white">{emp.name}</span>
                          <span className="text-xs text-gray-400">({age}j, {formatTenure(emp.startDate)})</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Employee Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 overflow-y-auto" onClick={() => setShowForm(false)}>
          <div className="min-h-full flex items-start justify-center p-4" style={{ paddingTop: '15vh' }}>
            <div className="bg-workx-gray rounded-2xl p-6 w-full max-w-md border border-white/10 shadow-2xl animate-modal-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
                  <Icons.user className="text-workx-lime" size={18} />
                </div>
                <h2 className="font-semibold text-white">Werknemer toevoegen</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <Icons.x size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Naam *</label>
                <div className="relative">
                  <Icons.user className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                  <input
                    type="text"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder="Volledige naam"
                    className="input-field pl-11"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Geboortedatum *</label>
                  <DatePicker
                    selected={newEmployee.birthDate ? new Date(newEmployee.birthDate) : null}
                    onChange={(date) => setNewEmployee({ ...newEmployee, birthDate: date ? formatDateForAPI(date) : '' })}
                    placeholder="Geboortedatum..."
                    maxDate={new Date()}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">In dienst sinds *</label>
                  <DatePicker
                    selected={newEmployee.startDate ? new Date(newEmployee.startDate) : null}
                    onChange={(date) => setNewEmployee({ ...newEmployee, startDate: date ? formatDateForAPI(date) : '' })}
                    placeholder="Startdatum..."
                    maxDate={new Date()}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Functiecategorie *</label>
                <div className="relative">
                  <Icons.briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 z-10" size={16} />
                  <input
                    type="text"
                    value={newEmployee.functionCategory}
                    onChange={(e) => setNewEmployee({ ...newEmployee, functionCategory: e.target.value })}
                    onFocus={() => categories.length > 0 && setShowFormCategoryDropdown(true)}
                    placeholder="bijv. Jurist, Secretariaat"
                    className="input-field pl-11"
                  />
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowFormCategoryDropdown(!showFormCategoryDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      <Icons.chevronDown size={16} className={`transition-transform ${showFormCategoryDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                  {showFormCategoryDropdown && categories.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowFormCategoryDropdown(false)} />
                      <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden fade-in max-h-48 overflow-y-auto">
                        <div className="py-1">
                          {categories.map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setNewEmployee({ ...newEmployee, functionCategory: c })
                                setShowFormCategoryDropdown(false)
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-all ${
                                newEmployee.functionCategory === c
                                  ? 'bg-workx-lime/10 text-white'
                                  : 'text-white/70 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <div className="w-7 h-7 rounded-lg bg-workx-lime/10 flex items-center justify-center">
                                <Icons.briefcase size={14} className="text-workx-lime" />
                              </div>
                              <span className="flex-1">{c}</span>
                              {newEmployee.functionCategory === c && (
                                <Icons.check size={16} className="text-workx-lime" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <p className="text-xs text-white/30 mt-1.5">Typ een nieuwe categorie of kies uit bestaande</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 btn-secondary">
                  Annuleren
                </button>
                <button onClick={addEmployee} className="flex-1 btn-primary">
                  Toevoegen
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
