'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Icons } from '@/components/ui/Icons'
import { searchIndex, buildSearchIndex, type SearchHit, type SearchItem } from '@/lib/search-index'

// ---------------------------------------------------------------------------
// Types (legacy — staat hier voor het oude defaults-block alleen; live data
// komt uit search-index)
// ---------------------------------------------------------------------------

type CategoryKey = 'navigatie' | 'acties' | 'zoeken'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  href: string
  category: CategoryKey
  keywords?: string[]
}

// ── Vaak-gezocht suggesties bij lege query ────────────────────────────────
// Pages die mensen vaak nodig hebben — toont meteen iets nuttigs bij open.
const DEFAULT_SUGGESTIONS = [
  '/dashboard/office',
  '/dashboard/declaraties',
  '/dashboard/vakanties',
  '/dashboard/agenda',
  '/dashboard/hr-docs',
  '/dashboard/workx-uitjes',
]

// Icon per kind voor visuele snelheid
const KIND_ICON = {
  page: Icons.layers,
  doc: Icons.fileText,
  factoid: Icons.info ?? Icons.sparkles,
  action: Icons.sparkles,
  person: Icons.user,
  detail: Icons.bookmark ?? Icons.fileText,
} as const

const KIND_LABEL = {
  page: 'Pagina',
  doc: 'Document',
  factoid: 'Gegevens',
  action: 'Actie',
  person: 'Persoon',
  detail: 'Record',
} as const

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAVIGATION_ITEMS: CommandItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Overzicht van alles',
    icon: Icons.home,
    href: '/dashboard',
    category: 'navigatie',
    keywords: ['home', 'start', 'overzicht'],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    description: 'Bekijk je kalender',
    icon: Icons.calendar,
    href: '/dashboard/agenda',
    category: 'navigatie',
    keywords: ['kalender', 'events', 'afspraken', 'planning'],
  },
  {
    id: 'bonus',
    label: 'Bonus Calculator',
    description: 'Bereken je bonus',
    icon: Icons.euro,
    href: '/dashboard/bonus',
    category: 'navigatie',
    keywords: ['berekenen', 'geld', 'provisie', 'omzet'],
  },
  {
    id: 'vakanties',
    label: 'Vakantie Overzicht',
    description: 'Verlof en vakanties beheren',
    icon: Icons.sun,
    href: '/dashboard/vakanties',
    category: 'navigatie',
    keywords: ['verlof', 'vrij', 'vakantie', 'afwezig', 'dagen'],
  },
  {
    id: 'werk',
    label: 'Werk & Taken',
    description: 'Zaken en dossiers',
    icon: Icons.briefcase,
    href: '/dashboard/werk',
    category: 'navigatie',
    keywords: ['taken', 'zaken', 'projecten', 'dossiers', 'werk'],
  },
  {
    id: 'lustrum',
    label: 'Lustrum 2026',
    description: '15 jaar Workx vieren',
    icon: Icons.star,
    href: '/dashboard/lustrum',
    category: 'navigatie',
    keywords: ['feest', 'jubileum', 'mallorca', 'reis', 'party'],
  },
  {
    id: 'chat',
    label: 'Chat',
    description: 'Berichten en gesprekken',
    icon: Icons.chat,
    href: '/dashboard/chat',
    category: 'navigatie',
    keywords: ['berichten', 'gesprek', 'slack', 'communicatie'],
  },
  {
    id: 'appjeplekje',
    label: 'Appjeplekje',
    description: 'Werkplek reserveren',
    icon: Icons.mapPin,
    href: '/dashboard/appjeplekje',
    category: 'navigatie',
    keywords: ['kantoor', 'werkplek', 'plek', 'reserveren', 'aanmelden'],
  },
  {
    id: 'werkdruk',
    label: 'Werkdruk',
    description: 'Werkdruk inzicht',
    icon: Icons.activity,
    href: '/dashboard/werkdruk',
    category: 'navigatie',
    keywords: ['druk', 'stress', 'balans', 'capaciteit'],
  },
  {
    id: 'financien',
    label: 'Financi\u00ebn',
    description: 'Financieel overzicht',
    icon: Icons.pieChart,
    href: '/dashboard/financien',
    category: 'navigatie',
    keywords: ['geld', 'salaris', 'budget', 'kosten', 'declaratie'],
  },
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Geef en bekijk feedback',
    icon: Icons.chat,
    href: '/dashboard/feedback',
    category: 'navigatie',
    keywords: ['idee', 'bug', 'suggestie', 'melding'],
  },
  {
    id: 'profiel',
    label: 'Profiel',
    description: 'Je profiel bekijken',
    icon: Icons.user,
    href: '/dashboard/profiel',
    category: 'navigatie',
    keywords: ['account', 'instellingen', 'gegevens'],
  },
  {
    id: 'workxflow',
    label: 'Workxflow',
    description: 'Processen en workflows',
    icon: Icons.layers,
    href: '/dashboard/workxflow',
    category: 'navigatie',
    keywords: ['proces', 'flow', 'workflow', 'automatisering'],
  },
]

