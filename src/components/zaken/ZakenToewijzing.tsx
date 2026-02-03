'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Icons } from '@/components/ui/Icons'
import DatePicker from '@/components/ui/DatePicker'
import { EXPERIENCE_LABELS, URGENCY_CONFIG, START_METHOD_LABELS } from '@/lib/zaken-utils'

interface Zaak {
  id: string
  shortDescription: string
  fullDescription?: string
  minimumExperienceYear: number
  startMethod: string
  startInstructions?: string
  urgency: string
  startsQuickly: boolean
  clientName?: string
  clientContact?: string
  status: string
  createdAt: string
  createdBy: { id: string; name: string }
  assignedTo?: { id: string; name: string }
  assignedAt?: string
  assignmentQueue: Array<{
    id: string
    queuePosition: number
    status: string
    hoursWorkedBasis: number
    offeredAt?: string
    respondedAt?: string
    declineReason?: string
    user: { id: string; name: string }
  }>
}

interface ZakenToewijzingProps {
  isPartner: boolean
}

export default function ZakenToewijzing({ isPartner }: ZakenToewijzingProps) {
  const [zaken, setZaken] = useState<Zaak[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedZaak, setExpandedZaak] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    shortDescription: '',
    fullDescription: '',
    minimumExperienceYear: 1,
    startMethod: 'CONTACT_CLIENT',
    startInstructions: '',
    urgency: 'NORMAL',
    startsQuickly: false,
    clientName: '',
    clientContact: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchZaken()
  }, [statusFilter])

  const fetchZaken = async () => {
    setIsLoading(true)
    try {
      const url = statusFilter !== 'all'
        ? `/api/zaken?status=${statusFilter}`
        : '/api/zaken'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setZaken(data)
      }
    } catch (error) {
      console.error('Error fetching zaken:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.shortDescription) {
      toast.error('Beschrijving is verplicht')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/zaken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create zaak')
      }

      const data = await res.json()

      if (data.warning) {
        toast.error(data.warning)
      } else {
        toast.success('Zaak aangemaakt en aangeboden aan eerste medewerker!')
      }

      setShowForm(false)
      setForm({
        shortDescription: '',
        fullDescription: '',
        minimumExperienceYear: 1,
        startMethod: 'CONTACT_CLIENT',
        startInstructions: '',
        urgency: 'NORMAL',
        startsQuickly: false,
        clientName: '',
        clientContact: '',
      })
      fetchZaken()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kon zaak niet aanmaken')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      PENDING_ASSIGNMENT: { label: 'Wacht op start', color: 'text-gray-400', bg: 'bg-gray-500/10' },
      OFFERING: { label: 'Wordt aangeboden', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      ASSIGNED: { label: 'Toegewezen', color: 'text-green-400', bg: 'bg-green-500/10' },
      ALL_DECLINED: { label: 'Niemand beschikbaar', color: 'text-red-400', bg: 'bg-red-500/10' },
      CANCELLED: { label: 'Geannuleerd', color: 'text-gray-500', bg: 'bg-gray-500/10' },
    }
    return configs[status] || configs.PENDING_ASSIGNMENT
  }

  const getAssignmentStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: typeof Icons.check }> = {
      PENDING: { label: 'In wachtrij', icon: Icons.clock },
      OFFERED: { label: 'Aangeboden', icon: Icons.send },
      ACCEPTED: { label: 'Geaccepteerd', icon: Icons.check },
      DECLINED: { label: 'Afgewezen', icon: Icons.x },
      TIMEOUT: { label: 'Geen reactie', icon: Icons.clock },
      SKIPPED: { label: 'Overgeslagen', icon: Icons.minus },
    }
    return configs[status] || configs.PENDING
  }

  // Employee view - show their assigned zaken
  if (!isPartner) {
    const myZaken = zaken.filter(z => z.assignedTo)

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Mijn Zaken</h2>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center">
            <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin mx-auto" />
          </div>
        ) : myZaken.length === 0 ? (
          <div className="card p-8 text-center">
            <Icons.briefcase className="mx-auto text-gray-600 mb-3" size={40} />
            <p className="text-gray-400">Je hebt nog geen toegewezen zaken</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myZaken.map((zaak) => (
              <div key={zaak.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium text-white">{zaak.shortDescription}</h3>
                    {zaak.clientName && (
                      <p className="text-sm text-gray-400 mt-1">Klant: {zaak.clientName}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Van: {zaak.createdBy.name}</span>
                      <span className={`px-2 py-0.5 rounded ${URGENCY_CONFIG[zaak.urgency as keyof typeof URGENCY_CONFIG]?.bgColor} ${URGENCY_CONFIG[zaak.urgency as keyof typeof URGENCY_CONFIG]?.textColor}`}>
                        {URGENCY_CONFIG[zaak.urgency as keyof typeof URGENCY_CONFIG]?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Partner view - full management interface
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Zaken Toewijzing</h2>
          <p className="text-sm text-gray-400">Automatische werkverdeling op basis van werkdruk</p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Icons.plus size={16} />
          Nieuwe zaak
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'Alle' },
          { value: 'OFFERING', label: 'Wordt aangeboden' },
          { value: 'ASSIGNED', label: 'Toegewezen' },
          { value: 'ALL_DECLINED', label: 'Niemand beschikbaar' },
        ].map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              statusFilter === filter.value
                ? 'bg-workx-lime text-workx-dark font-medium'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* New Zaak Form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-white">Nieuwe zaak aanmaken</h3>
            <button
              onClick={() => setShowForm(false)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
            >
              <Icons.x size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-2">Beschrijving *</label>
                <input
                  type="text"
                  value={form.shortDescription}
                  onChange={(e) => setForm({ ...form, shortDescription: e.target.value })}
                  className="input-field"
                  placeholder="Korte beschrijving van de zaak"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-2">Extra details</label>
                <textarea
                  value={form.fullDescription}
                  onChange={(e) => setForm({ ...form, fullDescription: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="Optionele uitgebreide beschrijving..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Minimum ervaringsjaar *</label>
                <select
                  value={form.minimumExperienceYear}
                  onChange={(e) => setForm({ ...form, minimumExperienceYear: parseInt(e.target.value) })}
                  className="input-field"
                >
                  {Object.entries(EXPERIENCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Urgentie</label>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: e.target.value })}
                  className="input-field"
                >
                  {Object.entries(URGENCY_CONFIG).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Hoe te starten *</label>
                <select
                  value={form.startMethod}
                  onChange={(e) => setForm({ ...form, startMethod: e.target.value })}
                  className="input-field"
                >
                  {Object.entries(START_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.startsQuickly}
                    onChange={(e) => setForm({ ...form, startsQuickly: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-workx-lime focus:ring-workx-lime/50"
                  />
                  <span className="text-sm text-gray-400">Zaak gaat snel lopen</span>
                </label>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Klantnaam</label>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  className="input-field"
                  placeholder="Optioneel"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Klant contact</label>
                <input
                  type="text"
                  value={form.clientContact}
                  onChange={(e) => setForm({ ...form, clientContact: e.target.value })}
                  className="input-field"
                  placeholder="Telefoonnummer of email"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-2">Start instructies</label>
                <textarea
                  value={form.startInstructions}
                  onChange={(e) => setForm({ ...form, startInstructions: e.target.value })}
                  className="input-field"
                  placeholder="Extra instructies voor hoe de zaak op te starten..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                ) : (
                  <Icons.send size={16} />
                )}
                Zaak versturen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Zaken List */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <div className="w-8 h-8 border-2 border-workx-lime/30 border-t-workx-lime rounded-full animate-spin mx-auto" />
        </div>
      ) : zaken.length === 0 ? (
        <div className="card p-8 text-center">
          <Icons.briefcase className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-400">Geen zaken gevonden</p>
          <p className="text-gray-500 text-sm mt-1">Maak een nieuwe zaak aan om te beginnen</p>
        </div>
      ) : (
        <div className="space-y-3">
          {zaken.map((zaak) => {
            const statusConfig = getStatusConfig(zaak.status)
            const isExpanded = expandedZaak === zaak.id
            const currentOffer = zaak.assignmentQueue.find(a => a.status === 'OFFERED')

            return (
              <div key={zaak.id} className="card overflow-hidden">
                {/* Main row */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedZaak(isExpanded ? null : zaak.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-white truncate">{zaak.shortDescription}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        {zaak.clientName && <span>Klant: {zaak.clientName}</span>}
                        <span>Min: {EXPERIENCE_LABELS[zaak.minimumExperienceYear]}</span>
                        <span className={URGENCY_CONFIG[zaak.urgency as keyof typeof URGENCY_CONFIG]?.textColor}>
                          {URGENCY_CONFIG[zaak.urgency as keyof typeof URGENCY_CONFIG]?.label}
                        </span>
                        {zaak.startsQuickly && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Icons.zap size={12} /> Snel
                          </span>
                        )}
                      </div>

                      {zaak.status === 'ASSIGNED' && zaak.assignedTo && (
                        <p className="text-sm text-green-400 mt-2">
                          Toegewezen aan: {zaak.assignedTo.name}
                        </p>
                      )}

                      {zaak.status === 'OFFERING' && currentOffer && (
                        <p className="text-sm text-blue-400 mt-2">
                          Nu aangeboden aan: {currentOffer.user.name}
                        </p>
                      )}
                    </div>

                    <Icons.chevronDown
                      size={18}
                      className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-white/5">
                    {zaak.fullDescription && (
                      <p className="text-sm text-gray-400 mt-3 mb-4">{zaak.fullDescription}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-500">Aangemaakt door:</span>
                        <span className="text-white ml-2">{zaak.createdBy.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Start methode:</span>
                        <span className="text-white ml-2">
                          {START_METHOD_LABELS[zaak.startMethod as keyof typeof START_METHOD_LABELS]}
                        </span>
                      </div>
                      {zaak.clientContact && (
                        <div>
                          <span className="text-gray-500">Contact:</span>
                          <span className="text-white ml-2">{zaak.clientContact}</span>
                        </div>
                      )}
                    </div>

                    {/* Assignment queue */}
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-white mb-2">Toewijzing queue:</h4>
                      <div className="space-y-1">
                        {zaak.assignmentQueue.map((assignment) => {
                          const assignmentConfig = getAssignmentStatusConfig(assignment.status)
                          const Icon = assignmentConfig.icon

                          return (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500 w-5">{assignment.queuePosition}.</span>
                                <span className="text-white">{assignment.user.name}</span>
                                <span className="text-gray-500 text-xs">
                                  ({assignment.hoursWorkedBasis.toFixed(1)}u)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Icon size={14} className={
                                  assignment.status === 'ACCEPTED' ? 'text-green-400' :
                                  assignment.status === 'DECLINED' ? 'text-red-400' :
                                  assignment.status === 'OFFERED' ? 'text-blue-400' :
                                  assignment.status === 'TIMEOUT' ? 'text-amber-400' :
                                  'text-gray-500'
                                } />
                                <span className="text-gray-400 text-xs">{assignmentConfig.label}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {zaak.status === 'ALL_DECLINED' && (
                        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-sm text-red-400">
                            Alle medewerkers hebben afgewezen of niet gereageerd. Handmatige toewijzing vereist.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
