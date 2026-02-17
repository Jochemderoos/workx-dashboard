'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'
import ClaudeChat from '@/components/claude/ClaudeChat'
import ProjectCard from '@/components/claude/ProjectCard'
import SourcesManager from '@/components/claude/SourcesManager'
import TemplatesManager from '@/components/claude/TemplatesManager'

interface Project {
  id: string
  title: string
  description: string | null
  icon: string
  color: string
  status: string
  createdAt: string
  _count: { conversations: number; documents: number }
  members?: Array<{ user: TeamUser; role: string }>
  user?: { id: string; name: string }
}

interface Conversation {
  id: string
  title: string
  projectId: string | null
  updatedAt: string
  _count?: { messages: number }
  project?: { title: string; icon: string; color: string } | null
}

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
}

const PROJECT_ICONS = [
  { value: 'briefcase', label: '💼 Dossier' },
  { value: 'scale', label: '⚖️ Rechtszaak' },
  { value: 'document', label: '📄 Contract' },
  { value: 'people', label: '👥 Cliënt' },
  { value: 'shield', label: '🛡️ Verweer' },
  { value: 'gavel', label: '🔨 Procedure' },
  { value: 'money', label: '💰 Financieel' },
  { value: 'building', label: '🏢 Onderneming' },
  { value: 'warning', label: '⚠️ Urgent' },
  { value: 'lock', label: '🔒 Vertrouwelijk' },
]

const PROJECT_COLORS = [
  '#f9ff85', '#60a5fa', '#34d399', '#f472b6', '#a78bfa',
  '#fbbf24', '#fb923c', '#f87171', '#2dd4bf', '#818cf8',
]

const ROLE_LABELS: Record<string, string> = {
  PARTNER: 'Partner',
  ADMIN: 'Admin',
  EMPLOYEE: 'Medewerker',
}

