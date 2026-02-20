'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import ExpenseDeclarationForm from '@/components/expenses/ExpenseDeclarationForm'

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

// ==================== MAIN PAGE ====================

export default function DeclaratiesPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'bonnetjes' | 'declaratieformulier'>('bonnetjes')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewActivity, setShowNewActivity] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [showDeclaratieForm, setShowDeclaratieForm] = useState(false)

  const userId = session?.user?.id || ''
  const userRole = (session?.user as { role?: string })?.role || 'EMPLOYEE'

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
          Declaratieformulier
        </button>
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
      ) : (
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
      )}
    </div>
  )
}
