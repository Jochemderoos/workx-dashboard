'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'
import toast from 'react-hot-toast'
import { jsPDF } from 'jspdf'
import { loadWorkxLogo, drawWorkxLogo } from '@/lib/pdf'
import DatePicker from '@/components/ui/DatePicker'

interface TeamUser {
  id: string
  name: string
  role: string
}

interface Task {
  id: string
  title: string
  description: string | null
  deadline: string | null
  priority: string
  status: string
  assignedBy: string
  completedAt: string | null
  feedbackScore: string | null
  feedbackNote: string | null
  createdAt: string
  assigner: { id: string; name: string }
}

interface StageverklaringAssignment {
  id: string
  title: string
  description: string
  feedbackScore: string
  feedbackNote: string
}

interface StageverklaringData {
  internName: string
  periodStart: string
  periodEnd: string
  department: string
  assignments: StageverklaringAssignment[]
  overallGrade: string
  evaluation: string
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; sort: number }> = {
  urgent: { label: 'Urgent', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30', sort: 0 },
  hoog: { label: 'Hoog', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', sort: 1 },
  normaal: { label: 'Normaal', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', sort: 2 },
  laag: { label: 'Laag', color: 'text-gray-400', bg: 'bg-gray-500/15', border: 'border-gray-500/30', sort: 3 },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Icons.check }> = {
  open: { label: 'Open', color: 'text-blue-400', bg: 'bg-blue-500/15', icon: Icons.circle },
  bezig: { label: 'Bezig', color: 'text-amber-400', bg: 'bg-amber-500/15', icon: Icons.clock },
  klaar: { label: 'Klaar', color: 'text-emerald-400', bg: 'bg-emerald-500/15', icon: Icons.check },
}

const FEEDBACK_OPTIONS = [
  { value: 'matig', label: 'Matig', color: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/30' },
  { value: 'voldoende', label: 'Voldoende', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30' },
  { value: 'goed', label: 'Goed', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30' },
  { value: 'uitstekend', label: 'Uitstekend', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30' },
]

export default function WerkstudentPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedbackTaskId, setFeedbackTaskId] = useState<string | null>(null)
  const [feedbackForm, setFeedbackForm] = useState({ score: '', note: '' })
  const [savingFeedback, setSavingFeedback] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' })
  const [showStageverklaring, setShowStageverklaring] = useState(false)
  const [stageverklaring, setStageverklaring] = useState<StageverklaringData | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const [taskRes, teamRes] = await Promise.all([
        fetch('/api/werkstudent'),
        fetch('/api/claude/users'),
      ])
      if (taskRes.ok) setTasks(await taskRes.json())
      if (teamRes.ok) {
        const users = await teamRes.json()
        setTeamUsers(users.filter((u: TeamUser) => u.role !== 'EXTERNAL'))
      }
    } catch {
      toast.error('Kon opdrachten niet laden')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || saving) return

    setSaving(true)
    try {
      const payload = { ...form, deadline: form.deadline || null, assignerId: form.assignerId || undefined }
      const res = editingTask
        ? await fetch('/api/werkstudent', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingTask.id, ...payload }),
          })
        : await fetch('/api/werkstudent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Onbekende fout')
      }

      toast.success(editingTask ? 'Opdracht bijgewerkt' : 'Opdracht aangemaakt')
      setForm({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' })
      setShowForm(false)
      setEditingTask(null)
      fetchTasks()
    } catch (err: any) {
      toast.error(err?.message || 'Kon opdracht niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'open' ? 'bezig' : task.status === 'bezig' ? 'klaar' : 'open'
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t))
    try {
      const res = await fetch('/api/werkstudent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      })
      if (!res.ok) throw new Error()
      fetchTasks()
      if (nextStatus === 'klaar') toast.success('Opdracht afgerond!')
    } catch {
      toast.error('Kon status niet bijwerken')
      fetchTasks() // Revert
    }
  }

  const deleteTask = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze opdracht wilt verwijderen?')) return
    try {
      await fetch(`/api/werkstudent?id=${id}`, { method: 'DELETE' })
      toast.success('Opdracht verwijderd')
      fetchTasks()
    } catch {
      toast.error('Kon opdracht niet verwijderen')
    }
  }

  const startEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      deadline: task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '',
      priority: task.priority,
      assignerId: task.assignedBy,
    })
    setShowForm(true)
  }

  const openFeedback = (task: Task) => {
    setFeedbackTaskId(task.id)
    setFeedbackForm({ score: task.feedbackScore || '', note: task.feedbackNote || '' })
  }

  const saveFeedback = async () => {
    if (!feedbackTaskId || savingFeedback) return
    setSavingFeedback(true)
    try {
      const res = await fetch('/api/werkstudent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: feedbackTaskId, feedbackScore: feedbackForm.score, feedbackNote: feedbackForm.note }),
      })
      if (!res.ok) throw new Error()
      toast.success('Feedback opgeslagen')
      setFeedbackTaskId(null)
      fetchTasks()
    } catch {
      toast.error('Kon feedback niet opslaan')
    } finally {
      setSavingFeedback(false)
    }
  }

  // === Stageverklaring functions ===
  const openStageverklaring = () => {
    // Alle taken inladen (niet alleen klaar) — user kan verwijderen wat niet relevant is
    const assignments: StageverklaringAssignment[] = tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description || '',
      feedbackScore: t.feedbackScore || '',
      feedbackNote: t.feedbackNote || '',
    }))
    const startDates = tasks.map(t => new Date(t.createdAt).getTime())
    const endDates = tasks.filter(t => t.completedAt).map(t => new Date(t.completedAt!).getTime())
    setStageverklaring({
      internName: '',
      periodStart: startDates.length ? new Date(Math.min(...startDates)).toISOString().split('T')[0] : '',
      periodEnd: endDates.length ? new Date(Math.max(...endDates)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      department: 'Arbeidsrecht',
      assignments,
      overallGrade: '',
      evaluation: '',
    })
    setShowStageverklaring(true)
  }

  const updateSVField = (field: keyof StageverklaringData, value: string) => {
    setStageverklaring(prev => prev ? { ...prev, [field]: value } : prev)
  }

  const updateSVAssignment = (id: string, field: keyof StageverklaringAssignment, value: string) => {
    setStageverklaring(prev => prev ? {
      ...prev,
      assignments: prev.assignments.map(a => a.id === id ? { ...a, [field]: value } : a)
    } : prev)
  }

  const removeSVAssignment = (id: string) => {
    setStageverklaring(prev => prev ? {
      ...prev,
      assignments: prev.assignments.filter(a => a.id !== id)
    } : prev)
  }

  const addSVAssignment = () => {
    setStageverklaring(prev => prev ? {
      ...prev,
      assignments: [...prev.assignments, {
        id: Date.now().toString(),
        title: '',
        description: '',
        feedbackScore: '',
        feedbackNote: '',
      }]
    } : prev)
  }

  const downloadStageverklaringPDF = async () => {
    if (!stageverklaring) return
    const sv = stageverklaring
    const logoDataUrl = await loadWorkxLogo()
    const doc = new jsPDF()
    const pw = doc.internal.pageSize.getWidth()
    const ph = doc.internal.pageSize.getHeight()
    const m = 20
    const cw = pw - m * 2

    const drawFooter = () => {
      doc.setFillColor(80, 80, 80)
      doc.rect(0, ph - 14, pw, 12, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Workx advocaten  \u2022  Herengracht 448, 1017 CA Amsterdam  \u2022  +31 (0)20 308 03 20  \u2022  info@workxadvocaten.nl', pw / 2, ph - 7, { align: 'center' })
    }

    let y = 0
    const needPage = (needed: number) => {
      if (y + needed > ph - 25) { doc.addPage(); y = 20 }
    }

    // Header
    drawWorkxLogo(doc, 0, 0, 55, logoDataUrl)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120); doc.text('Datum:', 60, 10)
    doc.setTextColor(40, 40, 40); doc.text(new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }), 95, 10)
    doc.setTextColor(120, 120, 120); doc.text('Betreft:', 60, 17)
    doc.setTextColor(40, 40, 40); doc.text(sv.internName || 'Stagiair(e)', 95, 17)
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.4); doc.line(m, 48, pw - m, 48)

    // Title
    y = 65
    doc.setTextColor(100, 100, 100); doc.setFontSize(11); doc.setFont('helvetica', 'normal')
    doc.text('VERKLARING', m, y)
    doc.setTextColor(35, 35, 35); doc.setFontSize(22); doc.setFont('helvetica', 'bold')
    doc.text('STAGEVERKLARING', m, y + 10)

    // Personal info box
    y = 95
    doc.setFillColor(250, 250, 250); doc.roundedRect(m, y - 5, cw, 30, 3, 3, 'F')
    const c1 = m + 8, c2 = m + 65, c3 = m + 125
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100); doc.text('Stagiair(e)', c1, y + 3)
    doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'bold'); doc.text(sv.internName || '-', c1, y + 11)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.text('Stageperiode', c2, y + 3)
    doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'bold')
    const fmtD = (d: string) => d ? new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
    doc.text(`${fmtD(sv.periodStart)} t/m ${fmtD(sv.periodEnd)}`, c2, y + 11)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 100, 100); doc.text('Afdeling', c3, y + 3)
    doc.setTextColor(35, 35, 35); doc.setFont('helvetica', 'bold'); doc.text(sv.department || '-', c3, y + 11)
    // Intro text
    y += 35
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(50, 50, 50)
    const introText = `Hierbij verklaart Workx advocaten dat ${sv.internName || '[naam]'} in de periode ${fmtD(sv.periodStart)} tot en met ${fmtD(sv.periodEnd)} stage heeft gelopen bij de afdeling ${sv.department || '[afdeling]'} van ons kantoor. Gedurende de stage zijn de volgende werkzaamheden uitgevoerd:`
    const introLines = doc.splitTextToSize(introText, cw)
    doc.text(introLines, m, y)
    y += introLines.length * 5 + 8

    // Assignments
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(35, 35, 35)
    doc.text('Uitgevoerde werkzaamheden', m, y); y += 10

    const fbColors: Record<string, [number, number, number]> = {
      matig: [200, 50, 50], voldoende: [200, 120, 0], goed: [59, 130, 246], uitstekend: [16, 185, 129]
    }
    const fbLabels: Record<string, string> = { matig: 'Matig', voldoende: 'Voldoende', goed: 'Goed', uitstekend: 'Uitstekend' }

    sv.assignments.forEach((a, i) => {
      needPage(40)
      // Number + title
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(35, 35, 35)
      doc.text(`${i + 1}. ${a.title || 'Opdracht'}`, m, y); y += 6
      // Description
      if (a.description) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
        const descLines = doc.splitTextToSize(a.description, cw - 10)
        needPage(descLines.length * 4.5)
        doc.text(descLines, m + 5, y); y += descLines.length * 4.5 + 2
      }
      // Feedback
      if (a.feedbackScore) {
        const col = fbColors[a.feedbackScore] || [100, 100, 100]
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
        doc.setTextColor(col[0], col[1], col[2])
        doc.text(`Beoordeling: ${fbLabels[a.feedbackScore] || a.feedbackScore}`, m + 5, y); y += 5
      }
      if (a.feedbackNote) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
        const noteLines = doc.splitTextToSize(`"${a.feedbackNote}"`, cw - 10)
        needPage(noteLines.length * 4.5)
        doc.text(noteLines, m + 5, y); y += noteLines.length * 4.5 + 2
      }
      y += 4
      // Separator
      if (i < sv.assignments.length - 1) {
        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); doc.line(m, y, pw - m, y); y += 6
      }
    })

    // Overall grade
    if (sv.overallGrade) {
      y += 6; needPage(30)
      doc.setFillColor(249, 255, 133); doc.roundedRect(m, y, cw, 20, 4, 4, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(35, 35, 35)
      doc.text('Eindcijfer', m + 12, y + 13)
      doc.setFontSize(18); doc.text(sv.overallGrade, pw - m - 12, y + 14, { align: 'right' })
      y += 28
    }

    // Evaluation
    if (sv.evaluation) {
      y += 6; needPage(20)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(35, 35, 35)
      doc.text('Algemene beoordeling', m, y); y += 7
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60, 60, 60)
      const evalLines = doc.splitTextToSize(sv.evaluation, cw)
      needPage(evalLines.length * 5)
      doc.text(evalLines, m, y); y += evalLines.length * 5 + 10
    }

    // Signature area
    y += 10; needPage(40)
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(m, y, pw - m, y); y += 15
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100)
    doc.text('Namens Workx advocaten,', m, y); y += 15
    doc.setDrawColor(180, 180, 180); doc.line(m, y, m + 60, y)
    doc.setFontSize(8); doc.text('Naam / Handtekening', m, y + 5)
    doc.line(m + 80, y, m + 140, y); doc.text('Datum', m + 80, y + 5)

    // Footers
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) { doc.setPage(i); drawFooter() }

    const pdfBlob = doc.output('blob')
    const url = URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Stageverklaring_${sv.internName.replace(/\s+/g, '_') || 'stagiair'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Stageverklaring PDF gedownload')
  }

  const activeTasks = tasks.filter(t => t.status !== 'klaar')
  const completedTasks = tasks.filter(t => t.status === 'klaar')

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
  }

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false
    return new Date(deadline) < new Date()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: '#f9ff85' }} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Werkstudent
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
            Opdrachten en taken voor de werkstudent
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openStageverklaring}
            className="btn-secondary flex items-center gap-2"
          >
            <Icons.fileText size={16} />
            Stageverklaring
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingTask(null); setForm({ title: '', description: '', deadline: '', priority: 'normaal', assignerId: '' }) }}
            className="btn-primary flex items-center gap-2"
          >
            <Icons.plus size={16} />
            Nieuwe opdracht
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totaal', value: tasks.length, color: 'text-blue-400', bg: 'from-blue-500/10 to-cyan-500/10' },
          { label: 'Open', value: activeTasks.filter(t => t.status === 'open').length, color: 'text-blue-400', bg: 'from-blue-500/10 to-blue-500/5' },
          { label: 'Bezig', value: activeTasks.filter(t => t.status === 'bezig').length, color: 'text-amber-400', bg: 'from-amber-500/10 to-orange-500/5' },
          { label: 'Afgerond', value: completedTasks.length, color: 'text-emerald-400', bg: 'from-emerald-500/10 to-green-500/5' },
        ].map(stat => (
          <div key={stat.label} className="card p-4">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-text-tertiary)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4" style={{ paddingTop: '2vh' }} onClick={() => { if (!saving) { setShowForm(false); setEditingTask(null) } }}>
          <div className="w-full max-w-2xl card flex flex-col" style={{ maxHeight: 'calc(100vh - 4vh - 16px)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {editingTask ? 'Opdracht bewerken' : 'Nieuwe opdracht'}
              </h2>
              <button onClick={() => { if (!saving) { setShowForm(false); setEditingTask(null) } }} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <Icons.x size={18} className="text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Titel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="input-field"
                  placeholder="Bijv. CAO inventarisatie"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Beschrijving</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Wat moet er precies gebeuren?"
                />
              </div>
              {/* Opdrachtgever */}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Opdrachtgever</label>
                <div className="flex flex-wrap gap-2">
                  {teamUsers.map(u => {
                    const photo = getPhotoUrl(u.name)
                    const isSelected = form.assignerId === u.id
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, assignerId: f.assignerId === u.id ? '' : u.id }))}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          isSelected
                            ? 'bg-workx-lime/15 text-workx-lime border-workx-lime/30'
                            : 'border-transparent hover:border-white/10'
                        }`}
                        style={{
                          background: isSelected ? undefined : 'var(--color-bg-tertiary)',
                          color: isSelected ? undefined : 'var(--color-text-tertiary)',
                        }}
                      >
                        {photo ? (
                          <Image src={photo} alt={u.name} width={20} height={20} className="w-5 h-5 rounded-lg object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-[9px] font-medium text-white">{u.name.charAt(0)}</span>
                          </div>
                        )}
                        {u.name.split(' ')[0]}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Leeg = jijzelf als opdrachtgever</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Deadline</label>
                  <DatePicker
                    selected={form.deadline ? new Date(form.deadline) : null}
                    onChange={(date) => setForm({ ...form, deadline: date ? date.toISOString().split('T')[0] : '' })}
                    placeholder="Selecteer deadline..."
                    isClearable
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Prioriteit</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm({ ...form, priority: key })}
                        className={`px-3 py-2.5 rounded-xl text-xs font-medium transition-all border flex-1 ${
                          form.priority === key
                            ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                            : 'border-transparent'
                        }`}
                        style={form.priority !== key ? { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' } : undefined}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || !form.title.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />
                  ) : null}
                  {editingTask ? 'Opslaan' : 'Toevoegen'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingTask(null) }} disabled={saving} className="btn-secondary flex-1 disabled:opacity-50">
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackTaskId && (() => {
        const task = tasks.find(t => t.id === feedbackTaskId)
        if (!task) return null
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setFeedbackTaskId(null)}>
            <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Feedback</h2>
                <button onClick={() => setFeedbackTaskId(null)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <Icons.x size={18} className="text-gray-400" />
                </button>
              </div>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
                {task.title}
              </p>

              {/* Score buttons */}
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>Beoordeling</label>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {FEEDBACK_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFeedbackForm(f => ({ ...f, score: f.score === opt.value ? '' : opt.value }))}
                    className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all border text-center ${
                      feedbackForm.score === opt.value
                        ? `${opt.bg} ${opt.color} ${opt.border}`
                        : 'border-transparent'
                    }`}
                    style={feedbackForm.score !== opt.value ? { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' } : undefined}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Note */}
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>Toelichting</label>
              <textarea
                value={feedbackForm.note}
                onChange={e => setFeedbackForm(f => ({ ...f, note: e.target.value }))}
                className="input-field mb-4"
                rows={3}
                placeholder="Wat ging goed? Wat kan beter?"
              />

              <div className="flex gap-3">
                <button
                  onClick={saveFeedback}
                  disabled={savingFeedback}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {savingFeedback && <span className="w-4 h-4 border-2 border-workx-dark/30 border-t-workx-dark rounded-full animate-spin" />}
                  Opslaan
                </button>
                <button onClick={() => setFeedbackTaskId(null)} className="btn-secondary flex-1">
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Stageverklaring Modal */}
      {showStageverklaring && stageverklaring && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4" style={{ paddingTop: '2vh' }} onClick={() => setShowStageverklaring(false)}>
          <div className="w-full max-w-3xl card flex flex-col" style={{ maxHeight: 'calc(100vh - 4vh - 16px)' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>Stageverklaring</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>Pas alle velden aan en download als PDF</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadStageverklaringPDF} className="btn-primary flex items-center gap-2 text-sm">
                  <Icons.download size={14} />
                  Download PDF
                </button>
                <button onClick={() => setShowStageverklaring(false)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Icons.x size={18} className="text-gray-400" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Personal details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Naam stagiair(e)</label>
                  <input
                    type="text"
                    value={stageverklaring.internName}
                    onChange={e => updateSVField('internName', e.target.value)}
                    className="input-field !py-2.5 text-sm"
                    placeholder="Volledige naam"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Afdeling</label>
                  <input
                    type="text"
                    value={stageverklaring.department}
                    onChange={e => updateSVField('department', e.target.value)}
                    className="input-field !py-2.5 text-sm"
                    placeholder="Bijv. Arbeidsrecht"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Startdatum stage</label>
                  <input
                    type="date"
                    value={stageverklaring.periodStart}
                    onChange={e => updateSVField('periodStart', e.target.value)}
                    className="input-field !py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Einddatum stage</label>
                  <input
                    type="date"
                    value={stageverklaring.periodEnd}
                    onChange={e => updateSVField('periodEnd', e.target.value)}
                    className="input-field !py-2.5 text-sm"
                  />
                </div>
              </div>

              {/* Assignments */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Werkzaamheden</h3>
                  <button onClick={addSVAssignment} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl bg-workx-lime/10 text-workx-lime hover:bg-workx-lime/20 transition-colors">
                    <Icons.plus size={12} />
                    Toevoegen
                  </button>
                </div>

                {stageverklaring.assignments.length === 0 && (
                  <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--color-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>Geen opdrachten. Voeg handmatig opdrachten toe.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {stageverklaring.assignments.map((a, i) => {
                    const fb = a.feedbackScore ? FEEDBACK_OPTIONS.find(o => o.value === a.feedbackScore) : null
                    return (
                      <div key={a.id} className="card p-4 relative group">
                        <button
                          onClick={() => removeSVAssignment(a.id)}
                          className="absolute top-3 right-3 z-10 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors flex items-center gap-1 text-xs font-medium"
                          title="Verwijderen"
                        >
                          <Icons.x size={12} />
                          Verwijderen
                        </button>

                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' }}>
                            {i + 1}
                          </span>
                          <input
                            type="text"
                            value={a.title}
                            onChange={e => updateSVAssignment(a.id, 'title', e.target.value)}
                            className="input-field !py-1.5 !px-3 text-sm font-medium flex-1"
                            placeholder="Naam opdracht"
                          />
                        </div>

                        <textarea
                          value={a.description}
                          onChange={e => updateSVAssignment(a.id, 'description', e.target.value)}
                          className="input-field !py-2 !px-3 text-sm mb-2"
                          rows={2}
                          placeholder="Beschrijving van de werkzaamheden..."
                        />

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>Beoordeling:</span>
                          {FEEDBACK_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => updateSVAssignment(a.id, 'feedbackScore', a.feedbackScore === opt.value ? '' : opt.value)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                                a.feedbackScore === opt.value
                                  ? `${opt.bg} ${opt.color} ${opt.border}`
                                  : 'border-transparent'
                              }`}
                              style={a.feedbackScore !== opt.value ? { background: 'var(--color-bg-tertiary)', color: 'var(--color-text-tertiary)' } : undefined}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {(a.feedbackScore || a.feedbackNote) && (
                          <input
                            type="text"
                            value={a.feedbackNote}
                            onChange={e => updateSVAssignment(a.id, 'feedbackNote', e.target.value)}
                            className="input-field !py-1.5 !px-3 text-xs mt-2 italic"
                            placeholder="Toelichting bij beoordeling..."
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Overall grade */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Eindcijfer (optioneel)</label>
                <input
                  type="text"
                  value={stageverklaring.overallGrade}
                  onChange={e => updateSVField('overallGrade', e.target.value)}
                  className="input-field !py-2.5 text-sm w-32"
                  placeholder="Bijv. 7.5"
                />
              </div>

              {/* Evaluation */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-tertiary)' }}>Algemene beoordeling / toelichting</label>
                <textarea
                  value={stageverklaring.evaluation}
                  onChange={e => updateSVField('evaluation', e.target.value)}
                  className="input-field text-sm"
                  rows={4}
                  placeholder="Beschrijf de algehele indruk, ontwikkeling en aanbevelingen..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Tasks */}
      {activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Icons.clipboard className="text-cyan-400" size={28} />
          </div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Nog geen opdrachten
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Klik op &quot;Nieuwe opdracht&quot; om een taak voor de werkstudent aan te maken.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeTasks
            .sort((a, b) => (PRIORITY_CONFIG[a.priority]?.sort ?? 2) - (PRIORITY_CONFIG[b.priority]?.sort ?? 2))
            .map(task => {
              const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normaal
              const stat = STATUS_CONFIG[task.status] || STATUS_CONFIG.open
              const StatusIcon = stat.icon
              const overdue = task.status !== 'klaar' && isOverdue(task.deadline)
              const fb = task.feedbackScore ? FEEDBACK_OPTIONS.find(o => o.value === task.feedbackScore) : null

              return (
                <div key={task.id} className="card group hover:scale-[1.005] transition-all duration-200">
                  <div className="flex items-start gap-4 p-4 sm:p-5">
                    {/* Status toggle */}
                    <button
                      onClick={() => toggleStatus(task)}
                      className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${stat.bg} hover:scale-110`}
                      title={`Status: ${stat.label} → klik om te wijzigen`}
                    >
                      <StatusIcon size={15} className={stat.color} />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`font-medium ${task.status === 'klaar' ? 'line-through opacity-50' : ''}`} style={{ color: 'var(--color-text-primary)' }}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${pri.bg} ${pri.color} ${pri.border}`}>
                          {pri.label}
                        </span>
                        {fb && (
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${fb.bg} ${fb.color}`}>
                            {fb.label}
                          </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {task.description}
                        </p>
                      )}
                      {task.feedbackNote && (
                        <div className="mt-2 px-3 py-2 rounded-xl text-xs italic" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>
                          &quot;{task.feedbackNote}&quot;
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2.5 text-xs flex-wrap" style={{ color: 'var(--color-text-tertiary)' }}>
                        {(() => {
                          const photo = getPhotoUrl(task.assigner.name)
                          return (
                            <span className="flex items-center gap-1.5">
                              {photo ? (
                                <Image src={photo} alt={task.assigner.name} width={20} height={20} className="w-5 h-5 rounded-lg object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                  <span className="text-[9px] font-medium text-white">{task.assigner.name.charAt(0)}</span>
                                </div>
                              )}
                              <span style={{ color: 'var(--color-text-secondary)' }}>{task.assigner.name.split(' ')[0]}</span>
                            </span>
                          )
                        })()}
                        {task.deadline && (
                          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg ${overdue ? 'bg-red-500/10 text-red-400 font-medium' : ''}`} style={!overdue ? { background: 'var(--color-bg-tertiary)' } : undefined}>
                            <Icons.calendar size={12} />
                            {formatDate(task.deadline)}
                            {overdue && ' (verlopen)'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openFeedback(task)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                          task.feedbackScore
                            ? 'bg-workx-lime/15 text-workx-lime border border-workx-lime/30'
                            : 'hover:bg-white/10 border border-dashed border-white/20'
                        }`}
                        style={!task.feedbackScore ? { color: 'var(--color-text-tertiary)' } : undefined}
                      >
                        <Icons.edit size={12} />
                        {task.feedbackScore ? 'Feedback' : 'Feedback geven'}
                      </button>
                      <button
                        onClick={() => startEdit(task)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--color-text-tertiary)' }}
                        title="Bewerken"
                      >
                        <Icons.edit size={15} />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors"
                        title="Verwijderen"
                      >
                        <Icons.trash size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm font-medium mb-3 transition-colors"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            <Icons.chevronRight
              size={14}
              className={`transition-transform ${showCompleted ? 'rotate-90' : ''}`}
            />
            Afgerond ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="space-y-2 opacity-60">
              {completedTasks.map(task => {
                const pri = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.normaal
                const fb = task.feedbackScore ? FEEDBACK_OPTIONS.find(o => o.value === task.feedbackScore) : null
                return (
                  <div key={task.id} className="card group">
                    <div className="flex items-start gap-4 p-4">
                      <button
                        onClick={() => toggleStatus(task)}
                        className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500/15 hover:scale-110 transition-all"
                        title="Heropenen"
                      >
                        <Icons.check size={15} className="text-emerald-400" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium line-through" style={{ color: 'var(--color-text-tertiary)' }}>
                            {task.title}
                          </h3>
                          {fb && (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${fb.bg} ${fb.color}`}>
                              {fb.label}
                            </span>
                          )}
                        </div>
                        {task.feedbackNote && (
                          <p className="text-xs mt-1 italic" style={{ color: 'var(--color-text-tertiary)' }}>
                            &quot;{task.feedbackNote}&quot;
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                          {(() => {
                            const photo = getPhotoUrl(task.assigner.name)
                            return (
                              <span className="flex items-center gap-1.5">
                                {photo ? (
                                  <Image src={photo} alt={task.assigner.name} width={18} height={18} className="w-[18px] h-[18px] rounded object-cover" />
                                ) : (
                                  <Icons.user size={12} />
                                )}
                                {task.assigner.name.split(' ')[0]}
                              </span>
                            )
                          })()}
                          {task.completedAt && (
                            <span className="flex items-center gap-1">
                              <Icons.check size={12} />
                              {formatDate(task.completedAt)}
                            </span>
                          )}
                          <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${pri.bg} ${pri.color}`}>
                            {pri.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openFeedback(task)}
                          className="p-2 rounded-lg transition-colors hover:bg-workx-lime/10"
                          style={{ color: 'var(--color-text-tertiary)' }}
                          title="Feedback"
                        >
                          <Icons.star size={15} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-colors">
                          <Icons.trash size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
