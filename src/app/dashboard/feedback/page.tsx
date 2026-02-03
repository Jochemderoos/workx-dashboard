'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import * as Popover from '@radix-ui/react-popover'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'

type FeedbackType = 'IDEA' | 'BUG'
type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX'

interface FeedbackItem {
  id: string
  type: FeedbackType
  title: string
  description: string
  submittedBy: string
  createdAt: string
  status: FeedbackStatus
  response?: string
  processed: boolean
}

export default function FeedbackPage() {
  const { data: session } = useSession()
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'IDEA' | 'BUG'>('ALL')
  const [form, setForm] = useState({
    type: 'IDEA' as FeedbackType,
    title: '',
    description: '',
  })

  // Check if user is partner (can toggle processed)
  const isPartner = session?.user?.role === 'PARTNER'

  // Fetch feedback from API
  useEffect(() => {
    fetchFeedback()
  }, [])

  const fetchFeedback = async () => {
    try {
      const res = await fetch('/api/feedback')
      if (res.ok) {
        const data = await res.json()
        setFeedback(data)
      }
    } catch (error) {
      console.error('Error fetching feedback:', error)
      toast.error('Kon feedback niet laden')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.description) {
      toast.error('Vul alle velden in')
      return
    }

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
        })
      })

      if (res.ok) {
        const newItem = await res.json()
        setFeedback([newItem, ...feedback])
        toast.success(form.type === 'IDEA' ? 'Idee ingediend!' : 'Probleem gemeld!')
        setForm({ type: 'IDEA', title: '', description: '' })
        setShowForm(false)
      } else {
        toast.error('Kon feedback niet opslaan')
      }
    } catch (error) {
      console.error('Error creating feedback:', error)
      toast.error('Er ging iets mis')
    }
  }

  const filteredFeedback = feedback.filter(f => filter === 'ALL' || f.type === filter)

  const getStatusBadge = (status: FeedbackStatus) => {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">Nieuw</span>
      case 'IN_PROGRESS':
        return <span className="px-2 py-1 text-xs rounded-full bg-orange-500/20 text-orange-400">In behandeling</span>
      case 'DONE':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">Afgerond</span>
      case 'WONT_FIX':
        return <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-gray-400">Niet opgepakt</span>
    }
  }

  const getTypeIcon = (type: FeedbackType) => {
    if (type === 'IDEA') {
      return (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-600/10 flex items-center justify-center">
          <Icons.sparkles className="text-purple-400" size={20} />
        </div>
      )
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/30 to-red-600/10 flex items-center justify-center">
        <Icons.alertCircle className="text-red-400" size={20} />
      </div>
    )
  }

  const ideasCount = feedback.filter(f => f.type === 'IDEA').length
  const bugsCount = feedback.filter(f => f.type === 'BUG').length
  const newCount = feedback.filter(f => f.status === 'NEW').length
  const processedCount = feedback.filter(f => f.processed).length

  const toggleProcessed = async (id: string, currentValue: boolean) => {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processed: !currentValue })
      })
      if (res.ok) {
        // Re-sort: move processed to bottom
        const updated = feedback.map(f => f.id === id ? { ...f, processed: !currentValue } : f)
        const sorted = [...updated].sort((a, b) => {
          if (a.processed !== b.processed) return a.processed ? 1 : -1
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        setFeedback(sorted)
        toast.success(!currentValue ? 'Gemarkeerd als verwerkt (wordt na 5 dagen verwijderd)' : 'Markering verwijderd')
      }
    } catch (error) {
      toast.error('Kon status niet wijzigen')
    }
  }

  const deleteFeedback = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze feedback wilt verwijderen?')) return
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setFeedback(feedback.filter(f => f.id !== id))
        toast.success('Feedback verwijderd')
      }
    } catch (error) {
      toast.error('Kon feedback niet verwijderen')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-2 border-workx-lime border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center">
              <Icons.chat className="text-indigo-400" size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white">Feedback & Ideeën</h1>
          </div>
          <p className="text-gray-400 text-sm sm:text-base hidden sm:block">Deel je ideeën of meld problemen met het dashboard</p>
        </div>
        <Popover.Root open={showForm} onOpenChange={setShowForm}>
          <Popover.Trigger asChild>
            <button
              className="btn-primary flex items-center gap-2 text-sm sm:text-base px-3 sm:px-4 py-2 sm:py-2.5 self-start sm:self-auto"
            >
              <Icons.plus size={14} className="sm:w-4 sm:h-4" />
              Nieuw
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="w-[90vw] max-w-md bg-workx-gray rounded-2xl border border-white/10 p-6 shadow-2xl max-h-[80vh] overflow-y-auto z-50 animate-modal-in"
              sideOffset={8}
              collisionPadding={16}
              side="bottom"
              align="end"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <Icons.chat className="text-indigo-400" size={18} />
                  </div>
                  <h2 className="font-semibold text-white text-lg">Feedback geven</h2>
                </div>
                <Popover.Close className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                  <Icons.x size={18} />
                </Popover.Close>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type selector */}
                <div>
                  <label className="block text-sm text-gray-400 mb-3">Wat wil je delen?</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'IDEA' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        form.type === 'IDEA'
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          form.type === 'IDEA' ? 'bg-purple-500/20' : 'bg-white/5'
                        }`}>
                          <Icons.sparkles className={form.type === 'IDEA' ? 'text-purple-400' : 'text-gray-400'} size={16} />
                        </div>
                        <span className={`font-medium ${form.type === 'IDEA' ? 'text-purple-400' : 'text-white'}`}>
                          Idee
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Een suggestie voor iets nieuws of een verbetering</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: 'BUG' })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        form.type === 'BUG'
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          form.type === 'BUG' ? 'bg-red-500/20' : 'bg-white/5'
                        }`}>
                          <Icons.alertCircle className={form.type === 'BUG' ? 'text-red-400' : 'text-gray-400'} size={16} />
                        </div>
                        <span className={`font-medium ${form.type === 'BUG' ? 'text-red-400' : 'text-white'}`}>
                          Probleem
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Iets werkt niet goed of is kapot</p>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    {form.type === 'IDEA' ? 'Wat is je idee?' : 'Wat werkt niet?'} *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="input-field"
                    placeholder={form.type === 'IDEA' ? 'Bijv. "Export naar Excel toevoegen"' : 'Bijv. "Kalender laadt niet"'}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Beschrijving *</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input-field min-h-[100px] resize-none"
                    placeholder={form.type === 'IDEA'
                      ? 'Beschrijf je idee. Waarom zou dit handig zijn?'
                      : 'Beschrijf wat er mis gaat. Wanneer gebeurt dit? Welke stappen heb je genomen?'
                    }
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Popover.Close className="flex-1 btn-secondary">
                    Annuleren
                  </Popover.Close>
                  <button
                    type="submit"
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                      form.type === 'IDEA'
                        ? 'bg-purple-500 hover:bg-purple-600 text-white'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {form.type === 'IDEA' ? <Icons.sparkles size={16} /> : <Icons.alertCircle size={16} />}
                    {form.type === 'IDEA' ? 'Idee indienen' : 'Probleem melden'}
                  </button>
                </div>
              </form>
              <Popover.Arrow className="fill-workx-gray" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card p-3 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.sparkles className="text-purple-400" size={16} />
            </div>
            <p className="text-xl sm:text-3xl font-semibold text-white">{ideasCount}</p>
            <p className="text-xs sm:text-sm text-gray-400">Ideeën</p>
          </div>
        </div>

        <div className="card p-3 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.alertCircle className="text-red-400" size={16} />
            </div>
            <p className="text-xl sm:text-3xl font-semibold text-white">{bugsCount}</p>
            <p className="text-xs sm:text-sm text-gray-400">Problemen</p>
          </div>
        </div>

        <div className="card p-3 sm:p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
          <div className="relative">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 sm:mb-3">
              <Icons.bell className="text-blue-400" size={16} />
            </div>
            <p className="text-xl sm:text-3xl font-semibold text-white">{newCount}</p>
            <p className="text-xs sm:text-sm text-gray-400">Open</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { id: 'ALL' as const, label: 'Alles', count: feedback.length },
          { id: 'IDEA' as const, label: 'Ideeën', count: ideasCount, icon: Icons.sparkles, color: 'purple' },
          { id: 'BUG' as const, label: 'Problemen', count: bugsCount, icon: Icons.alertCircle, color: 'red' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              filter === f.id
                ? 'bg-workx-lime text-workx-dark'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f.icon && <f.icon size={16} />}
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              filter === f.id ? 'bg-workx-dark/20' : 'bg-white/10'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Feedback List */}
      <div className="space-y-3">
        {filteredFeedback.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Icons.chat className="text-white/20" size={28} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nog geen feedback</h3>
            <p className="text-gray-400 mb-6">Wees de eerste die een idee deelt of probleem meldt!</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Icons.plus size={16} className="mr-2" />
              Feedback geven
            </button>
          </div>
        ) : (
          filteredFeedback.map((item) => (
            <div
              key={item.id}
              className={`card p-5 border-l-4 ${
                item.type === 'IDEA' ? 'border-l-purple-500' : 'border-l-red-500'
              } ${item.processed ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox and delete for partners */}
                {isPartner && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleProcessed(item.id, item.processed)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        item.processed
                          ? 'bg-workx-lime border-workx-lime'
                          : 'border-white/30 hover:border-workx-lime/50'
                      }`}
                      title={item.processed ? 'Als onverwerkt markeren' : 'Als verwerkt markeren'}
                    >
                      {item.processed && <Icons.check size={14} className="text-workx-dark" />}
                    </button>
                    <button
                      onClick={() => deleteFeedback(item.id)}
                      className="w-6 h-6 rounded-lg border-2 border-white/20 flex items-center justify-center hover:border-red-400/50 hover:bg-red-500/10 transition-all"
                      title="Verwijderen"
                    >
                      <Icons.trash size={12} className="text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                )}
                {getTypeIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${item.processed ? 'text-white/60 line-through' : 'text-white'}`}>{item.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.type === 'IDEA'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {item.type === 'IDEA' ? 'Idee' : 'Probleem'}
                        </span>
                        {getStatusBadge(item.status)}
                        {item.processed && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-workx-lime/20 text-workx-lime">
                            Verwerkt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Door {item.submittedBy} op {new Date(item.createdAt).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{item.description}</p>

                  {item.response && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Icons.chat size={12} className="text-workx-lime" />
                        <span className="text-xs text-workx-lime font-medium">Reactie</span>
                      </div>
                      <p className="text-sm text-gray-400">{item.response}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info */}
      <div className="card p-5 border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
            <Icons.info className="text-indigo-400" size={18} />
          </div>
          <div>
            <h3 className="font-medium text-white mb-1">Hoe werkt dit?</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              <strong className="text-purple-400">Ideeën</strong> zijn suggesties voor nieuwe functies of verbeteringen.
              <br />
              <strong className="text-red-400">Problemen</strong> zijn bugs of dingen die niet goed werken.
              <br /><br />
              Je feedback wordt bekeken en waar mogelijk direct opgepakt. Je ziet de status en eventuele reacties hier.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
