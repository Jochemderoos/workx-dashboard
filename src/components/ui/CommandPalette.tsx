'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '@/components/ui/Icons'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  action?: () => void
  href?: string
  category: 'navigation' | 'actions' | 'recent'
  keywords?: string[]
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

const navigationItems: CommandItem[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Ga naar dashboard', icon: Icons.home, href: '/dashboard', category: 'navigation', keywords: ['home', 'start', 'overzicht'] },
  { id: 'lustrum', label: 'Lustrum Mallorca', description: '15 jaar Workx', icon: Icons.palmTree, href: '/dashboard/lustrum', category: 'navigation', keywords: ['feest', 'reis', 'mallorca', 'jubileum'] },
  { id: 'appjeplekje', label: 'Appjeplekje', description: 'Werkplek reserveren', icon: Icons.mapPin, href: '/dashboard/appjeplekje', category: 'navigation', keywords: ['kantoor', 'werkplek', 'aanmelden', 'plek'] },
  { id: 'agenda', label: 'Agenda', description: 'Bekijk kalender', icon: Icons.calendar, href: '/dashboard/agenda', category: 'navigation', keywords: ['events', 'afspraken', 'kalender', 'planning'] },
  { id: 'vakanties', label: 'Vakanties & Verlof', description: 'Verlof beheren', icon: Icons.sun, href: '/dashboard/vakanties', category: 'navigation', keywords: ['vakantie', 'vrij', 'verlof', 'afwezig'] },
  { id: 'werk', label: 'Werk', description: 'Zaken en dossiers', icon: Icons.briefcase, href: '/dashboard/werk', category: 'navigation', keywords: ['taken', 'zaken', 'projecten', 'dossiers'] },
  { id: 'financien', label: 'Financien', description: 'Financieel overzicht', icon: Icons.pieChart, href: '/dashboard/financien', category: 'navigation', keywords: ['geld', 'salaris', 'budget', 'kosten'] },
  { id: 'bonus', label: 'Bonus Calculator', description: 'Bereken je bonus', icon: Icons.euro, href: '/dashboard/bonus', category: 'navigation', keywords: ['bonus', 'berekenen', 'omzet', 'provisie'] },
  { id: 'transitie', label: 'Transitievergoeding', description: 'Transitie berekenen', icon: Icons.calculator, href: '/dashboard/transitie', category: 'navigation', keywords: ['ontslag', 'vergoeding', 'berekenen'] },
  { id: 'afspiegeling', label: 'Afspiegeling', description: 'Afspiegelingstool', icon: Icons.layers, href: '/dashboard/afspiegeling', category: 'navigation', keywords: ['reorganisatie', 'ontslag', 'selectie'] },
  { id: 'pitch', label: 'Pitch Maker', description: 'Maak pitch documenten', icon: Icons.file, href: '/dashboard/pitch', category: 'navigation', keywords: ['pitch', 'pdf', 'document', 'cv', 'team'] },
  { id: 'team', label: 'Team', description: 'Bekijk collega\'s', icon: Icons.users, href: '/dashboard/team', category: 'navigation', keywords: ['collega', 'medewerkers', 'mensen'] },
  { id: 'hr-docs', label: 'Workx Docs', description: 'HR documenten', icon: Icons.books, href: '/dashboard/hr-docs', category: 'navigation', keywords: ['handboek', 'regels', 'hr', 'documenten', 'beleid'] },
  { id: 'feedback', label: 'Feedback', description: 'Geef feedback', icon: Icons.chat, href: '/dashboard/feedback', category: 'navigation', keywords: ['idee', 'bug', 'suggestie', 'melding'] },
  { id: 'settings', label: 'Instellingen', description: 'Account instellingen', icon: Icons.settings, href: '/dashboard/settings', category: 'navigation', keywords: ['profiel', 'wachtwoord', 'account'] },
]

const actionItems: CommandItem[] = [
  { id: 'new-expense', label: 'Nieuwe declaratie', description: 'Declareer onkosten', icon: Icons.plus, href: '/dashboard/financien?action=new-expense', category: 'actions', keywords: ['declaratie', 'onkosten', 'uitgave'] },
  { id: 'request-leave', label: 'Verlof aanvragen', description: 'Vraag vrij aan', icon: Icons.calendar, href: '/dashboard/vakanties?action=request', category: 'actions', keywords: ['verlof', 'vakantie', 'vrij', 'aanvragen'] },
  { id: 'new-feedback', label: 'Feedback geven', description: 'Deel je idee of melding', icon: Icons.chat, href: '/dashboard/feedback?action=new', category: 'actions', keywords: ['feedback', 'idee', 'melding', 'bug'] },
]

