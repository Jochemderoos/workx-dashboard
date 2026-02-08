'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'
import ClaudeChat from '@/components/claude/ClaudeChat'
import ProjectCard from '@/components/claude/ProjectCard'
import DocumentUploader from '@/components/claude/DocumentUploader'
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

interface Document {
  id: string
  name: string
  fileType: string
  fileSize: number
  createdAt: string
}

interface Conversation {
  id: string
  title: string
  projectId: string | null
  updatedAt: string
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
  const [documents, setDocuments] = useState<Document[]>([])
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'projects' | 'kennisbank' | 'bronnen' | 'templates'>('chat')
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

  useEffect(() => {
    Promise.all([
      fetch('/api/claude/projects').then(r => r.json()),
      fetch('/api/claude/documents?projectId=null').then(r => r.json()),
    ]).then(([projectsData, docsData]) => {
      setProjects(projectsData)
      setDocuments(docsData)
    }).catch(() => {
      toast.error('Kon data niet laden')
    }).finally(() => {
      setIsLoading(false)
    })
  }, [])

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const deleteDocument = async (id: string) => {
    try {
      await fetch(`/api/claude/documents/${id}`, { method: 'DELETE' })
      setDocuments(documents.filter(d => d.id !== id))
      toast.success('Document verwijderd')
    } catch {
      toast.error('Kon document niet verwijderen')
    }
  }

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    )
  }

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  )

  const tabs = [
    { id: 'chat' as const, label: 'Chat', desc: 'Snel een vraag stellen', icon: Icons.chat },
    { id: 'projects' as const, label: 'Projecten', desc: 'Dossiers & zaken', icon: Icons.briefcase, count: projects.length },
    { id: 'kennisbank' as const, label: 'Kennisbank', desc: 'Gedeelde documenten', icon: Icons.books, count: documents.length },
    { id: 'bronnen' as const, label: 'Bronnen', desc: 'Juridische bronnen', icon: Icons.database },
    { id: 'templates' as const, label: 'Templates', desc: 'Document sjablonen', icon: Icons.fileText },
  ]

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-workx-gray via-workx-dark to-workx-gray border border-white/10 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-workx-lime/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[80px]" />

        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-workx-lime/20 to-workx-lime/5 flex items-center justify-center border border-workx-lime/20">
                <Icons.sparkles size={24} className="text-workx-lime" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">AI Assistent</h1>
                <p className="text-sm text-white/40">Juridische AI voor Workx Advocaten</p>
              </div>
            </div>
            <p className="text-sm text-white/30 max-w-xl leading-relaxed">
              Stel vragen over arbeidsrecht, analyseer documenten, zoek rechtspraak, en laat berekeningen maken.
              Organiseer je werk in projecten per dossier of cliënt.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/20">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Claude Sonnet 4.5
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Prominent & Sticky */}
      <div className="grid grid-cols-5 gap-2 sticky top-0 z-30 bg-workx-dark py-2 -my-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center gap-1.5 px-3 py-3.5 rounded-xl text-center transition-all ${
              activeTab === tab.id
                ? 'bg-workx-lime text-workx-dark shadow-lg shadow-workx-lime/20'
                : 'bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/[0.06] hover:border-white/20'
            }`}
          >
            <tab.icon size={20} />
            <div className="flex items-center gap-1.5">
              <span className={`text-sm ${activeTab === tab.id ? 'font-semibold' : 'font-medium'}`}>
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
            <span className={`text-[10px] leading-tight ${
              activeTab === tab.id ? 'text-workx-dark/60' : 'text-white/25'
            }`}>
              {tab.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Content based on active tab */}
      {activeTab === 'chat' && (
        <div className="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden" style={{ height: '600px' }}>
          <ClaudeChat
            onConversationCreated={handleConversationCreated}
          />
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

      {activeTab === 'kennisbank' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60">Kennisbank</p>
              <p className="text-xs text-white/30">Gedeelde documenten beschikbaar in alle gesprekken</p>
            </div>
          </div>

          <DocumentUploader
            onUpload={(doc) => setDocuments([doc as Document, ...documents])}
          />

          {/* Document list */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/30">
                    <Icons.file size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate">{doc.name}</p>
                    <p className="text-[11px] text-white/30">
                      {doc.fileType.toUpperCase()} · {formatFileSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                    title="Verwijderen"
                  >
                    <Icons.trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl bg-white/[0.02] border border-white/10 p-8 text-center">
              <p className="text-sm text-white/30">Nog geen documenten in de kennisbank</p>
              <p className="text-xs text-white/20 mt-1">Upload documenten die je in alle gesprekken wilt gebruiken</p>
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
    </div>
  )
}
