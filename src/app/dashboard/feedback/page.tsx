'use client'

import { useState, useEffect } from 'react'
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
  submittedAt: string
  status: FeedbackStatus
  response?: string
}

// Start met lege feedback lijst - data wordt opgeslagen in localStorage
const INITIAL_FEEDBACK: FeedbackItem[] = []

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>(INITIAL_FEEDBACK)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'ALL' | 'IDEA' | 'BUG'>('ALL')
  const [form, setForm] = useState({
    type: 'IDEA' as FeedbackType,
    title: '',
    description: '',
    submittedBy: '',
  })

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_feedback')
    if (saved) {
      setFeedback(JSON.parse(saved))
    }
  }, [])

  // Save to localStorage
  const saveFeedback = (items: FeedbackItem[]) => {
    localStorage.setItem('dashboard_feedback', JSON.stringify(items))
    setFeedback(items)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.description || !form.submittedBy) {
      toast.error('Vul alle velden in')
      return
    }

    const newItem: FeedbackItem = {
      id: Date.now().toString(),
      type: form.type,
      title: form.title,
      description: form.description,
      submittedBy: form.submittedBy,
      submittedAt: new Date().toISOString(),
      status: 'NEW',
    }

    saveFeedback([newItem, ...feedback])
    toast.success(form.type === 'IDEA' ? 'Idee ingediend!' : 'Probleem gemeld!')
    setForm({ type: 'IDEA', title: '', description: '', submittedBy: '' })
    setShowForm(false)
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
        return <span className="px-2 py-1 text-xs rounded-full bg-white/10 text-white/50">Niet opgepakt</span>
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/10 flex items-center justify-center">
              <Icons.chat className="text-indigo-400" size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-white">Feedback & Ideeën</h1>
          </div>
          <p className="text-white/40">Deel je ideeën of meld problemen met het dashboard</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Icons.plus size={16} />
          Nieuw
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-purple-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-3">
              <Icons.sparkles className="text-purple-400" size={18} />
            </div>
            <p className="text-3xl font-semibold text-white">{ideasCount}</p>
            <p className="text-sm text-white/40">Ideeën</p>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-red-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
              <Icons.alertCircle className="text-red-400" size={18} />
            </div>
            <p className="text-3xl font-semibold text-white">{bugsCount}</p>
            <p className="text-sm text-white/40">Problemen</p>
          </div>
        </div>

        <div className="card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/10 transition-colors" />
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
              <Icons.bell className="text-blue-400" size={18} />
            </div>
            <p className="text-3xl font-semibold text-white">{newCount}</p>
            <p className="text-sm text-white/40">Nieuw / Open</p>
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
                : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
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
            <p className="text-white/40 mb-6">Wees de eerste die een idee deelt of probleem meldt!</p>
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
              }`}
            >
              <div className="flex items-start gap-4">
                {getTypeIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-white">{item.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.type === 'IDEA'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {item.type === 'IDEA' ? 'Idee' : 'Probleem'}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        Door {item.submittedBy} op {new Date(item.submittedAt).toLocaleDateString('nl-NL', {
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
                      <p className="text-sm text-white/60">{item.response}</p>
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
            <p className="text-sm text-white/50 leading-relaxed">
              <strong className="text-purple-400">Ideeën</strong> zijn suggesties voor nieuwe functies of verbeteringen.
              <br />
              <strong className="text-red-400">Problemen</strong> zijn bugs of dingen die niet goed werken.
              <br /><br />
              Je feedback wordt bekeken en waar mogelijk direct opgepakt. Je ziet de status en eventuele reacties hier.
            </p>
          </div>
        </div>
      </div>

      {/* Submit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-workx-gray rounded-2xl p-6 w-full max-w-lg border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Icons.chat className="text-indigo-400" size={18} />
                </div>
                <h2 className="font-semibold text-white text-lg">Feedback geven</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
                <Icons.x size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block text-sm text-white/60 mb-3">Wat wil je delen?</label>
                <div className="grid grid-cols-2 gap-3">
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
                        <Icons.sparkles className={form.type === 'IDEA' ? 'text-purple-400' : 'text-white/40'} size={16} />
                      </div>
                      <span className={`font-medium ${form.type === 'IDEA' ? 'text-purple-400' : 'text-white'}`}>
                        Idee
                      </span>
                    </div>
                    <p className="text-xs text-white/40">Een suggestie voor iets nieuws of een verbetering</p>
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
                        <Icons.alertCircle className={form.type === 'BUG' ? 'text-red-400' : 'text-white/40'} size={16} />
                      </div>
                      <span className={`font-medium ${form.type === 'BUG' ? 'text-red-400' : 'text-white'}`}>
                        Probleem
                      </span>
                    </div>
                    <p className="text-xs text-white/40">Iets werkt niet goed of is kapot</p>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-white/60 mb-2">
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
                <label className="block text-sm text-white/60 mb-2">Beschrijving *</label>
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

              {/* Name */}
              <div>
                <label className="block text-sm text-white/60 mb-2">Je naam *</label>
                <input
                  type="text"
                  value={form.submittedBy}
                  onChange={(e) => setForm({ ...form, submittedBy: e.target.value })}
                  className="input-field"
                  placeholder="Bijv. Kay Maes"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 btn-secondary">
                  Annuleren
                </button>
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
          </div>
        </div>
      )}
    </div>
  )
}