export default function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const allItems = [...navigationItems, ...actionItems]

    if (!query.trim()) {
      // Show navigation first, then actions when no query
      return allItems
    }

    const lowerQuery = query.toLowerCase().trim()
    return allItems.filter(item => {
      const matchesLabel = item.label.toLowerCase().includes(lowerQuery)
      const matchesDescription = item.description?.toLowerCase().includes(lowerQuery)
      const matchesKeywords = item.keywords?.some(kw => kw.toLowerCase().includes(lowerQuery))
      return matchesLabel || matchesDescription || matchesKeywords
    })
  }, [query])

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      recent: [],
    }

    filteredItems.forEach(item => {
      groups[item.category].push(item)
    })

    return groups
  }, [filteredItems])

  // Flat list for keyboard navigation
  const flatItems = useMemo(() => {
    return [...groupedItems.navigation, ...groupedItems.actions, ...groupedItems.recent]
  }, [groupedItems])

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const executeItem = useCallback((item: CommandItem) => {
    if (item.action) {
      item.action()
    } else if (item.href) {
      router.push(item.href)
    }
    onClose()
  }, [router, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % flatItems.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length)
        break
      case 'Enter':
        e.preventDefault()
        if (flatItems[selectedIndex]) {
          executeItem(flatItems[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [flatItems, selectedIndex, executeItem, onClose])

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'navigation': return 'Navigatie'
      case 'actions': return 'Snelle acties'
      case 'recent': return 'Recent'
      default: return category
    }
  }

  let itemIndex = 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] command-palette-overlay"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-[9999] w-full max-w-xl mx-4"
          >
            <div className="command-palette overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <Icons.search size={20} className="text-white/40" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Zoek pagina's, acties..."
                  className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-base"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] text-white/30 bg-white/5 rounded border border-white/10">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div
                ref={listRef}
                className="max-h-[400px] overflow-y-auto workx-scrollbar py-2"
              >
                {flatItems.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Icons.search size={24} className="mx-auto mb-2 text-white/20" />
                    <p className="text-white/40 text-sm">Geen resultaten voor "{query}"</p>
                  </div>
                ) : (
                  <>
                    {/* Navigation Section */}
                    {groupedItems.navigation.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
                          {getCategoryLabel('navigation')}
                        </div>
                        {groupedItems.navigation.map((item) => {
                          const currentIndex = itemIndex++
                          const Icon = item.icon
                          return (
                            <button
                              key={item.id}
                              data-index={currentIndex}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(currentIndex)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                selectedIndex === currentIndex
                                  ? 'bg-workx-lime/10'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                selectedIndex === currentIndex
                                  ? 'bg-workx-lime/20 text-workx-lime'
                                  : 'bg-white/5 text-white/60'
                              }`}>
                                <Icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  selectedIndex === currentIndex ? 'text-workx-lime' : 'text-white'
                                }`}>
                                  {item.label}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-white/40 truncate">{item.description}</p>
                                )}
                              </div>
                              {selectedIndex === currentIndex && (
                                <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                  Enter
                                </kbd>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Actions Section */}
                    {groupedItems.actions.length > 0 && (
                      <div className="mb-2">
                        <div className="px-4 py-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
                          {getCategoryLabel('actions')}
                        </div>
                        {groupedItems.actions.map((item) => {
                          const currentIndex = itemIndex++
                          const Icon = item.icon
                          return (
                            <button
                              key={item.id}
                              data-index={currentIndex}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(currentIndex)}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                selectedIndex === currentIndex
                                  ? 'bg-workx-lime/10'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                selectedIndex === currentIndex
                                  ? 'bg-workx-lime/20 text-workx-lime'
                                  : 'bg-white/5 text-white/60'
                              }`}>
                                <Icon size={16} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${
                                  selectedIndex === currentIndex ? 'text-workx-lime' : 'text-white'
                                }`}>
                                  {item.label}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-white/40 truncate">{item.description}</p>
                                )}
                              </div>
                              {selectedIndex === currentIndex && (
                                <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                  Enter
                                </kbd>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-white/5">↑</kbd>
                    <kbd className="px-1 py-0.5 rounded bg-white/5">↓</kbd>
                    <span className="ml-1">navigeren</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white/5">↵</kbd>
                    <span className="ml-1">openen</span>
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/5">esc</kbd>
                  <span className="ml-1">sluiten</span>
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
