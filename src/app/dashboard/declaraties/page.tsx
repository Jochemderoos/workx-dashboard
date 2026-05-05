'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import ExpenseDeclarationForm from '@/components/expenses/ExpenseDeclarationForm'
import { buildExpensePDF } from '@/lib/expense-pdf'

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ==================== DECLARATION OVERVIEW (for managers) ====================

interface OverviewDeclaration {
  id: string
  employeeName: string
  bankAccount: string
  status: string
  totalAmount: number
  note?: string
  invoiceNumber?: string
  holdingName?: string
  createdAt: string
  items: {
    id: string
    description: string
    date: string
    amount: number
    attachmentName?: string
    expenseType?: string
    kilometers?: number
    chargeToClient?: string
  }[]
}

function DeclarationOverview() {
  const [declarations, setDeclarations] = useState<OverviewDeclaration[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'SUBMITTED' | 'PAID'>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const fetchDeclarations = useCallback(async () => {
    try {
      const res = await fetch('/api/expenses')
      if (res.ok) {
        setDeclarations(await res.json())
      }
    } catch {
      toast.error('Kon declaraties niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeclarations()
  }, [fetchDeclarations])

  const togglePaidStatus = async (id: string, currentStatus: string) => {
    const newAction = currentStatus === 'PAID' ? 'unpaid' : 'paid'
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newAction }),
      })
      if (res.ok) {
        const newStatus = newAction === 'paid' ? 'PAID' : 'SUBMITTED'
        setDeclarations(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d))
        toast.success(newAction === 'paid' ? 'Gemarkeerd als betaald' : 'Teruggezet naar onbetaald')
      } else {
        toast.error('Kon status niet wijzigen')
      }
    } catch {
      toast.error('Kon status niet wijzigen')
    }
  }

  const deleteDeclaration = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze declaratie wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeclarations(prev => prev.filter(d => d.id !== id))
        toast.success('Declaratie verwijderd')
      } else {
        toast.error('Kon declaratie niet verwijderen')
      }
    } catch {
      toast.error('Kon declaratie niet verwijderen')
    }
  }

  const downloadPDF = async (decl: OverviewDeclaration) => {
    setDownloadingId(decl.id)
    try {
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
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Kon PDF niet genereren')
    } finally {
      setDownloadingId(null)
    }
  }

  const downloadAttachment = async (decl: OverviewDeclaration) => {
    try {
      const fullRes = await fetch(`/api/expenses/${decl.id}`)
      if (!fullRes.ok) throw new Error('Kon declaratie niet ophalen')
      const fullDecl = await fullRes.json()

      let found = false
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
        found = true
      }
      if (!found) toast.error('Geen bijlage gevonden')
    } catch {
      toast.error('Kon bijlage niet downloaden')
    }
  }

  const filtered = declarations
    .filter(d => d.status !== 'DRAFT')
    .filter(d => statusFilter === 'all' || d.status === statusFilter)
    .filter(d => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        d.employeeName.toLowerCase().includes(q) ||
        (d.invoiceNumber || '').toLowerCase().includes(q) ||
        (d.holdingName || '').toLowerCase().includes(q)
      )
    })

  const submittedCount = declarations.filter(d => d.status === 'SUBMITTED').length
  const paidCount = declarations.filter(d => d.status === 'PAID').length
  const totalOpen = declarations.filter(d => d.status === 'SUBMITTED').reduce((s, d) => s + d.totalAmount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Openstaand</p>
          <p className="text-2xl font-bold text-orange-400">{submittedCount}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <p className="text-xs text-white/40 mb-1">Totaal openstaand</p>
          <p className="text-2xl font-bold text-workx-lime">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-white/40 mb-1">Betaald</p>
          <p className="text-2xl font-bold text-green-400">{paidCount}</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Icons.search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, factuurnummer..."
            className="input-field w-full pl-10 !rounded-xl"
          />
        </div>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {(['all', 'SUBMITTED', 'PAID'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-workx-lime text-workx-dark'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {s === 'all' ? 'Alles' : s === 'SUBMITTED' ? 'Onbetaald' : 'Betaald'}
            </button>
          ))}
        </div>
      </div>

      {/* Declarations list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Icons.fileText size={48} className="mx-auto mb-4 opacity-30" />
          <p>{statusFilter === 'all' ? 'Nog geen ingediende declaraties' : 'Geen resultaten'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(decl => (
            <div
              key={decl.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl transition-colors gap-3 ${
                decl.status === 'PAID'
                  ? 'bg-white/[0.02] opacity-60 hover:opacity-80'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium ${decl.status === 'PAID' ? 'text-gray-400' : 'text-white'}`}>
                    {decl.employeeName}
                  </p>
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
                <p className="text-sm text-gray-500 mt-0.5">
                  {new Date(decl.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' · '}
                  {decl.items.length} post{decl.items.length !== 1 ? 'en' : ''}
                  {decl.items.some(i => i.attachmentName) && (
                    <span className="text-workx-lime/60"> · met bijlage(n)</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {(decl.status === 'SUBMITTED' || decl.status === 'PAID') && (
                  <button
                    onClick={() => togglePaidStatus(decl.id, decl.status)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      decl.status === 'PAID'
                        ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                        : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    <Icons.check size={14} />
                    {decl.status === 'PAID' ? 'Onbetaald' : 'Betaald'}
                  </button>
                )}
                <button
                  onClick={() => downloadPDF(decl)}
                  disabled={downloadingId === decl.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-workx-lime/10 text-workx-lime text-xs font-medium hover:bg-workx-lime/20 transition-colors disabled:opacity-50"
                >
                  {downloadingId === decl.id ? (
                    <span className="w-3.5 h-3.5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                  ) : (
                    <Icons.download size={14} />
                  )}
                  PDF
                </button>
                <button
                  onClick={() => downloadAttachment(decl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Icons.paperclip size={14} />
                  Bijlage
                </button>
                <button
                  onClick={() => deleteDeclaration(decl.id)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Verwijderen"
                >
                  <Icons.trash size={14} />
                </button>
                <div className="text-right shrink-0 ml-1">
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
  )
}

// ==================== MAIN PAGE ====================

export default function DeclaratiesPage() {
  const { data: session } = useSession()
  const userRole = (session?.user as { role?: string })?.role || 'EMPLOYEE'
  const isManagerRole = userRole === 'ADMIN' || userRole === 'PARTNER'

  const [activeTab, setActiveTab] = useState<'eigen' | 'overzicht'>('eigen')

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.euro size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Declaraties</h1>
            <p className="text-sm text-white/40">Verzamel uitgaven in een concept en dien in één keer in</p>
          </div>
        </div>
      </div>

      {isManagerRole && (
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('eigen')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'eigen'
                ? 'bg-workx-lime text-workx-dark'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Mijn declaraties
          </button>
          <button
            onClick={() => setActiveTab('overzicht')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'overzicht'
                ? 'bg-workx-lime text-workx-dark'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            Overzicht
          </button>
        </div>
      )}

      {!isManagerRole || activeTab === 'eigen' ? (
        <ExpenseDeclarationForm onClose={() => {}} inline />
      ) : (
        <DeclarationOverview />
      )}
    </div>
  )
}
