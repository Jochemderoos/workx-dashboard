'use client'

// Echte zoekbalk bovenaan dashboard-home: groot, opvallend, direct te
// typen. Geen tussenstap via een popup — resultaten verschijnen meteen
// in een dropdown onder het invoerveld. Workx-lime glow rondom maakt 't
// een eyecatcher in zowel dark als light mode.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Icons } from '@/components/ui/Icons'
import { searchIndex, type SearchHit, type SearchItem } from '@/lib/search-index'

// Vaak-gezochte pages — verschijnen direct bij focus zodat je zonder typen
// kunt klikken naar iets dat je vaak nodig hebt.
const DEFAULT_SUGGESTION_HREFS = [
  '/dashboard/office',
  '/dashboard/declaraties',
  '/dashboard/vakanties',
  '/dashboard/agenda',
  '/dashboard/hr-docs',
  '/dashboard/workx-uitjes',
]

const KIND_ICON = {
  page: Icons.layers,
  doc: Icons.fileText,
  factoid: Icons.info ?? Icons.sparkles,
  action: Icons.sparkles,
  person: Icons.user,
} as const

const KIND_LABEL = {
  page: 'Pagina',
  doc: 'Document',
  factoid: 'Gegevens',
  action: 'Actie',
  person: 'Persoon',
} as const

