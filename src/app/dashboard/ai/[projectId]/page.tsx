'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Icons } from '@/components/ui/Icons'
import toast from 'react-hot-toast'
import ClaudeChat from '@/components/claude/ClaudeChat'
import DocumentUploader from '@/components/claude/DocumentUploader'
import LegalQuickActions from '@/components/claude/LegalQuickActions'

interface Project {
  id: string
  title: string
  description: string | null
  icon: string
  color: string
  status: string
  conversations: Conversation[]
  documents: ProjectDocument[]
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

const PROJECT_ICONS: Record<string, string> = {
  folder: '📁', briefcase: '💼', scale: '⚖️', document: '📄',
  gavel: '🔨', shield: '🛡️', building: '🏢', people: '👥',
  contract: '📝', money: '💰', clock: '⏰', warning: '⚠️',
  star: '⭐', fire: '🔥', lock: '🔒',
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  // Fetch project data
  useEffect(() => {
    fetchProject()
  }, [projectId])

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

      // Auto-select all document IDs for context
      setSelectedDocIds(data.documents.map((d: ProjectDocument) => d.id))

      // Load most recent conversation if exists
      if (data.conversations.length > 0 && !activeConvId) {
        loadConversation(data.conversations[0].id)
      }
    } catch {
      toast.error('Kon project niet laden')
      router.push('/dashboard/ai')
    } finally {
      setIsLoading(false)
    }
  }

  const loadConversation = async (convId: string) => {
    setActiveConvId(convId)
    setMessages([]) // Clear while loading

    try {
      // Fetch messages for conversation - we need a simple endpoint
      // For now we load from the chat API by fetching conversation messages
      const res = await fetch(`/api/claude/chat?conversationId=${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch {
      // If no dedicated endpoint, start with empty
      setMessages([])
    }
  }

  const startNewConversation = () => {
    setActiveConvId(null)
    setMessages([])
  }

  const handleConversationCreated = (id: string) => {
    setActiveConvId(id)
    // Refresh project to get updated conversation list
    fetchProject()
  }

  const [quickActionPrompt, setQuickActionPrompt] = useState<string | null>(null)

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
        setIsEditingTitle(false)
        toast.success('Project bijgewerkt')
      }
    } catch {
      toast.error('Kon project niet bijwerken')
    }
  }

  const deleteProject = async () => {
    if (!confirm('Weet je zeker dat je dit project wilt verwijderen? Alle gesprekken en documenten worden verwijderd.')) return

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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex items-center gap-3 text-white/40">
          <div className="animate-spin">
            <Icons.refresh size={20} />
          </div>
          <span>Project laden...</span>
        </div>
      </div>
    )
  }

  if (!project) return null

  const displayIcon = PROJECT_ICONS[project.icon] || project.icon

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0 -mx-6 -mt-6">
      {/* Left Sidebar: Conversations */}
      <div className="w-64 flex-shrink-0 border-r border-white/5 flex flex-col bg-white/[0.01]">
        {/* Project header */}
        <div className="p-4 border-b border-white/5">
          <button
            onClick={() => router.push('/dashboard/ai')}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors mb-3"
          >
            <Icons.chevronLeft size={12} />
            Alle projecten
          </button>

          <div className="flex items-center gap-2">
            <span className="text-lg">{displayIcon}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-medium text-white truncate">{project.title}</h2>
              {project.description && (
                <p className="text-[11px] text-white/30 truncate">{project.description}</p>
              )}
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-colors"
            >
              <Icons.settings size={14} />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="p-4 border-b border-white/5 space-y-3 bg-white/[0.02] animate-fade-in">
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
              <button
                onClick={updateProject}
                className="px-3 py-1.5 rounded-lg bg-workx-lime text-workx-dark text-[11px] font-medium hover:bg-workx-lime/90 transition-colors"
              >
                Opslaan
              </button>
              <button
                onClick={deleteProject}
                className="px-3 py-1.5 rounded-lg text-[11px] text-red-400/70 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        )}

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="px-2 py-1.5 text-[10px] text-white/25 uppercase tracking-wider font-medium">
            Gesprekken ({project.conversations.length})
          </p>

          {project.conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                activeConvId === conv.id
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <p className="truncate">{conv.title}</p>
              <p className="text-[10px] text-white/20 mt-0.5">
                {conv._count.messages} berichten
              </p>
            </button>
          ))}
        </div>

        {/* New conversation button */}
        <div className="p-3 border-t border-white/5">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/10 transition-all"
          >
            <Icons.plus size={14} />
            Nieuw gesprek
          </button>
        </div>
      </div>

      {/* Center: Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <ClaudeChat
          conversationId={activeConvId}
          projectId={projectId}
          documentIds={selectedDocIds}
          initialMessages={messages}
          onConversationCreated={handleConversationCreated}
          onNewMessage={fetchProject}
          placeholder={`Vraag iets over ${project.title}...`}
          quickActionPrompt={quickActionPrompt}
          onQuickActionHandled={() => setQuickActionPrompt(null)}
        />
      </div>

      {/* Right Sidebar: Documents & Quick Actions */}
      <div className="w-72 flex-shrink-0 border-l border-white/5 flex flex-col bg-white/[0.01] overflow-y-auto">
        {/* Project documents */}
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-white/25 uppercase tracking-wider font-medium">
              Documenten ({project.documents.length})
            </p>
          </div>

          {/* Upload */}
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

          {/* Document list */}
          <div className="mt-3 space-y-1">
            {project.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              >
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
                <Icons.file size={13} className="text-white/25 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/60 truncate">{doc.name}</p>
                  <p className="text-[9px] text-white/20">{formatFileSize(doc.fileSize)}</p>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1 rounded text-white/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Icons.trash size={11} />
                </button>
              </div>
            ))}
          </div>

          {project.documents.length > 0 && (
            <p className="text-[9px] text-white/15 mt-2 px-1">
              Vink documenten aan om ze als context mee te sturen in de chat
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 flex-1">
          <LegalQuickActions
            onAction={(prompt) => setQuickActionPrompt(prompt)}
            hasDocuments={selectedDocIds.length > 0}
          />
        </div>

        {/* Disclaimer */}
        <div className="p-4 border-t border-white/5">
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
            <p className="text-[10px] text-white/20 leading-relaxed">
              <span className="text-white/30 font-medium">Disclaimer:</span> AI-antwoorden vormen geen juridisch advies.
              Verifieer altijd wetsartikelen en rechtspraak bij de officiële bronnen.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

