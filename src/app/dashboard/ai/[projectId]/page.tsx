'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'
import ClaudeChat from '@/components/claude/ClaudeChat'
import DocumentUploader from '@/components/claude/DocumentUploader'
import { useSidebar } from '@/lib/sidebar-context'

interface ProjectMember {
  id: string
  role: string
  user: { id: string; name: string; email: string; role: string }
}

interface Project {
  id: string
  title: string
  description: string | null
  icon: string
  color: string
  status: string
  userId: string
  conversations: Conversation[]
  documents: ProjectDocument[]
  members: ProjectMember[]
  user: { id: string; name: string }
  _count: { conversations: number; documents: number }
}

interface Conversation {
  id: string
  title: string
  updatedAt: string
  _count: { messages: number }
}

interface ProjectDocument {
  id: string
  name: string
  description: string | null
  fileType: string
  fileSize: number
  createdAt: string
}

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  hasWebSearch?: boolean
  citations?: Array<{ url: string; title: string }>
  createdAt?: string
}

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
}

const PROJECT_ICONS: Record<string, string> = {
  folder: '\u{1F4C1}', briefcase: '\u{1F4BC}', scale: '\u2696\uFE0F', document: '\u{1F4C4}',
  gavel: '\u{1F528}', shield: '\u{1F6E1}\uFE0F', building: '\u{1F3E2}', people: '\u{1F465}',
  contract: '\u{1F4DD}', money: '\u{1F4B0}', clock: '\u23F0', warning: '\u26A0\uFE0F',
  star: '\u2B50', fire: '\u{1F525}', lock: '\u{1F512}',
}

