'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import ExpenseDeclarationForm from '@/components/expenses/ExpenseDeclarationForm'
import { buildExpensePDF } from '@/lib/expense-pdf'

// ==================== TYPES ====================

interface Activity {
  id: string
  name: string
  description: string | null
  date: string
  status: string
  createdById: string
  createdBy: { id: string; name: string }
  receipts: { id: string; amount: number | null }[]
  receiptCount: number
  totalAmount: number
  createdAt: string
}

interface Receipt {
  id: string
  activityId: string
  uploadedById: string
  description: string | null
  amount: number | null
  imageUrl: string
  imageName: string
  createdAt: string
  uploadedBy: { id: string; name: string }
}

interface ActivityDetail {
  id: string
  name: string
  description: string | null
  date: string
  status: string
  createdById: string
  createdBy: { id: string; name: string }
  receipts: Receipt[]
}

// ==================== HELPER COMPONENTS ====================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    OPEN: { label: 'Open', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
    CLOSED: { label: 'Afgerond', cls: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    DECLARED: { label: 'Gedeclareerd', cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  }
  const c = config[status] || config.OPEN
  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${c.cls}`}>
      {c.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ==================== LIGHTBOX ====================

function Lightbox({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <Icons.x size={16} />
        </button>
        <img src={imageUrl} alt="Bonnetje" className="max-h-[85vh] rounded-xl object-contain" />
      </div>
    </div>
  )
}

// ==================== NIEUWE ACTIVITEIT MODAL ====================

function NewActivityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !date) return

    setSaving(true)
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, date }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Fout bij aanmaken')
      }
      toast.success('Activiteit aangemaakt!')
      onCreated()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kon activiteit niet aanmaken')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Nieuwe activiteit</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <Icons.x size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5">Naam *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="bijv. Hamburg trip, Kantooruitje december"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-workx-lime/50 transition-colors"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Datum *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-workx-lime/50 transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5">Beschrijving (optioneel)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Extra context over de activiteit..."
              rows={2}
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-workx-lime/50 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Aanmaken...' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==================== RECEIPT CARD ====================

function ReceiptCard({
  receipt,
  canDelete,
  onUpdate,
  onDelete,
  onImageClick,
}: {
  receipt: Receipt
  canDelete: boolean
  onUpdate: (id: string, data: { description?: string; amount?: string }) => void
  onDelete: (id: string) => void
  onImageClick: (url: string) => void
}) {
  const [desc, setDesc] = useState(receipt.description || '')
  const [amount, setAmount] = useState(receipt.amount !== null ? String(receipt.amount) : '')
  const [editing, setEditing] = useState(false)
  const descTimer = useRef<ReturnType<typeof setTimeout>>()
  const amountTimer = useRef<ReturnType<typeof setTimeout>>()

  function handleDescChange(val: string) {
    setDesc(val)
    clearTimeout(descTimer.current)
    descTimer.current = setTimeout(() => onUpdate(receipt.id, { description: val }), 800)
  }

  function handleAmountChange(val: string) {
    setAmount(val)
    clearTimeout(amountTimer.current)
    amountTimer.current = setTimeout(() => onUpdate(receipt.id, { amount: val }), 800)
  }

  return (
    <div className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
      {/* Thumbnail */}
      <div
        className="relative aspect-[4/3] cursor-pointer overflow-hidden bg-black/20"
        onClick={() => onImageClick(receipt.imageUrl)}
      >
        <img
          src={receipt.imageUrl}
          alt={receipt.description || 'Bonnetje'}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[10px] text-white/70 truncate">{receipt.uploadedBy.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(!editing) }}
            className="p-1 rounded bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <Icons.edit size={12} />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        {editing ? (
          <>
            <input
              type="text"
              value={desc}
              onChange={e => handleDescChange(e.target.value)}
              placeholder="Beschrijving..."
              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-workx-lime/50"
            />
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">€</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder="0,00"
                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-workx-lime/50"
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => setEditing(false)}
                className="text-[10px] text-workx-lime hover:underline"
              >
                Klaar
              </button>
              {canDelete && (
                <button
                  onClick={() => onDelete(receipt.id)}
                  className="p-1 text-red-400/60 hover:text-red-400 transition-colors"
                >
                  <Icons.trash size={14} />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-white/80 truncate">
              {receipt.description || <span className="text-white/30 italic">Geen beschrijving</span>}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-workx-lime">
                {receipt.amount !== null ? formatCurrency(receipt.amount) : <span className="text-white/30">—</span>}
              </span>
              <span className="text-[10px] text-white/30">
                {new Date(receipt.createdAt).toLocaleDateString('nl-NL')}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ==================== ACTIVITY DETAIL VIEW ====================

function ActivityDetailView({
  activityId,
  userId,
  userRole,
  onBack,
}: {
  activityId: string
  userId: string
  userRole: string
  onBack: () => void
}) {
  const [activity, setActivity] = useState<ActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchActivity = useCallback(async () => {
    try {
      const res = await fetch(`/api/activities/${activityId}`)
      if (res.ok) {
        setActivity(await res.json())
      }
    } catch {
      toast.error('Kon activiteit niet laden')
    } finally {
      setLoading(false)
    }
  }, [activityId])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  async function handleUpload(files: FileList) {
    if (!files.length) return
    setUploading(true)

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/activities/${activityId}/receipts`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Upload mislukt')
        }
      }

      toast.success(files.length === 1 ? 'Bonnetje geüpload!' : `${files.length} bonnetjes geüpload!`)
      fetchActivity()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload mislukt')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleUpdateReceipt(receiptId: string, data: { description?: string; amount?: string }) {
    try {
      await fetch(`/api/activities/${activityId}/receipts/${receiptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {
      toast.error('Kon bonnetje niet bijwerken')
    }
  }

  async function handleDeleteReceipt(receiptId: string) {
    if (!confirm('Weet je zeker dat je dit bonnetje wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/activities/${activityId}/receipts/${receiptId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verwijderen mislukt')
      }
      toast.success('Bonnetje verwijderd')
      fetchActivity()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kon niet verwijderen')
    }
  }

  async function handleStatusChange(newStatus: string) {
    try {
      const res = await fetch(`/api/activities/${activityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        toast.success(`Status gewijzigd naar ${newStatus === 'OPEN' ? 'Open' : newStatus === 'CLOSED' ? 'Afgerond' : 'Gedeclareerd'}`)
        fetchActivity()
      }
    } catch {
      toast.error('Kon status niet wijzigen')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="text-center py-20 text-white/40">
        Activiteit niet gevonden
      </div>
    )
  }

  const totalAmount = activity.receipts.reduce((sum, r) => sum + (r.amount || 0), 0)
  const isAdmin = userRole === 'PARTNER' || userRole === 'ADMIN'
  const isCreator = activity.createdById === userId

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors self-start"
        >
          <Icons.chevronLeft size={18} />
          <span className="text-sm">Terug</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-semibold text-white truncate">{activity.name}</h2>
            <StatusBadge status={activity.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-white/40">
            <span>{formatDate(activity.date)}</span>
            <span>·</span>
            <span>{activity.createdBy.name}</span>
          </div>
          {activity.description && (
            <p className="text-sm text-white/50 mt-1">{activity.description}</p>
          )}
        </div>

        {/* Status knoppen */}
        {(isCreator || isAdmin) && (
          <div className="flex gap-2 flex-shrink-0">
            {activity.status === 'OPEN' && (
              <button
                onClick={() => handleStatusChange('CLOSED')}
                className="px-3 py-1.5 text-xs rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
              >
                Afsluiten
              </button>
            )}
            {activity.status === 'CLOSED' && (
              <>
                <button
                  onClick={() => handleStatusChange('OPEN')}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:bg-white/5 transition-colors"
                >
                  Heropenen
                </button>
                <button
                  onClick={() => handleStatusChange('DECLARED')}
                  className="px-3 py-1.5 text-xs rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  Gedeclareerd
                </button>
              </>
            )}
            {activity.status === 'DECLARED' && (
              <button
                onClick={() => handleStatusChange('CLOSED')}
                className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:bg-white/5 transition-colors"
              >
                Terug naar afgerond
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload knop */}
      {activity.status === 'OPEN' && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={e => e.target.files && handleUpload(e.target.files)}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-workx-lime/10 border-2 border-dashed border-workx-lime/30 text-workx-lime hover:bg-workx-lime/20 hover:border-workx-lime/50 transition-all disabled:opacity-50 text-base font-medium"
          >
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
                <span>Uploaden...</span>
              </>
            ) : (
              <>
                <Icons.upload size={22} />
                <span>Bonnetje toevoegen</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Bonnetjes grid */}
      {activity.receipts.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Icons.image size={40} className="mx-auto mb-3 opacity-50" />
          <p>Nog geen bonnetjes</p>
          <p className="text-sm mt-1">Upload je eerste bonnetje hierboven</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {activity.receipts.map(receipt => (
              <ReceiptCard
                key={receipt.id}
                receipt={receipt}
                canDelete={receipt.uploadedById === userId || isAdmin}
                onUpdate={handleUpdateReceipt}
                onDelete={handleDeleteReceipt}
                onImageClick={setLightboxUrl}
              />
            ))}
          </div>

          {/* Totaal */}
          <div className="mt-6 flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
            <div className="text-sm text-white/50">
              {activity.receipts.length} bonnetje{activity.receipts.length !== 1 ? 's' : ''}
              {' · '}
              {activity.receipts.filter(r => r.amount !== null).length} met bedrag
            </div>
            <div className="text-lg font-semibold text-workx-lime">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightboxUrl && <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
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
      // Fetch full declaration data including attachment URLs
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

  // Filter & search
  const filtered = declarations
    .filter(d => d.status !== 'DRAFT') // Only show submitted/paid
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
  const [activeTab, setActiveTab] = useState<'bonnetjes' | 'declaratieformulier' | 'overzicht'>('bonnetjes')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [showDeclaratieForm, setShowDeclaratieForm] = useState(false)

  const userId = session?.user?.id || ''
  const userRole = (session?.user as { role?: string })?.role || 'EMPLOYEE'
  const isManagerRole = userRole === 'ADMIN' || userRole === 'PARTNER'

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch('/api/activities')
      if (res.ok) {
        setActivities(await res.json())
      }
    } catch {
      toast.error('Kon activiteiten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  async function handleDeleteActivity(id: string) {
    if (!confirm('Weet je zeker dat je deze activiteit en alle bonnetjes wilt verwijderen?')) return

    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Verwijderen mislukt')
      }
      toast.success('Activiteit verwijderd')
      fetchActivities()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Kon niet verwijderen')
    }
  }

  const isAdmin = userRole === 'PARTNER' || userRole === 'ADMIN'

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-workx-lime/10 flex items-center justify-center">
            <Icons.euro size={20} className="text-workx-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Bonnetjes & Declaraties</h1>
            <p className="text-sm text-white/40">Upload bonnetjes per activiteit of maak een declaratie</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('bonnetjes')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'bonnetjes'
              ? 'bg-workx-lime text-workx-dark'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          Bonnetjes
        </button>
        <button
          onClick={() => setActiveTab('declaratieformulier')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'declaratieformulier'
              ? 'bg-workx-lime text-workx-dark'
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          Declaraties
        </button>
        {isManagerRole && (
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
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'bonnetjes' ? (
        selectedActivityId ? (
          <ActivityDetailView
            activityId={selectedActivityId}
            userId={userId}
            userRole={userRole}
            onBack={() => { setSelectedActivityId(null); fetchActivities() }}
          />
        ) : (
          <div>
            {/* Action bar */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-white/40">
                {activities.length} activiteit{activities.length !== 1 ? 'en' : ''}
              </p>
              <button
                onClick={() => setShowNewActivity(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-colors"
              >
                <Icons.plus size={16} />
                Nieuwe activiteit
              </button>
            </div>

            {/* Activities list */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin" />
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                  <Icons.image size={28} className="text-white/20" />
                </div>
                <p className="text-white/40 mb-2">Nog geen activiteiten</p>
                <p className="text-sm text-white/25 mb-6">Maak een activiteit aan om bonnetjes te verzamelen</p>
                <button
                  onClick={() => setShowNewActivity(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-colors"
                >
                  <Icons.plus size={16} />
                  Eerste activiteit aanmaken
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {activities.map(activity => (
                  <div
                    key={activity.id}
                    className="group bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/20 hover:bg-white/[0.07] transition-all cursor-pointer"
                    onClick={() => setSelectedActivityId(activity.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-medium text-white truncate group-hover:text-workx-lime transition-colors">
                          {activity.name}
                        </h3>
                        <p className="text-xs text-white/40 mt-0.5">{formatDate(activity.date)}</p>
                      </div>
                      <StatusBadge status={activity.status} />
                    </div>

                    {activity.description && (
                      <p className="text-sm text-white/40 mb-3 line-clamp-2">{activity.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex items-center gap-3 text-sm text-white/50">
                        <span className="flex items-center gap-1.5">
                          <Icons.image size={14} />
                          {activity.receiptCount}
                        </span>
                        <span className="text-workx-lime font-medium">
                          {formatCurrency(activity.totalAmount)}
                        </span>
                      </div>

                      {(activity.createdById === userId || isAdmin) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteActivity(activity.id) }}
                          className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="Verwijderen"
                        >
                          <Icons.trash size={14} />
                        </button>
                      )}
                    </div>

                    <div className="mt-2 text-[10px] text-white/25">
                      Door {activity.createdBy.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* New activity modal */}
            {showNewActivity && (
              <NewActivityModal
                onClose={() => setShowNewActivity(false)}
                onCreated={fetchActivities}
              />
            )}
          </div>
        )
      ) : activeTab === 'declaratieformulier' ? (
        /* Tab 2: Declaratieformulier */
        <div>
          {showDeclaratieForm ? (
            <div className="relative">
              <ExpenseDeclarationForm onClose={() => setShowDeclaratieForm(false)} />
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-workx-lime/10 flex items-center justify-center mx-auto mb-4">
                <Icons.euro size={28} className="text-workx-lime" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Onkosten declareren</h3>
              <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
                Maak een formele declaratie aan met IBAN, facturen en genereer een PDF voor de administratie.
              </p>
              <button
                onClick={() => setShowDeclaratieForm(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-workx-lime text-workx-dark font-medium text-sm hover:bg-workx-lime/90 transition-colors"
              >
                <Icons.plus size={16} />
                Nieuwe declaratie
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Tab 3: Overzicht (managers only) */
        <DeclarationOverview />
      )}
    </div>
  )
}