export default function AIAssistentPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [chatActive, setChatActive] = useState(false)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'projects' | 'bronnen' | 'templates'>('chat')

  // Search and pagination
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTimeout, setSearchTimeoutState] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [hasMoreConversations, setHasMoreConversations] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Rename and delete state
  const [editingConvId, setEditingConvId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenuConvId, setContextMenuConvId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    icon: 'briefcase',
    color: '#f9ff85',
  })

  // Team selection state
  const [allUsers, setAllUsers] = useState<TeamUser[]>([])
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Help modal state
  const [showHelp, setShowHelp] = useState(false)

  // Save-to-project modal state
  const [saveModalConvId, setSaveModalConvId] = useState<string | null>(null)
  const [saveModalNewProject, setSaveModalNewProject] = useState(false)
  const [saveModalNewTitle, setSaveModalNewTitle] = useState('')
  const [saveModalNewDesc, setSaveModalNewDesc] = useState('')
  const [isSavingToProject, setIsSavingToProject] = useState(false)

  // Fetch conversations with search and pagination support
  const fetchConversations = async (search = '', cursor?: string, append = false) => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (cursor) params.set('cursor', cursor)
      params.set('limit', '50')
      const res = await fetch(`/api/claude/conversations?${params}`)
      const data = await res.json()
      const convs = data.conversations || data // backward compat
      if (Array.isArray(convs)) {
        setRecentConversations(prev => append ? [...prev, ...convs] : convs)
      }
      setHasMoreConversations(data.hasMore || false)
      setNextCursor(data.nextCursor || undefined)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/claude/projects').then(r => r.json()),
      fetchConversations(),
    ]).then(([projectsData]) => {
      setProjects(projectsData)
    }).catch(() => {
      toast.error('Kon data niet laden')
    }).finally(() => {
      setIsLoading(false)
    })

    // Check URL for conv parameter, or auto-resume last conversation
    const urlParams = new URLSearchParams(window.location.search)
    const convParam = urlParams.get('conv')
    if (convParam) setSelectedConvId(convParam)
    // Auto-resume is handled after conversations load (see effect below)
  }, [])

  // Auto-resume: select most recent conversation if none selected
  useEffect(() => {
    if (!isLoading && !selectedConvId && recentConversations.length > 0) {
      const urlParams = new URLSearchParams(window.location.search)
      if (!urlParams.get('conv')) {
        // Auto-select most recent conversation
        const mostRecent = recentConversations[0]
        setSelectedConvId(mostRecent.id)
        window.history.replaceState(null, '', `/dashboard/ai?conv=${mostRecent.id}`)
      }
    }
  }, [isLoading, recentConversations])

  // Debounced search
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      fetchConversations(searchQuery)
    }, 300)
    setSearchTimeoutState(timeout)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  // Fetch users when new project form opens
  useEffect(() => {
    if (showNewProject && allUsers.length === 0) {
      fetch('/api/claude/users')
        .then(r => r.json())
        .then(setAllUsers)
        .catch(() => {})
    }
  }, [showNewProject])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const createProject = async () => {
    if (!newProject.title.trim()) {
      toast.error('Vul een titel in')
      return
    }

    try {
      const res = await fetch('/api/claude/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          memberIds: selectedMemberIds,
        }),
      })

      if (!res.ok) throw new Error()

      const project = await res.json()
      setProjects([project, ...projects])
      setShowNewProject(false)
      setNewProject({ title: '', description: '', icon: 'briefcase', color: '#f9ff85' })
      setSelectedMemberIds([])
      toast.success('Project aangemaakt!')
      router.push(`/dashboard/ai/${project.id}`)
    } catch {
      toast.error('Kon project niet aanmaken')
    }
  }

  const handleConversationCreated = (id: string) => {
    window.history.replaceState(null, '', `/dashboard/ai?conv=${id}`)
  }

  // Load more conversations (pagination)
  const loadMoreConversations = async () => {
    if (!nextCursor || isLoadingMore) return
    setIsLoadingMore(true)
    await fetchConversations(searchQuery, nextCursor, true)
    setIsLoadingMore(false)
  }

  // Rename conversation
  const startRenaming = (conv: Conversation) => {
    setEditingConvId(conv.id)
    setEditingTitle(conv.title)
    setContextMenuConvId(null)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const saveRename = async () => {
    if (!editingConvId || !editingTitle.trim()) {
      setEditingConvId(null)
      return
    }
    try {
      const res = await fetch(`/api/claude/conversations/${editingConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle.trim() }),
      })
      if (!res.ok) throw new Error()
      setRecentConversations(prev =>
        prev.map(c => c.id === editingConvId ? { ...c, title: editingTitle.trim() } : c)
      )
      toast.success('Naam gewijzigd')
    } catch {
      toast.error('Kon naam niet wijzigen')
    }
    setEditingConvId(null)
  }

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/claude/conversations/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRecentConversations(prev => prev.filter(c => c.id !== id))
      if (selectedConvId === id) {
        setSelectedConvId(null)
        window.history.replaceState(null, '', '/dashboard/ai')
      }
      toast.success('Gesprek verwijderd')
    } catch {
      toast.error('Kon gesprek niet verwijderen')
    }
    setDeleteConfirmId(null)
  }

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = () => setContextMenuConvId(null)
    if (contextMenuConvId) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenuConvId])

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const handleSaveToProject = (conversationId: string) => {
    setSaveModalConvId(conversationId)
    setSaveModalNewProject(false)
    setSaveModalNewTitle('')
    setSaveModalNewDesc('')
  }

  const saveConversationToProject = async (targetProjectId: string) => {
    if (!saveModalConvId) return
    setIsSavingToProject(true)
    try {
      const res = await fetch(`/api/claude/conversations/${saveModalConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: targetProjectId }),
      })
      if (!res.ok) throw new Error()
      const project = projects.find(p => p.id === targetProjectId)
      toast.success(`Chat opgeslagen in ${project?.title || 'project'}`)
      setSaveModalConvId(null)
      router.push(`/dashboard/ai/${targetProjectId}`)
    } catch {
      toast.error('Kon chat niet opslaan in project')
    } finally {
      setIsSavingToProject(false)
    }
  }

  const createProjectAndSave = async () => {
    if (!saveModalNewTitle.trim() || !saveModalConvId) return
    setIsSavingToProject(true)
    try {
      // Create project
      const projectRes = await fetch('/api/claude/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: saveModalNewTitle,
          description: saveModalNewDesc || null,
          icon: 'briefcase',
          color: '#f9ff85',
        }),
      })
      if (!projectRes.ok) throw new Error()
      const newProj = await projectRes.json()

      // Move conversation to new project
      const moveRes = await fetch(`/api/claude/conversations/${saveModalConvId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: newProj.id }),
      })
      if (!moveRes.ok) throw new Error()

      setProjects([newProj, ...projects])
      toast.success(`Chat opgeslagen in "${saveModalNewTitle}"`)
      setSaveModalConvId(null)
      router.push(`/dashboard/ai/${newProj.id}`)
    } catch {
      toast.error('Kon project niet aanmaken')
    } finally {
      setIsSavingToProject(false)
    }
  }

  const tabs = [
    { id: 'chat' as const, label: 'Chat', desc: 'Snel een vraag stellen', icon: Icons.chat },
    { id: 'projects' as const, label: 'Projecten', desc: 'Dossiers & zaken', icon: Icons.briefcase, count: projects.length },
    { id: 'bronnen' as const, label: 'Bronnen', desc: 'Juridische bronnen', icon: Icons.database },
    { id: 'templates' as const, label: 'Templates', desc: 'Document sjablonen', icon: Icons.fileText },
  ]

  // Whether to use compact layout (chat active on chat tab)
  const isCompactMode = chatActive && activeTab === 'chat'

  return (
    <div className={`transition-all duration-500 ease-in-out ${isCompactMode ? 'space-y-2' : 'space-y-6'}`}>
      {/* Hero Header - collapses when chat is active */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-workx-gray via-workx-dark to-workx-gray border border-white/10 transition-all duration-500 ease-in-out ${
        isCompactMode ? 'p-3' : 'p-8'
      }`}>
        <div className={`absolute top-0 right-0 w-96 h-96 bg-workx-lime/5 rounded-full blur-[100px] transition-opacity duration-500 ${isCompactMode ? 'opacity-0' : 'opacity-100'}`} />
        <div className={`absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px] transition-opacity duration-500 ${isCompactMode ? 'opacity-0' : 'opacity-100'}`} />

        <div className="relative flex items-center justify-between">
          <div className={`flex items-center gap-3 transition-all duration-500`}>
            <div className={`rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center border border-workx-lime/20 transition-all duration-500 ${
              isCompactMode ? 'w-8 h-8 rounded-xl' : 'w-12 h-12'
            }`}>
              <Icons.sparkles size={isCompactMode ? 16 : 24} className="text-workx-lime" />
            </div>
            <div>
              <h1 className={`font-semibold text-white transition-all duration-500 ${isCompactMode ? 'text-base' : 'text-2xl'}`}>AI Assistent</h1>
              <p className={`text-white/40 transition-all duration-500 overflow-hidden ${isCompactMode ? 'text-[0px] opacity-0 h-0' : 'text-sm opacity-100'}`}>
                Juridische AI voor Workx Advocaten
              </p>
            </div>
          </div>

          {/* Description - hidden when compact */}
          <div className={`transition-all duration-500 overflow-hidden ${isCompactMode ? 'max-w-0 opacity-0' : 'max-w-xl opacity-100'}`}>
            <p className="text-sm text-white/30 leading-relaxed whitespace-nowrap">
              Stel vragen, analyseer documenten, zoek rechtspraak
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/20 flex-shrink-0">
            <button
              onClick={() => setShowHelp(true)}
              className={`flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 text-blue-300/70 hover:text-blue-300 hover:border-blue-500/30 hover:from-blue-500/15 hover:to-purple-500/15 transition-all duration-300 ${
                isCompactMode ? 'px-2 py-1' : 'px-3 py-1.5'
              }`}
            >
              <Icons.helpCircle size={isCompactMode ? 13 : 15} />
              {!isCompactMode && <span>Hulp & uitleg</span>}
            </button>
            <div className={`flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 transition-all duration-500 ${
              isCompactMode ? 'px-2 py-1' : 'px-3 py-1.5'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Claude Sonnet 4.5
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - shrinks when chat is active */}
      <div className={`grid grid-cols-4 gap-2 sticky top-0 z-30 bg-workx-dark transition-all duration-500 ease-in-out ${
        isCompactMode ? 'py-1 -my-1' : 'py-2 -my-2'
      }`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center justify-center rounded-xl text-center transition-all duration-300 ${
              isCompactMode
                ? 'flex-row gap-1.5 px-2 py-2'
                : 'flex-col gap-1.5 px-3 py-3.5'
            } ${
              activeTab === tab.id
                ? 'bg-workx-lime text-workx-dark shadow-lg shadow-workx-lime/20'
                : 'bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.06] hover:border-white/20'
            }`}
          >
            <tab.icon size={isCompactMode ? 16 : 20} />
            <div className="flex items-center gap-1.5">
              <span className={`transition-all duration-300 ${
                isCompactMode ? 'text-xs' : 'text-sm'
              } ${activeTab === tab.id ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  activeTab === tab.id
                    ? 'bg-workx-dark/20 text-workx-dark'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {tab.count}
                </span>
              )}
            </div>
            {/* Description - hidden in compact mode */}
            <span className={`text-[10px] leading-tight transition-all duration-300 overflow-hidden ${
              isCompactMode
                ? 'max-h-0 opacity-0 w-0'
                : 'max-h-6 opacity-100'
            } ${
              activeTab === tab.id ? 'text-workx-dark/60' : 'text-white/25'
            }`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'chat' && (
        <div className="flex gap-3" style={{ height: isCompactMode ? 'calc(100vh - 180px)' : 'calc(100vh - 320px)' }}>
          {/* Conversation history sidebar */}
          <div className={`rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden flex flex-col transition-all duration-300 flex-shrink-0 ${
            showHistory ? 'w-80 opacity-100' : 'w-0 opacity-0 border-0 p-0'
          }`}>
            {showHistory && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                  <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Gesprekken</span>
                  <button
                    onClick={() => {
                      setSelectedConvId(null)
                      window.history.replaceState(null, '', '/dashboard/ai')
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-workx-lime/10 text-workx-lime text-[11px] font-medium hover:bg-workx-lime/20 transition-colors"
                  >
                    <Icons.plus size={12} />
                    Nieuw
                  </button>
                </div>

                {/* Search bar */}
                <div className="px-2.5 py-2 border-b border-white/[0.04]">
                  <div className="relative">
                    <Icons.search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Zoek in gesprekken..."
                      className="w-full pl-8 pr-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/25 focus:bg-white/[0.05] transition-all duration-200"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                      >
                        <Icons.x size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {recentConversations.length === 0 ? (
                    <div className="p-4 text-center text-white/20 text-xs">
                      {searchQuery ? 'Geen resultaten' : 'Nog geen gesprekken'}
                    </div>
                  ) : (
                    <>
                      {recentConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className={`group relative border-b border-white/[0.03] conv-item ${
                            selectedConvId === conv.id
                              ? 'active'
                              : ''
                          }`}
                        >
                          {/* Rename mode */}
                          {editingConvId === conv.id ? (
                            <div className="px-3 py-2.5">
                              <input
                                ref={editInputRef}
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={saveRename}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveRename()
                                  if (e.key === 'Escape') setEditingConvId(null)
                                }}
                                className="w-full px-2 py-1 bg-white/10 border border-workx-lime/30 rounded text-sm text-white focus:outline-none"
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedConvId(conv.id)
                                window.history.replaceState(null, '', `/dashboard/ai?conv=${conv.id}`)
                              }}
                              className="w-full text-left px-3 py-2.5"
                            >
                              <p className="text-sm text-white/80 truncate leading-snug pr-6">{conv.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-white/25">
                                  {new Date(conv.updatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                                {conv._count?.messages && (
                                  <span className="text-[10px] text-white/20">{conv._count.messages} msg</span>
                                )}
                                {conv.project && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 truncate max-w-[100px]">
                                    {conv.project.title}
                                  </span>
                                )}
                              </div>
                            </button>
                          )}

                          {/* Context menu trigger (3 dots) */}
                          {editingConvId !== conv.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setContextMenuConvId(contextMenuConvId === conv.id ? null : conv.id)
                              }}
                              className="absolute right-2 top-2.5 p-1 rounded opacity-0 group-hover:opacity-100 text-white/30 hover:text-white hover:bg-white/10 transition-all"
                            >
                              <Icons.moreVertical size={14} />
                            </button>
                          )}

                          {/* Context menu dropdown */}
                          {contextMenuConvId === conv.id && (
                            <div className="absolute right-2 top-9 z-50 w-40 bg-workx-gray border border-white/10 rounded-xl shadow-2xl overflow-hidden context-menu-animate backdrop-blur-sm">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startRenaming(conv)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                              >
                                <Icons.edit size={13} />
                                Hernoemen
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveToProject(conv.id)
                                  setContextMenuConvId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                              >
                                <Icons.folder size={13} />
                                Opslaan in project
                              </button>
                              <div className="border-t border-white/5" />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmId(conv.id)
                                  setContextMenuConvId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                              >
                                <Icons.trash size={13} />
                                Verwijderen
                              </button>
                            </div>
                          )}

                          {/* Delete confirmation inline */}
                          {deleteConfirmId === conv.id && (
                            <div className="absolute inset-0 bg-workx-dark/95 backdrop-blur-sm flex items-center justify-center gap-2 z-50 rounded-sm">
                              <span className="text-xs text-white/60">Verwijderen?</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteConversation(conv.id)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/30 transition-colors"
                              >
                                Ja
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteConfirmId(null)
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white/10 text-white/50 text-[11px] font-medium hover:bg-white/15 transition-colors"
                              >
                                Nee
                              </button>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Load more button */}
                      {hasMoreConversations && (
                        <button
                          onClick={loadMoreConversations}
                          disabled={isLoadingMore}
                          className="w-full px-3 py-2.5 text-[11px] text-white/30 hover:text-white/50 hover:bg-white/[0.03] transition-colors"
                        >
                          {isLoadingMore ? 'Laden...' : 'Meer gesprekken laden'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden relative">
            {/* History toggle button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="absolute top-2 left-2 z-20 p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              title={showHistory ? 'Verberg gesprekken' : 'Toon gesprekken'}
            >
              <Icons.menu size={14} />
            </button>
            <ClaudeChat
              key={selectedConvId || 'new'}
              conversationId={selectedConvId}
              onConversationCreated={(id) => {
                handleConversationCreated(id)
                setSelectedConvId(id)
                // Refresh conversation list
                fetchConversations(searchQuery)
              }}
              onNewChat={() => {
                setSelectedConvId(null)
                window.history.replaceState(null, '', '/dashboard/ai')
              }}
              onActiveChange={setChatActive}
              onSaveToProject={handleSaveToProject}
            />
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-4">
          {/* New project button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/40">
              {projects.length} project{projects.length !== 1 ? 'en' : ''}
            </p>
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
            >
              <Icons.plus size={16} />
              Nieuw project
            </button>
          </div>

          {/* New project form */}
          {showNewProject && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-4 animate-fade-in">
              <h3 className="text-sm font-medium text-white">Nieuw project aanmaken</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-white/40 block mb-1">Titel</label>
                  <input
                    type="text"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    placeholder="bijv. Dossier Janssen - Ontslag"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[11px] text-white/40 block mb-1">Beschrijving (optioneel)</label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    placeholder="Korte beschrijving van het dossier..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40"
                  />
                </div>

                <div className="flex gap-6">
                  <div>
                    <label className="text-[11px] text-white/40 block mb-1.5">Type</label>
                    <div className="flex flex-wrap gap-1.5">
                      {PROJECT_ICONS.map((icon) => (
                        <button
                          key={icon.value}
                          onClick={() => setNewProject({ ...newProject, icon: icon.value })}
                          className={`px-2 py-1 rounded-lg text-xs transition-all ${
                            newProject.icon === icon.value
                              ? 'bg-white/10 border border-white/20 text-white'
                              : 'bg-white/[0.02] border border-white/5 text-white/40 hover:bg-white/5'
                          }`}
                        >
                          {icon.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-white/40 block mb-1.5">Kleur</label>
                    <div className="flex gap-1.5">
                      {PROJECT_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewProject({ ...newProject, color })}
                          className={`w-6 h-6 rounded-lg transition-all ${
                            newProject.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-workx-dark' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Team members selection */}
                <div>
                  <label className="text-[11px] text-white/40 block mb-1">Teamleden (optioneel)</label>
                  <p className="text-[10px] text-white/20 mb-2">Alleen jij en geselecteerde teamleden zien dit project</p>

                  {/* Selected members chips */}
                  {selectedMemberIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedMemberIds.map(id => {
                        const user = allUsers.find(u => u.id === id)
                        if (!user) return null
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-workx-lime/10 border border-workx-lime/20 text-xs text-workx-lime"
                          >
                            {user.name}
                            <button
                              onClick={() => toggleMember(id)}
                              className="hover:text-white transition-colors"
                            >
                              <Icons.x size={12} />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* User dropdown */}
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowUserDropdown(!showUserDropdown)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/40 hover:text-white/60 hover:bg-white/[0.07] transition-all w-full text-left"
                    >
                      <Icons.userPlus size={14} />
                      Teamlid toevoegen...
                    </button>

                    {showUserDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-workx-gray border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-white/5">
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            placeholder="Zoek op naam..."
                            className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {filteredUsers.map(user => (
                            <button
                              key={user.id}
                              onClick={() => {
                                toggleMember(user.id)
                              }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                                selectedMemberIds.includes(user.id)
                                  ? 'bg-workx-lime/10 text-workx-lime'
                                  : 'text-white/60 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                                {user.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate">{user.name}</p>
                                <p className="text-[10px] text-white/25 truncate">{user.email}</p>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 flex-shrink-0">
                                {ROLE_LABELS[user.role] || user.role}
                              </span>
                              {selectedMemberIds.includes(user.id) && (
                                <Icons.check size={12} className="text-workx-lime flex-shrink-0" />
                              )}
                            </button>
                          ))}
                          {filteredUsers.length === 0 && (
                            <p className="px-3 py-4 text-[11px] text-white/20 text-center">Geen gebruikers gevonden</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={createProject}
                  className="px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors"
                >
                  Aanmaken
                </button>
                <button
                  onClick={() => {
                    setShowNewProject(false)
                    setSelectedMemberIds([])
                    setUserSearchQuery('')
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}

          {/* Projects grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-white/5 border border-white/10 p-5 h-32 animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl bg-white/[0.02] border border-white/10 p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                <Icons.briefcase size={24} className="text-white/20" />
              </div>
              <p className="text-sm text-white/40 mb-1">Nog geen projecten</p>
              <p className="text-xs text-white/25">Maak een project aan om documenten en gesprekken te organiseren per dossier.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  id={project.id}
                  title={project.title}
                  description={project.description}
                  icon={project.icon}
                  color={project.color}
                  status={project.status}
                  conversationCount={project._count.conversations}
                  documentCount={project._count.documents}
                  memberCount={project.members?.length}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'bronnen' && (
        <SourcesManager />
      )}

      {activeTab === 'templates' && (
        <TemplatesManager />
      )}

      {/* Save-to-project modal */}
      {saveModalConvId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSavingToProject && setSaveModalConvId(null)}
          />
          <div className="relative w-full max-w-md mx-4 rounded-2xl bg-workx-gray border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Icons.folder size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Opslaan in project</h3>
                    <p className="text-[11px] text-white/30">Kies een project of maak een nieuw project aan</p>
                  </div>
                </div>
                <button
                  onClick={() => setSaveModalConvId(null)}
                  disabled={isSavingToProject}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Icons.x size={16} />
                </button>
              </div>
            </div>

            <div className="p-4 max-h-[400px] overflow-y-auto space-y-2">
              {/* New project option */}
              {!saveModalNewProject ? (
                <button
                  onClick={() => setSaveModalNewProject(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-white/10 text-white/50 hover:text-workx-lime hover:border-workx-lime/30 hover:bg-workx-lime/5 transition-all"
                >
                  <Icons.plus size={16} />
                  <span className="text-sm font-medium">Nieuw project aanmaken</span>
                </button>
              ) : (
                <div className="rounded-xl border border-workx-lime/20 bg-workx-lime/5 p-4 space-y-3">
                  <input
                    type="text"
                    value={saveModalNewTitle}
                    onChange={(e) => setSaveModalNewTitle(e.target.value)}
                    placeholder="Projectnaam..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none focus:border-workx-lime/40"
                    autoFocus
                  />
                  <textarea
                    value={saveModalNewDesc}
                    onChange={(e) => setSaveModalNewDesc(e.target.value)}
                    placeholder="Beschrijving (optioneel)..."
                    rows={2}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-workx-lime/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={createProjectAndSave}
                      disabled={!saveModalNewTitle.trim() || isSavingToProject}
                      className="flex-1 px-4 py-2 rounded-lg bg-workx-lime text-workx-dark text-sm font-medium hover:bg-workx-lime/90 transition-colors disabled:opacity-50"
                    >
                      {isSavingToProject ? 'Opslaan...' : 'Aanmaken & opslaan'}
                    </button>
                    <button
                      onClick={() => setSaveModalNewProject(false)}
                      disabled={isSavingToProject}
                      className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}

              {/* Existing projects */}
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => saveConversationToProject(project.id)}
                  disabled={isSavingToProject}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition-all text-left disabled:opacity-50"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: project.color + '20' }}
                  >
                    <Icons.briefcase size={16} style={{ color: project.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{project.title}</p>
                    <p className="text-[11px] text-white/30">
                      {project._count.conversations} chat{project._count.conversations !== 1 ? 's' : ''} · {project._count.documents} doc{project._count.documents !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Icons.arrowRight size={14} className="text-white/20 flex-shrink-0" />
                </button>
              ))}

              {projects.length === 0 && !saveModalNewProject && (
                <p className="text-center text-xs text-white/25 py-4">Nog geen projecten. Maak er een aan.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help & uitleg modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setShowHelp(false)} />
          <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] rounded-3xl bg-gradient-to-b from-workx-gray to-workx-dark border border-white/10 shadow-2xl overflow-hidden">
            {/* Header with gradient */}
            <div className="relative p-8 pb-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-workx-lime/10 rounded-full blur-[80px]" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-blue-500/20 border border-workx-lime/20 flex items-center justify-center">
                    <Icons.sparkles size={28} className="text-workx-lime" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Assistent — Handleiding</h2>
                    <p className="text-sm text-white/40 mt-0.5">Alles wat je moet weten om het maximale eruit te halen</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-2 rounded-xl text-white/30 hover:text-white hover:bg-white/10 transition-all"
                >
                  <Icons.x size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-8 pb-8 overflow-y-auto max-h-[calc(85vh-120px)] space-y-6">
              {/* Feature cards */}
              {[
                {
                  icon: '💬',
                  title: 'Vragen stellen',
                  desc: 'Stel juridische vragen in gewoon Nederlands. De AI doorzoekt automatisch 5 gezaghebbende bronnen met bijna 48.000 passages: T&C Arbeidsrecht, Thematica, VAAN AR Updates, RAR (2000-2026) en rechtspraak.nl.',
                  tips: ['Hoe specifieker je vraag, hoe beter het antwoord', 'Noem relevante wetsartikelen als je die kent', 'Vraag expliciet om jurisprudentie als je die nodig hebt'],
                },
                {
                  icon: '📄',
                  title: 'Documenten uploaden',
                  desc: 'Upload PDF, Word (DOCX), afbeeldingen (PNG/JPG) of tekstbestanden. De AI analyseert documenten automatisch en kan ze vergelijken.',
                  tips: ['Upload meerdere documenten tegelijk om ze te vergelijken', 'PDFs tot 32MB worden direct door Claude gelezen', 'Word-documenten kunnen door de AI worden bewerkt — je krijgt een download-knop'],
                },
                {
                  icon: '⚖️',
                  title: 'Rechtspraak zoeken',
                  desc: 'De AI doorzoekt automatisch rechtspraak.nl en leest relevante uitspraken volledig. Alle ECLI-nummers worden geverifieerd.',
                  tips: ['De AI doet minimaal 2 zoekopdrachten met verschillende termen', 'ECLI-nummers uit de kennisbronnen (RAR/VAAN) zijn redactioneel geverifieerd', 'Niet-geverifieerde ECLIs worden gemarkeerd met een waarschuwing'],
                },
                {
                  icon: '🧠',
                  title: 'Model kiezen',
                  desc: 'Kies tussen Sonnet (snel, goed voor de meeste vragen) en Opus (diepgaand, voor complexe analyses). Gebruik de model-selector rechtsonder in het chatvenster.',
                  tips: ['Sonnet: ideaal voor snelle vragen en standaard-analyses', 'Opus: voor complexe juridische analyses met meerdere perspectieven', 'Opus denkt langer na maar geeft grondigere antwoorden'],
                },
                {
                  icon: '📁',
                  title: 'Projecten',
                  desc: 'Organiseer gesprekken en documenten per dossier in projecten. Deel projecten met collega\'s. De AI onthoudt eerdere gesprekken binnen een project.',
                  tips: ['Sla een gesprek op in een project via het menu (drie puntjes) in de sidebar', 'Teamleden die je toevoegt kunnen het project ook zien', 'De AI gebruikt eerdere gesprekken als context'],
                },
                {
                  icon: '📝',
                  title: 'Templates',
                  desc: 'Gebruik juridische templates voor veelvoorkomende documenten. De AI vult ze in op basis van de informatie die je geeft.',
                  tips: ['Ga naar het Templates-tabblad om beschikbare templates te zien', 'Upload eigen templates om ze door de AI te laten invullen', 'Geef de AI alle relevante feiten zodat het template volledig ingevuld wordt'],
                },
                {
                  icon: '🔒',
                  title: 'Privacy & Anonimisatie',
                  desc: 'Activeer de anonimiseerfunctie om persoonsgegevens automatisch te vervangen door placeholders voordat ze naar de AI gestuurd worden.',
                  tips: ['De schakelaar staat linksonder in het chatvenster', 'Namen, BSN-nummers en adressen worden automatisch vervangen', 'De AI antwoordt met dezelfde placeholders'],
                },
                {
                  icon: '📚',
                  title: 'Bronnen aan/uit',
                  desc: 'De AI detecteert automatisch of je vraag arbeidsrecht betreft. Voor niet-juridische vragen worden kennisbronnen overgeslagen (sneller antwoord). Je kunt dit ook handmatig in-/uitschakelen.',
                  tips: ['De "Bronnen" toggle staat naast de model-selector', 'Zet bronnen uit voor niet-juridische vragen zoals e-mails schrijven of vertalingen', 'Zet bronnen aan als de auto-detectie een juridische vraag mist'],
                },
              ].map((feature, i) => (
                <div key={i} className="group rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 hover:bg-white/[0.05] transition-all duration-300 overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl flex-shrink-0 mt-0.5">{feature.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white mb-1.5">{feature.title}</h3>
                        <p className="text-xs text-white/50 leading-relaxed mb-3">{feature.desc}</p>
                        <div className="space-y-1.5">
                          {feature.tips.map((tip, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <div className="w-1 h-1 rounded-full bg-workx-lime/50 mt-1.5 flex-shrink-0" />
                              <span className="text-[11px] text-white/35 leading-relaxed">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Keyboard shortcuts */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>⌨️</span> Sneltoetsen
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Enter', 'Vraag versturen'],
                    ['Shift + Enter', 'Nieuwe regel'],
                    ['Escape', 'Stop antwoord'],
                  ].map(([key, action]) => (
                    <div key={key} className="flex items-center gap-3 text-xs">
                      <kbd className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-white/60 font-mono text-[10px]">{key}</kbd>
                      <span className="text-white/40">{action}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer note */}
              <div className="text-center pt-2 pb-1">
                <p className="text-[11px] text-white/20">
                  Aangedreven door Claude (Anthropic) met 47.894 passages uit 5 juridische bronnen
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