const ROLE_LABELS: Record<string, string> = {
  PARTNER: 'Partner',
  ADMIN: 'Admin',
  EMPLOYEE: 'Medewerker',
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { setCollapsed: setSidebarCollapsed } = useSidebar()

  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [chatInstance, setChatInstance] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [chatActive, setChatActive] = useState(false)

  // Dropdowns
  const [showSettings, setShowSettings] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const docsRef = useRef<HTMLDivElement>(null)

  // Settings editing
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // Team management
  const [allUsers, setAllUsers] = useState<TeamUser[]>([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')

  // PDF split modal
  const [splitDoc, setSplitDoc] = useState<ProjectDocument | null>(null)
  const [splitPageCount, setSplitPageCount] = useState<number>(0)
  const [splitRangesInput, setSplitRangesInput] = useState('')
  const [isSplitting, setIsSplitting] = useState(false)
  const [splitLoading, setSplitLoading] = useState(false)

  // Auto-collapse main sidebar when on project page
  useEffect(() => {
    setSidebarCollapsed(true)
  }, [setSidebarCollapsed])

  // Fetch project data
  useEffect(() => {
    fetchProject()
  }, [projectId])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
      if (docsRef.current && !docsRef.current.contains(e.target as Node)) {
        setShowDocs(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/claude/projects/${projectId}`)
      if (!res.ok) {
        router.push('/dashboard/ai')
        return
      }
      const data = await res.json()
      setProject(data)
      setEditTitle(data.title)
      setEditDescription(data.description || '')
      setSelectedDocIds(data.documents.map((d: ProjectDocument) => d.id))

      if (data.conversations.length > 0 && !activeConvId) {
        setActiveConvId(data.conversations[0].id)
        setChatInstance(prev => prev + 1)
      }
    } catch {
      toast.error('Kon project niet laden')
      router.push('/dashboard/ai')
    } finally {
      setIsLoading(false)
    }
  }

  const updateProject = async () => {
    if (!editTitle.trim()) {
      toast.error('Titel mag niet leeg zijn')
      return
    }
    try {
      const res = await fetch(`/api/claude/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), description: editDescription.trim() || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProject(prev => prev ? { ...prev, ...updated } : null)
        setShowSettings(false)
        toast.success('Project bijgewerkt')
      }
    } catch {
      toast.error('Kon project niet bijwerken')
    }
  }

  const deleteProject = async () => {
    if (!confirm('Weet je zeker dat je dit project wilt verwijderen?')) return
    try {
      await fetch(`/api/claude/projects/${projectId}`, { method: 'DELETE' })
      toast.success('Project verwijderd')
      router.push('/dashboard/ai')
    } catch {
      toast.error('Kon project niet verwijderen')
    }
  }

  const deleteDocument = async (docId: string) => {
    try {
      await fetch(`/api/claude/documents/${docId}`, { method: 'DELETE' })
      setProject(prev => prev ? {
        ...prev,
        documents: prev.documents.filter(d => d.id !== docId),
      } : null)
      setSelectedDocIds(prev => prev.filter(id => id !== docId))
      toast.success('Document verwijderd')
    } catch {
      toast.error('Kon document niet verwijderen')
    }
  }

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const openSplitModal = async (doc: ProjectDocument) => {
    setSplitDoc(doc)
    setSplitRangesInput('')
    setSplitLoading(true)
    try {
      const res = await fetch(`/api/claude/documents/${doc.id}/split`)
      if (!res.ok) throw new Error('Kon PDF niet laden')
      const data = await res.json()
      setSplitPageCount(data.pageCount)
      // Default: split per page
      setSplitRangesInput(
        Array.from({ length: data.pageCount }, (_, i) => String(i + 1)).join(', ')
      )
    } catch {
      toast.error('Kon paginatelling niet ophalen')
      setSplitDoc(null)
    } finally {
      setSplitLoading(false)
    }
  }

  const parsePageRanges = (input: string, totalPages: number): { start: number; end: number; label: string }[] | null => {
    const ranges: { start: number; end: number; label: string }[] = []
    const parts = input.split(',').map(s => s.trim()).filter(Boolean)
    for (const part of parts) {
      const dashMatch = part.match(/^(\d+)\s*-\s*(\d+)$/)
      if (dashMatch) {
        const start = parseInt(dashMatch[1])
        const end = parseInt(dashMatch[2])
        if (start < 1 || end > totalPages || start > end) return null
        ranges.push({ start, end, label: `p${start}-${end}` })
      } else if (/^\d+$/.test(part)) {
        const page = parseInt(part)
        if (page < 1 || page > totalPages) return null
        ranges.push({ start: page, end: page, label: `p${page}` })
      } else {
        return null
      }
    }
    return ranges.length > 0 ? ranges : null
  }

  const executeSplit = async () => {
    if (!splitDoc || !splitPageCount) return
    const ranges = parsePageRanges(splitRangesInput, splitPageCount)
    if (!ranges) {
      toast.error('Ongeldig paginaformaat. Gebruik bijv. "1-3, 4-6" of "1, 2, 3"')
      return
    }
    setIsSplitting(true)
    try {
      const res = await fetch(`/api/claude/documents/${splitDoc.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageRanges: ranges }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Splitsen mislukt' }))
        throw new Error(data.error)
      }
      const { documents: newDocs } = await res.json()
      // Add new documents to project state
      setProject(prev => prev ? {
        ...prev,
        documents: [...(newDocs as ProjectDocument[]), ...prev.documents],
      } : null)
      // Select new documents
      setSelectedDocIds(prev => [...prev, ...newDocs.map((d: ProjectDocument) => d.id)])
      toast.success(`PDF gesplitst in ${newDocs.length} documenten`)
      setSplitDoc(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Splitsen mislukt')
    } finally {
      setIsSplitting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const fetchUsersIfNeeded = async () => {
    if (allUsers.length === 0) {
      try {
        const res = await fetch('/api/claude/users')
        setAllUsers(await res.json())
      } catch { /* ignore */ }
    }
  }

  const addMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/claude/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        const member = await res.json()
        setProject(prev => prev ? { ...prev, members: [...prev.members, member] } : null)
        toast.success('Teamlid toegevoegd')
      }
    } catch {
      toast.error('Kon teamlid niet toevoegen')
    }
  }

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/claude/projects/${projectId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        setProject(prev => prev ? {
          ...prev,
          members: prev.members.filter(m => m.user.id !== userId),
        } : null)
        toast.success('Teamlid verwijderd')
      }
    } catch {
      toast.error('Kon teamlid niet verwijderen')
    }
  }

  const filteredUsersForAdd = allUsers.filter(u => {
    const alreadyMember = project?.members.some(m => m.user.id === u.id)
    const matchesSearch = u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearchQuery.toLowerCase())
    return !alreadyMember && matchesSearch
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex items-center gap-3 text-white/40">
          <div className="animate-spin"><Icons.refresh size={20} /></div>
          <span>Project laden...</span>
        </div>
      </div>
    )
  }

  if (!project) return null

  const displayIcon = PROJECT_ICONS[project.icon] || project.icon

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 110px)' }}>
      {/* Compact project bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/ai')}
            className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <Icons.chevronLeft size={12} />
            Terug
          </button>
          <div className="w-px h-4 bg-white/10" />
          <div className="flex items-center gap-2">
            <span className="text-sm">{displayIcon}</span>
            <span className="text-[13px] font-medium text-white">{project.title}</span>
            {project.documents.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/30">
                {project.documents.length} doc{project.documents.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Documents dropdown */}
          <div className="relative" ref={docsRef}>
            <button
              onClick={() => setShowDocs(!showDocs)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                showDocs
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                  : 'border-white/10 text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
              }`}
            >
              <Icons.file size={12} />
              Documenten
            </button>

            {showDocs && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-workx-gray border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-sm overflow-hidden animate-fade-in">
                <div className="p-3 border-b border-white/5">
                  <DocumentUploader
                    projectId={projectId}
                    onUpload={(doc) => {
                      setProject(prev => prev ? {
                        ...prev,
                        documents: [doc as unknown as ProjectDocument, ...prev.documents],
                      } : null)
                      setSelectedDocIds(prev => [...prev, doc.id])
                    }}
                    compact
                  />
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {project.documents.length === 0 ? (
                    <p className="text-[11px] text-white/20 text-center py-4">Nog geen documenten</p>
                  ) : (
                    project.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group">
                        <button
                          onClick={() => toggleDocSelection(doc.id)}
                          className={`flex-shrink-0 w-4 h-4 rounded border transition-all flex items-center justify-center ${
                            selectedDocIds.includes(doc.id)
                              ? 'bg-workx-lime border-workx-lime'
                              : 'border-white/20 hover:border-white/40'
                          }`}
                        >
                          {selectedDocIds.includes(doc.id) && (
                            <Icons.check size={10} className="text-workx-dark" />
                          )}
                        </button>
                        <Icons.file size={12} className="text-white/25 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white/60 truncate">{doc.name}</p>
                          <p className="text-[9px] text-white/20">{formatFileSize(doc.fileSize)}</p>
                        </div>
                        {doc.fileType === 'pdf' && (
                          <button
                            onClick={() => openSplitModal(doc)}
                            title="PDF splitsen"
                            className="p-1 rounded text-white/10 hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Icons.scissors size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="p-1 rounded text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Icons.trash size={11} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {project.documents.length > 0 && (
                  <p className="text-[9px] text-white/15 px-3 pb-2">
                    Aangevinkte documenten worden als context meegestuurd
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Settings dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => { setShowSettings(!showSettings); fetchUsersIfNeeded() }}
              className={`p-1.5 rounded-lg transition-all ${
                showSettings
                  ? 'bg-white/10 text-white/60'
                  : 'text-white/25 hover:text-white/50 hover:bg-white/[0.04]'
              }`}
            >
              <Icons.settings size={14} />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-workx-gray border border-white/10 rounded-xl shadow-2xl z-50 backdrop-blur-sm overflow-hidden animate-fade-in">
                <div className="p-3 space-y-3">
                  <div>
                    <label className="text-[10px] text-white/30 block mb-1">Titel</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-workx-lime/40"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 block mb-1">Beschrijving</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white resize-none focus:outline-none focus:border-workx-lime/40"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={updateProject} className="px-3 py-1.5 rounded-lg bg-workx-lime text-workx-dark text-[11px] font-medium hover:bg-workx-lime/90 transition-colors">
                      Opslaan
                    </button>
                    <button onClick={deleteProject} className="px-3 py-1.5 rounded-lg text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                      Verwijderen
                    </button>
                  </div>

                  {/* Team members */}
                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-2">
                      Teamleden ({project.members.length})
                    </p>
                    <div className="space-y-1">
                      {project.members.map((member) => (
                        <div key={member.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group">
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-medium text-white/60 flex-shrink-0">
                            {member.user.name.charAt(0)}
                          </div>
                          <span className="text-[11px] text-white/60 truncate flex-1">{member.user.name}</span>
                          {member.role === 'owner' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-workx-lime/10 text-workx-lime">Eigenaar</span>
                          )}
                          {member.role !== 'owner' && (
                            <button onClick={() => removeMember(member.user.id)} className="p-1 rounded text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                              <Icons.x size={10} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowAddMember(!showAddMember)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/30 hover:text-white/60 hover:bg-white/[0.07] transition-all w-full mt-2"
                    >
                      <Icons.userPlus size={12} />
                      Teamlid toevoegen
                    </button>
                    {showAddMember && (
                      <div className="mt-1 border border-white/10 rounded-lg overflow-hidden">
                        <input
                          type="text"
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          placeholder="Zoek..."
                          className="w-full px-2 py-1.5 bg-white/5 text-[10px] text-white placeholder-white/25 focus:outline-none border-b border-white/5"
                          autoFocus
                        />
                        <div className="max-h-32 overflow-y-auto">
                          {filteredUsersForAdd.map(user => (
                            <button
                              key={user.id}
                              onClick={() => { addMember(user.id); setShowAddMember(false); setMemberSearchQuery('') }}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[10px] text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                            >
                              <span className="truncate flex-1">{user.name}</span>
                              <span className="text-[8px] text-white/20">{ROLE_LABELS[user.role] || user.role}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New chat button */}
          <button
            onClick={() => {
              setActiveConvId(null)
              setMessages([])
              setChatInstance(prev => prev + 1)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all bg-workx-lime/10 text-workx-lime border border-workx-lime/20 hover:bg-workx-lime/20 hover:border-workx-lime/40 hover:shadow-[0_0_12px_rgba(249,255,133,0.15)]"
          >
            <Icons.plus size={14} />
            Nieuwe chat
          </button>
        </div>
      </div>

      {/* Full-width chat */}
      <div className="flex-1 rounded-2xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/[0.08] overflow-hidden mt-1">
        <ClaudeChat
          key={chatInstance}
          conversationId={activeConvId}
          projectId={projectId}
          documentIds={selectedDocIds}
          initialMessages={messages}
          onConversationCreated={(id) => {
            setActiveConvId(id)
            fetchProject()
          }}
          onNewChat={() => {
            setActiveConvId(null)
            setMessages([])
            setChatInstance(prev => prev + 1)
          }}
          onActiveChange={setChatActive}
          placeholder={`Stel een vraag over ${project.title}...`}
        />
      </div>

      {/* PDF Split Modal */}
      {splitDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => !isSplitting && setSplitDoc(null)}>
          <div className="bg-workx-gray border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Icons.scissors size={16} className="text-blue-400" />
                <h3 className="text-sm font-medium text-white">PDF splitsen</h3>
              </div>
              <button onClick={() => !isSplitting && setSplitDoc(null)} className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                <Icons.x size={16} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <p className="text-[11px] text-white/40 mb-1">Document</p>
                <p className="text-sm text-white/80 truncate">{splitDoc.name}</p>
              </div>

              {splitLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin"><Icons.refresh size={18} className="text-white/30" /></div>
                  <span className="ml-2 text-xs text-white/30">PDF laden...</span>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] text-white/40 mb-1">Aantal pagina&apos;s: {splitPageCount}</p>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/40 block mb-1.5">
                      Paginabereiken (gescheiden door komma&apos;s)
                    </label>
                    <input
                      type="text"
                      value={splitRangesInput}
                      onChange={(e) => setSplitRangesInput(e.target.value)}
                      placeholder="bijv. 1-3, 4-6, 7"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
                      disabled={isSplitting}
                    />
                    <p className="text-[10px] text-white/20 mt-1.5">
                      Gebruik &quot;1-3&quot; voor een bereik of &quot;5&quot; voor een losse pagina. Meerdere bereiken scheiden met komma&apos;s.
                    </p>
                  </div>

                  {/* Quick split buttons */}
                  {splitPageCount > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setSplitRangesInput(
                          Array.from({ length: splitPageCount }, (_, i) => String(i + 1)).join(', ')
                        )}
                        className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                        disabled={isSplitting}
                      >
                        Per pagina
                      </button>
                      {splitPageCount > 2 && (
                        <button
                          onClick={() => {
                            const half = Math.ceil(splitPageCount / 2)
                            setSplitRangesInput(`1-${half}, ${half + 1}-${splitPageCount}`)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                          disabled={isSplitting}
                        >
                          In tweeen
                        </button>
                      )}
                      {splitPageCount > 3 && (
                        <button
                          onClick={() => {
                            const third = Math.ceil(splitPageCount / 3)
                            const twoThirds = Math.ceil(2 * splitPageCount / 3)
                            setSplitRangesInput(`1-${third}, ${third + 1}-${twoThirds}, ${twoThirds + 1}-${splitPageCount}`)
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                          disabled={isSplitting}
                        >
                          In drieen
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-white/5">
              <button
                onClick={() => setSplitDoc(null)}
                disabled={isSplitting}
                className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                onClick={executeSplit}
                disabled={isSplitting || splitLoading || !splitRangesInput.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-[11px] font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSplitting ? (
                  <>
                    <div className="animate-spin"><Icons.refresh size={12} /></div>
                    Splitsen...
                  </>
                ) : (
                  <>
                    <Icons.scissors size={12} />
                    Splitsen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