export default function HomeSearchBar() {
  const router = useRouter()
  const { data: session } = useSession()
  // Privacy: alleen managers (PARTNER/ADMIN/OFFICE_MANAGER) zien mensen-items
  // in zoekresultaten. EMPLOYEE krijgt nooit collega's te zien.
  const hideAllPersons = !['PARTNER', 'ADMIN', 'OFFICE_MANAGER'].includes(
    (session?.user?.role || '') as string,
  )
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [aiSuggestions, setAiSuggestions] = useState<{ href: string; label: string; reason: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [extraItems, setExtraItems] = useState<SearchItem[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  // Dynamische DB-items ophalen (bevriende kantoren, evt. meer). Eenmalig.
  useEffect(() => {
    let aborted = false
    fetch('/api/search/extra-items')
      .then(r => r.ok ? r.json() : { items: [] })
      .then(d => { if (!aborted && Array.isArray(d?.items)) setExtraItems(d.items) })
      .catch(() => {})
    return () => { aborted = true }
  }, [])

  // Resultaten tonen ALLEEN bij echte zoekterm. Geen tip-state.
  const hits: SearchHit[] = useMemo(
    () => query.trim() ? searchIndex(query, 12, { hideAllPersons }, extraItems) : [],
    [query, hideAllPersons, extraItems],
  )
  const showDropdown = focused && query.trim().length > 0
  const totalResults = hits.length + aiSuggestions.length

  // Highlight zoektermen in een tekst
  const highlight = (text: string): React.ReactNode => {
    if (!query.trim()) return text
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)
    if (tokens.length === 0) return text
    const pattern = new RegExp(`(${tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    const parts = text.split(pattern)
    return parts.map((p, i) => {
      const isMatch = tokens.some(t => p.toLowerCase() === t)
      return isMatch ? (
        <span key={i} className="bg-workx-lime/30 text-workx-lime font-semibold rounded px-0.5">{p}</span>
      ) : <span key={i}>{p}</span>
    })
  }

  // AI-fallback bij zwakke / 0 matches
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 3) { setAiSuggestions([]); return }
    const topScore = hits[0]?.score || 0
    if (topScore >= 60 && hits.length >= 2) { setAiSuggestions([]); return }

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
        .then(d => setAiSuggestions(Array.isArray(d?.suggestions) ? d.suggestions : []))
        .catch(() => setAiSuggestions([]))
        .finally(() => setAiLoading(false))
    }, 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Reset selectie bij nieuwe resultaten
  useEffect(() => { setSelectedIndex(0) }, [query])

  // Klik buiten = sluiten
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Ctrl/⌘+K focust de input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Externe trigger (HomeSearchBar's eigen event blijft werken voor consistentie)
  useEffect(() => {
    const handler = (e: Event) => {
      inputRef.current?.focus()
      const detail = (e as CustomEvent<string>).detail
      if (typeof detail === 'string' && detail.length > 0) setQuery(detail)
    }
    window.addEventListener('workx:open-search', handler as EventListener)
    return () => window.removeEventListener('workx:open-search', handler as EventListener)
  }, [])

  const allItems = [
    ...hits.map((h) => ({ type: 'hit' as const, hit: h })),
    ...aiSuggestions.map((s) => ({ type: 'ai' as const, ai: s })),
  ]

  const go = (href: string) => {
    setFocused(false)
    setQuery('')
    router.push(href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((p) => (p + 1) % Math.max(allItems.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((p) => (p - 1 + allItems.length) % Math.max(allItems.length, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const t = allItems[selectedIndex]
      if (t?.type === 'hit') go(t.hit.item.href)
      else if (t?.type === 'ai') go(t.ai.href)
    } else if (e.key === 'Escape') {
      setFocused(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full z-40">
      {/* Buiten-glow: sterke workx-lime gloed. Bij open dropdown UIT zodat
          hij niet door de resultaten heen schijnt. */}
      <div
        className={`absolute -inset-2 rounded-3xl bg-workx-lime/40 blur-2xl transition-opacity duration-500 pointer-events-none ${
          showDropdown ? 'opacity-0' : focused ? 'opacity-100' : 'opacity-80'
        }`}
        aria-hidden
      />
      {/* Secundaire warm-gradient halo */}
      <div
        className={`absolute -inset-3 rounded-3xl bg-gradient-to-r from-rose-400/10 via-workx-lime/30 to-amber-300/10 blur-3xl transition-opacity duration-700 pointer-events-none ${
          showDropdown ? 'opacity-0' : focused ? 'opacity-100' : 'opacity-60'
        }`}
        aria-hidden
      />

      {/* De zoekbalk zelf — schone container. Sterke directe lime drop-shadow
          maakt 'm vanzelf opvallend zonder visible border. */}
      <div
        className={`
          relative flex items-center gap-3 px-5 py-4 rounded-3xl
          transition-shadow duration-200
          ${focused
            ? 'shadow-[0_0_60px_-10px_rgba(249,255,133,0.7),0_15px_50px_-10px_rgba(249,255,133,0.5)]'
            : 'shadow-[0_0_50px_-10px_rgba(249,255,133,0.55),0_10px_40px_-10px_rgba(249,255,133,0.35)]'
          }
        `}
        style={{
          background: 'var(--color-bg-dropdown)',
        }}
      >
        <Icons.search size={20} className="text-workx-lime flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
          placeholder="Zoek hier direct de juiste pagina en informatie"
          className="flex-1 bg-transparent text-base font-medium outline-none placeholder:font-normal border-0"
          style={{
            color: 'var(--color-text-primary)',
            border: 'none',
            boxShadow: 'none',
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            className="p-1 rounded-full hover:bg-workx-lime/10 transition-colors"
            aria-label="Wissen"
            title="Wissen"
          >
            <Icons.x size={14} style={{ color: 'var(--color-text-tertiary)' }} />
          </button>
        )}
        <kbd
          className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono flex-shrink-0"
          style={{
            background: 'var(--color-bg-glass-hover)',
            color: 'var(--color-text-tertiary)',
            border: '1px solid var(--color-border)',
          }}
        >
          Ctrl K
        </kbd>
      </div>

      {/* Resultaten-dropdown. Twee-laagse opaque achtergrond: solid kleur via
          theme-tokens + extra solide hex backstop voor zekerheid dat NIETS
          eronder doorschijnt. z-[100] om boven elke widget te liggen. */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full mt-3 rounded-2xl overflow-hidden z-[100] max-h-[60vh] overflow-y-auto isolate bg-workx-dark dark:bg-workx-dark animate-fade-in"
          style={{
            backgroundColor: 'var(--color-bg-dropdown, #1e1e1e)',
            border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
            boxShadow: '0 30px 80px -10px rgba(0,0,0,0.85), 0 10px 30px -5px rgba(0,0,0,0.6)',
          }}
        >
          {totalResults === 0 && !aiLoading ? (
            <div className="px-5 py-8 text-center">
              <Icons.search size={24} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--color-text-tertiary)' }} />
              <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
                Geen resultaten voor &ldquo;{query}&rdquo;
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Probeer: &ldquo;kantoor&rdquo;, &ldquo;IBAN&rdquo;, &ldquo;verlof&rdquo;, &ldquo;declaratie&rdquo;
              </p>
            </div>
          ) : (
            <div className="py-2">
              {/* Resultaat-count */}
              {totalResults > 0 && (
                <div className="px-4 pt-1 pb-2 text-[10px] font-semibold tracking-[0.08em] uppercase select-none"
                     style={{ color: 'var(--color-text-tertiary)' }}>
                  {totalResults} {totalResults === 1 ? 'resultaat' : 'resultaten'} gevonden
                </div>
              )}
              {hits.map((hit, i) => {
                const Icon = KIND_ICON[hit.item.kind]
                const isSelected = i === selectedIndex
                return (
                  <Link
                    key={hit.item.id}
                    href={hit.item.href}
                    onClick={() => { setFocused(false); setQuery('') }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{
                      background: isSelected ? 'rgba(249, 255, 133, 0.10)' : 'transparent',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{
                        background: isSelected ? 'rgba(249, 255, 133, 0.18)' : 'var(--color-bg-glass-hover)',
                        color: isSelected ? 'var(--workx-lime, #f9ff85)' : 'var(--color-text-tertiary)',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                          {highlight(hit.item.label)}
                        </p>
                        {hit.item.kind !== 'page' && (
                          <span
                            className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded flex-shrink-0"
                            style={{
                              background: 'var(--color-bg-glass-hover)',
                              color: 'var(--color-text-tertiary)',
                            }}
                          >
                            {KIND_LABEL[hit.item.kind]}
                          </span>
                        )}
                      </div>
                      {hit.item.description && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                          {highlight(hit.item.description)}
                        </p>
                      )}
                      {hit.snippet && (
                        <p className="text-xs mt-1 italic line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                          {highlight(hit.snippet)}
                        </p>
                      )}
                    </div>
                    {/* Arrow rechts — laat zien dat 't klikbaar is */}
                    <div className="flex-shrink-0 mt-2 transition-all"
                         style={{
                           color: isSelected ? 'var(--workx-lime, #f9ff85)' : 'var(--color-text-muted)',
                           transform: isSelected ? 'translateX(2px)' : 'translateX(0)',
                         }}>
                      <Icons.arrowRight size={14} />
                    </div>
                  </Link>
                )
              })}

              {/* AI-suggesties */}
              {(aiLoading || aiSuggestions.length > 0) && (
                <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--color-border)' }}>
                  <div
                    className="px-4 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] uppercase flex items-center gap-1.5"
                    style={{ color: 'var(--workx-lime, #f9ff85)' }}
                  >
                    <Icons.sparkles size={11} />
                    AI-suggestie
                    {aiLoading && (
                      <span className="ml-1 w-2.5 h-2.5 border-[1.5px] rounded-full animate-spin"
                        style={{ borderColor: 'rgba(249,255,133,0.3)', borderTopColor: 'rgba(249,255,133,0.8)' }} />
                    )}
                  </div>
                  {aiSuggestions.map((s, i) => {
                    const idx = hits.length + i
                    const isSelected = idx === selectedIndex
                    return (
                      <Link
                        key={`ai:${s.href}`}
                        href={s.href}
                        onClick={() => { setFocused(false); setQuery('') }}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{
                          background: isSelected ? 'rgba(249, 255, 133, 0.10)' : 'transparent',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{
                            background: 'rgba(249, 255, 133, 0.12)',
                            color: 'var(--workx-lime, #f9ff85)',
                          }}
                        >
                          <Icons.sparkles size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                            {highlight(s.label)}
                          </p>
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-tertiary)' }}>
                            {s.reason}
                          </p>
                        </div>
                        <div className="flex-shrink-0 mt-2 transition-all"
                             style={{
                               color: isSelected ? 'var(--workx-lime, #f9ff85)' : 'var(--color-text-muted)',
                               transform: isSelected ? 'translateX(2px)' : 'translateX(0)',
                             }}>
                          <Icons.arrowRight size={14} />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {/* Footer */}
              <div
                className="px-4 py-2 mt-1 border-t flex items-center justify-between text-[10px]"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <span>↑↓ navigeren</span>
                <span>↵ openen</span>
                <span>esc sluiten</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