const ACTION_ITEMS: CommandItem[] = [
  {
    id: 'vakantie-aanvragen',
    label: 'Vakantie aanvragen',
    description: 'Vraag verlof aan',
    icon: Icons.sun,
    href: '/dashboard/vakanties',
    category: 'acties',
    keywords: ['verlof', 'vrij', 'aanvragen', 'vakantie'],
  },
  {
    id: 'feedback-geven',
    label: 'Feedback geven',
    description: 'Deel je idee of melding',
    icon: Icons.edit,
    href: '/dashboard/feedback',
    category: 'acties',
    keywords: ['idee', 'melding', 'suggestie'],
  },
  {
    id: 'ziekmelding',
    label: 'Ziekmelding',
    description: 'Meld je ziek',
    icon: Icons.alertCircle,
    href: '/dashboard/ziektedagen',
    category: 'acties',
    keywords: ['ziek', 'afwezig', 'melden'],
  },
]

const ALL_ITEMS: CommandItem[] = [...NAVIGATION_ITEMS, ...ACTION_ITEMS]

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  navigatie: 'NAVIGATIE',
  acties: 'ACTIES',
  zoeken: 'ZOEKEN',
}

const CATEGORY_ORDER: CategoryKey[] = ['navigatie', 'acties', 'zoeken']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return fragments where matches are wrapped in a highlight span. */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase().trim()
  const idx = lowerText.indexOf(lowerQuery)

  if (idx === -1) return text

  const before = text.slice(0, idx)
  const match = text.slice(idx, idx + lowerQuery.length)
  const after = text.slice(idx + lowerQuery.length)

  return (
    <>
      {before}
      <span className="text-[#f9ff85] font-semibold">{match}</span>
      {after}
    </>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // ---- Global keyboard shortcut (Cmd+K / Ctrl+K) ----
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // ---- External trigger (HomeSearchBar dispatcht 'workx:open-search') ----
  useEffect(() => {
    const handleOpenSearch = (e: Event) => {
      setIsOpen(true)
      const detail = (e as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.length > 0) {
        setQuery(detail)
      }
    }
    window.addEventListener('workx:open-search', handleOpenSearch as EventListener)
    return () => window.removeEventListener('workx:open-search', handleOpenSearch as EventListener)
  }, [])

  // ---- Search via index (deep content + synoniemen + ranking) ----
  const searchHits = useMemo<SearchHit[]>(() => {
    if (!query.trim()) {
      const index = buildSearchIndex()
      // Toon vaak-gezochte pages als suggesties bij lege query
      const suggestions: SearchHit[] = []
      for (const href of DEFAULT_SUGGESTIONS) {
        const item = index.find(i => i.href === href)
        if (item) suggestions.push({ item, score: 0, matchedField: 'label' })
      }
      return suggestions
    }
    return searchIndex(query, 15)
  }, [query])

  // ---- AI-fallback: alleen aanroepen bij vage / zwakke matches ----
  const [aiSuggestions, setAiSuggestions] = useState<{ href: string; label: string; reason: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const aiAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    // Skip als er een goeie match is, of als query te kort
    const trimmed = query.trim()
    if (trimmed.length < 3) { setAiSuggestions([]); return }
    const topScore = searchHits[0]?.score || 0
    const hasGoodMatch = topScore >= 60 && searchHits.length >= 2
    if (hasGoodMatch) { setAiSuggestions([]); return }

    // Debounce 600ms
    const t = setTimeout(() => {
      if (aiAbortRef.current) aiAbortRef.current.abort()
      const ctrl = new AbortController()
      aiAbortRef.current = ctrl
      setAiLoading(true)
      fetch('/api/search/ai-fallback', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      })
        .then(r => r.ok ? r.json() : { suggestions: [] })
        .then(data => {
          setAiSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
        })
        .catch(() => setAiSuggestions([]))
        .finally(() => setAiLoading(false))
    }, 600)
    return () => clearTimeout(t)
  }, [query, searchHits])

  // ---- Group by section (uit de search-index, niet meer hardcoded) ----
  const groupedHits = useMemo(() => {
    const map = new Map<string, SearchHit[]>()
    const order: string[] = []
    for (const hit of searchHits) {
      const sec = hit.item.section || 'Overig'
      if (!map.has(sec)) { map.set(sec, []); order.push(sec) }
      map.get(sec)!.push(hit)
    }
    return { order, map }
  }, [searchHits])

  // Flat list for keyboard nav (volgorde gelijk aan render)
  const flatItems = useMemo(() => {
    const items: SearchHit[] = []
    for (const sec of groupedHits.order) items.push(...(groupedHits.map.get(sec) || []))
    return items
  }, [groupedHits])

  // ---- Reset on open / query change ----
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchHits])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Small delay for DOM to mount before focus
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  // ---- Scroll selected into view ----
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-cmd-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // ---- Execute (hit → navigate) ----
  const executeHit = useCallback(
    (hit: SearchHit) => {
      router.push(hit.item.href)
      setIsOpen(false)
    },
    [router],
  )

  // ---- Keyboard navigation inside palette ----
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % Math.max(flatItems.length, 1))
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + flatItems.length) % Math.max(flatItems.length, 1))
          break
        }
        case 'Enter': {
          e.preventDefault()
          const target = flatItems[selectedIndex]
          if (target) executeHit(target)
          break
        }
        case 'Escape': {
          e.preventDefault()
          setIsOpen(false)
          break
        }
      }
    },
    [flatItems, selectedIndex, executeHit],
  )

  // ---- Render helpers ----
  let runningIndex = 0

  function renderSection(sectionName: string) {
    const hits = groupedHits.map.get(sectionName) || []
    if (hits.length === 0) return null

    return (
      <div key={sectionName} className="mb-1">
        {/* Section header */}
        <div className="px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase select-none">
          {sectionName}
        </div>

        {hits.map((hit) => {
          const idx = runningIndex++
          const isSelected = idx === selectedIndex
          const Icon = KIND_ICON[hit.item.kind]
          const kindLabel = KIND_LABEL[hit.item.kind]

          return (
            <button
              key={hit.item.id}
              data-cmd-index={idx}
              onClick={() => executeHit(hit)}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`
                group w-full flex items-start gap-3 px-4 py-2.5 text-left
                transition-all duration-100 ease-out
                ${isSelected ? 'bg-white/[0.06]' : 'bg-transparent hover:bg-white/[0.03]'}
              `}
            >
              {/* Icon container */}
              <div
                className={`
                  w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5
                  transition-colors duration-100
                  ${isSelected ? 'bg-[#f9ff85]/15 text-[#f9ff85]' : 'bg-white/[0.06] text-white/50'}
                `}
              >
                <Icon size={16} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`
                      text-[13px] font-medium truncate transition-colors duration-100
                      ${isSelected ? 'text-white' : 'text-white/85'}
                    `}
                  >
                    {highlightMatch(hit.item.label, query)}
                  </p>
                  {/* Kind badge — alleen voor doc/factoid/action zodat pages clean blijven */}
                  {hit.item.kind !== 'page' && (
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded bg-white/[0.06] text-white/40 flex-shrink-0">
                      {kindLabel}
                    </span>
                  )}
                </div>
                {hit.item.description && (
                  <p className="text-[11px] text-white/40 truncate mt-0.5">
                    {highlightMatch(hit.item.description, query)}
                  </p>
                )}
                {/* Body-snippet bij content-match (alleen voor docs) */}
                {hit.snippet && (
                  <p className="text-[11px] text-white/45 mt-1 italic line-clamp-2">
                    {highlightMatch(hit.snippet, query)}
                  </p>
                )}
                {/* "Waarom?" — alleen tonen bij synoniem-match zodat user leert wat te typen */}
                {hit.matchedField === 'synonym' && query.trim() && (
                  <p className="text-[10px] text-[#f9ff85]/50 mt-1">
                    via synoniem
                  </p>
                )}
              </div>

              {/* Arrow hint on selected */}
              {isSelected && (
                <div className="flex-shrink-0 text-white/20 mt-1.5">
                  <Icons.arrowRight size={14} />
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* ---- Floating badge hint (visible when palette is closed) ---- */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(true)}
            className="
              fixed bottom-5 right-5 z-[9990]
              flex items-center gap-1.5 px-3 py-1.5
              bg-white/[0.06] hover:bg-white/[0.10]
              border border-white/[0.08] hover:border-white/[0.15]
              rounded-lg backdrop-blur-md
              text-white/40 hover:text-white/60
              transition-all duration-200 ease-out
              shadow-lg shadow-black/20
              cursor-pointer select-none
            "
            aria-label="Open command palette"
          >
            <Icons.command size={13} className="opacity-70" />
            <span className="text-[11px] font-medium tracking-wide">K</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ---- Command palette overlay + modal ---- */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="cmd-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Palette container */}
            <motion.div
              key="cmd-palette"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
              className="
                fixed inset-0 z-[9999]
                flex items-start justify-center
                pt-[min(20vh,180px)] px-4
                pointer-events-none
              "
            >
              <div
                className="
                  pointer-events-auto
                  w-full max-w-[560px]
                  bg-[#232323]/[0.98]
                  border border-white/[0.08]
                  rounded-2xl
                  shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04),0_0_80px_-20px_rgba(249,255,133,0.07)]
                  backdrop-blur-xl
                  overflow-hidden
                  flex flex-col
                "
                role="dialog"
                aria-modal="true"
                aria-label="Command palette"
              >
                {/* ---- Search input ---- */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
                  <Icons.search size={18} className="text-white/30 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Zoek in alles — pagina's, kantoorgegevens, hr-docs, IBAN..."
                    className="
                      flex-1 bg-transparent text-[15px] text-white
                      placeholder-white/30 outline-none
                      caret-[#f9ff85]
                    "
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] text-white/25 bg-white/[0.05] rounded border border-white/[0.06] font-mono">
                    ESC
                  </kbd>
                </div>

                {/* ---- Results list ---- */}
                <div
                  ref={listRef}
                  className="flex-1 overflow-y-auto overscroll-contain py-1.5"
                  style={{ maxHeight: 'min(420px, 50vh)' }}
                >
                  {flatItems.length === 0 && aiSuggestions.length === 0 && !aiLoading ? (
                    <div className="flex flex-col items-center justify-center py-14 px-4">
                      <Icons.search size={28} className="text-white/10 mb-3" />
                      <p className="text-[13px] text-white/30">
                        Geen resultaten voor &ldquo;{query}&rdquo;
                      </p>
                      <p className="text-[11px] text-white/15 mt-1 text-center max-w-[260px]">
                        Probeer een andere term — bv. &ldquo;kantoor&rdquo;, &ldquo;IBAN&rdquo;, &ldquo;verlof&rdquo;, &ldquo;declaratie&rdquo;
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Bij lege query: kop boven de suggesties */}
                      {!query.trim() && (
                        <div className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-[0.08em] text-white/30 uppercase select-none">
                          Vaak gezocht
                        </div>
                      )}
                      {/* Reset running index before rendering */}
                      {(() => { runningIndex = 0; return null })()}
                      {query.trim() ? (
                        groupedHits.order.map((sec) => (
                          <Fragment key={sec}>{renderSection(sec)}</Fragment>
                        ))
                      ) : (
                        // Bij lege query: 1 flat list zonder section-headers
                        <div>
                          {flatItems.map((hit) => {
                            const idx = runningIndex++
                            const isSelected = idx === selectedIndex
                            const Icon = KIND_ICON[hit.item.kind]
                            return (
                              <button
                                key={hit.item.id}
                                data-cmd-index={idx}
                                onClick={() => executeHit(hit)}
                                onMouseEnter={() => setSelectedIndex(idx)}
                                className={`group w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-100 ease-out ${isSelected ? 'bg-white/[0.06]' : 'bg-transparent hover:bg-white/[0.03]'}`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-100 ${isSelected ? 'bg-[#f9ff85]/15 text-[#f9ff85]' : 'bg-white/[0.06] text-white/50'}`}>
                                  <Icon size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[13px] font-medium truncate ${isSelected ? 'text-white' : 'text-white/85'}`}>
                                    {hit.item.label}
                                  </p>
                                  {hit.item.description && (
                                    <p className="text-[11px] text-white/40 truncate mt-0.5">{hit.item.description}</p>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}

                      {/* ---- AI-suggesties — verschijnen bij vage queries ---- */}
                      {query.trim().length >= 3 && (aiLoading || aiSuggestions.length > 0) && (
                        <div className="border-t border-white/[0.05] mt-2 pt-2">
                          <div className="px-4 pt-1 pb-1 text-[10px] font-semibold tracking-[0.08em] text-[#f9ff85]/70 uppercase select-none flex items-center gap-1.5">
                            <Icons.sparkles size={11} className="text-[#f9ff85]/70" />
                            AI-suggestie
                            {aiLoading && (
                              <span className="ml-1 w-2.5 h-2.5 border-[1.5px] border-[#f9ff85]/30 border-t-[#f9ff85]/80 rounded-full animate-spin" />
                            )}
                          </div>
                          {aiSuggestions.map((s) => (
                            <button
                              key={`ai:${s.href}`}
                              onClick={() => { router.push(s.href); setIsOpen(false) }}
                              className="group w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 bg-[#f9ff85]/10 text-[#f9ff85]">
                                <Icons.sparkles size={14} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-white/85 truncate">
                                  {s.label}
                                </p>
                                <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">
                                  {s.reason}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ---- Footer with keyboard shortcuts ---- */}
                <div className="flex items-center justify-between gap-4 px-4 py-2.5 border-t border-white/[0.05] bg-white/[0.01]">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1 text-[10px] text-white/25">
                      <kbd className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-white/[0.06] text-[10px] font-mono leading-none">&uarr;</kbd>
                      <kbd className="inline-flex items-center justify-center w-[18px] h-[18px] rounded bg-white/[0.06] text-[10px] font-mono leading-none">&darr;</kbd>
                      <span className="ml-0.5">navigeren</span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-white/25">
                      <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-white/[0.06] text-[10px] font-mono leading-none">&crarr;</kbd>
                      <span className="ml-0.5">selecteer</span>
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] text-white/25">
                    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-white/[0.06] text-[10px] font-mono leading-none">esc</kbd>
                    <span className="ml-0.5">sluiten</span>
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
