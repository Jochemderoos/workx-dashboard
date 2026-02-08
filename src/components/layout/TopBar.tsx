'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'
import { getPhotoUrl } from '@/lib/team-photos'

interface TopBarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

// Navigation items for search
const navigationItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard', keywords: ['home', 'start', 'overzicht'] },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', keywords: ['feest', 'reis', 'mallorca', '15 jaar', 'jubileum'] },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje', keywords: ['kantoor', 'werkplek', 'aanmelden', 'plek'] },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda', keywords: ['events', 'afspraken', 'kalender', 'planning'] },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof', keywords: ['vakantie', 'vrij', 'verlof', 'afwezig'] },
  { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Werk', keywords: ['taken', 'zaken', 'projecten', 'dossiers'], roles: ['PARTNER', 'ADMIN'] },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financiën', keywords: ['geld', 'salaris', 'budget', 'kosten'] },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus Calculator', keywords: ['bonus', 'berekenen', 'omzet', 'provisie'] },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitievergoeding', keywords: ['ontslag', 'vergoeding', 'berekenen'] },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling', keywords: ['reorganisatie', 'ontslag', 'selectie'] },
  { href: '/dashboard/pitch', icon: Icons.file, label: 'Pitch Maker', keywords: ['pitch', 'pdf', 'document', 'cv', 'team'] },
  { href: '/dashboard/workxflow', icon: Icons.printer, label: 'Workxflow', keywords: ['dagvaarding', 'producties', 'printen', 'rechtbank', 'document'] },
  { href: '/dashboard/team', icon: Icons.users, label: 'Team', keywords: ['collega', 'medewerkers', 'mensen'] },
  { href: '/dashboard/hr-docs', icon: Icons.books, label: 'Workx Docs', keywords: ['handboek', 'regels', 'hr', 'documenten', 'beleid', 'the way it workx'] },
  { href: '/dashboard/ai', icon: Icons.sparkles, label: 'AI Assistent', keywords: ['ai', 'claude', 'chat', 'vraag', 'juridisch', 'assistent'] },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback', keywords: ['idee', 'bug', 'suggestie', 'melding'] },
  { href: '/dashboard/settings', icon: Icons.settings, label: 'Instellingen', keywords: ['profiel', 'wachtwoord', 'account'] },
]

const mobileMenuItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard' },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', badge: '15 jaar!' },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof' },
  { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Werk', roles: ['PARTNER', 'ADMIN'] },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financiën' },
  { href: '/dashboard/ai', icon: Icons.sparkles, label: 'AI Assistent', badge: 'AI' },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus' },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitie' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling' },
  { href: '/dashboard/pitch', icon: Icons.file, label: 'Pitch Maker' },
  { href: '/dashboard/workxflow', icon: Icons.printer, label: 'Workxflow' },
  { href: '/dashboard/team', icon: Icons.users, label: 'Team' },
  { href: '/dashboard/hr-docs', icon: Icons.books, label: 'Workx Docs' },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback' },
  { href: '/dashboard/settings', icon: Icons.settings, label: 'Instellingen' },
]

interface SearchResult {
  type: 'navigation' | 'team' | 'event' | 'work'
  label: string
  description?: string
  href: string
  icon: any
  photo?: string
}

export default function TopBar({ user }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [dateString, setDateString] = useState('')
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [workItems, setWorkItems] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 12) setGreeting('Goedemorgen')
    else if (hour < 18) setGreeting('Goedemiddag')
    else setGreeting('Goedenavond')

    // Set date string on client to avoid hydration mismatch
    setDateString(now.toLocaleDateString('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }))
  }, [])

  // Fetch content for search
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [teamRes, eventsRes, workRes] = await Promise.all([
          fetch('/api/team'),
          fetch('/api/calendar?upcoming=true&limit=20'),
          fetch('/api/work?limit=20'),
        ])

        if (teamRes.ok) {
          const data = await teamRes.json()
          setTeamMembers(data)
        }
        if (eventsRes.ok) {
          const data = await eventsRes.json()
          setEvents(data)
        }
        if (workRes.ok) {
          const data = await workRes.json()
          setWorkItems(data)
        }
      } catch (e) {
        console.error('Error fetching search content:', e)
      }
    }
    fetchContent()
  }, [])

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setShowSearchResults(false)
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []

    const query = searchQuery.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search navigation items (filter by role)
    navigationItems
      .filter(item => !item.roles || item.roles.includes(user.role))
      .forEach(item => {
        const matchesLabel = item.label.toLowerCase().includes(query)
        const matchesKeywords = item.keywords.some(kw => kw.includes(query))
        if (matchesLabel || matchesKeywords) {
          results.push({
            type: 'navigation',
            label: item.label,
            description: 'Pagina',
            href: item.href,
            icon: item.icon,
          })
        }
      })

    // Search team members
    teamMembers.forEach(member => {
      if (member.name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.role?.toLowerCase().includes(query)) {
        results.push({
          type: 'team',
          label: member.name,
          description: member.role === 'PARTNER' ? 'Partner' : member.role === 'ADMIN' ? 'Office Manager' : 'Advocaat',
          href: '/dashboard/team',
          icon: Icons.user,
          photo: getPhotoUrl(member.name) || undefined,
        })
      }
    })

    // Search events
    events.forEach(event => {
      if (event.title?.toLowerCase().includes(query) ||
          event.location?.toLowerCase().includes(query)) {
        const date = new Date(event.startTime)
        results.push({
          type: 'event',
          label: event.title,
          description: date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' }),
          href: '/dashboard/agenda',
          icon: Icons.calendar,
        })
      }
    })

    // Search work items (only for PARTNER/ADMIN)
    if (user.role === 'PARTNER' || user.role === 'ADMIN') {
      workItems.forEach(item => {
        if (item.title?.toLowerCase().includes(query) ||
            item.clientName?.toLowerCase().includes(query)) {
          results.push({
            type: 'work',
            label: item.title,
            description: item.clientName || 'Zaak',
            href: '/dashboard/werk',
            icon: Icons.briefcase,
          })
        }
      })
    }

    return results.slice(0, 8) // Limit to 8 results
  }, [searchQuery, teamMembers, events, workItems, user.role])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults])

  // Handle keyboard navigation in search results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchResults || searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % searchResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = searchResults[selectedIndex]
      if (selected) {
        router.push(selected.href)
        setSearchQuery('')
        setShowSearchResults(false)
      }
    }
  }

  const handleResultClick = (href: string) => {
    router.push(href)
    setSearchQuery('')
    setShowSearchResults(false)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'navigation': return 'Pagina'
      case 'team': return 'Team'
      case 'event': return 'Agenda'
      case 'work': return 'Werk'
      default: return ''
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'navigation': return 'bg-workx-lime/20 text-workx-lime'
      case 'team': return 'bg-blue-500/20 text-blue-400'
      case 'event': return 'bg-purple-500/20 text-purple-400'
      case 'work': return 'bg-orange-500/20 text-orange-400'
      default: return 'bg-white/10 text-gray-400'
    }
  }

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 relative z-[100] bg-workx-dark/95">
      {/* Mobile: Hamburger Menu + Home Button */}
      <div className="md:hidden flex items-center gap-1">
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5 transition-all"
        >
          {showMobileMenu ? <Icons.x size={24} /> : <Icons.menu size={24} />}
        </button>
        {pathname !== '/dashboard' && (
          <Link
            href="/dashboard"
            className="relative p-1.5 rounded-lg hover:bg-workx-lime/10 transition-all group"
            title="Naar Dashboard"
          >
            <img
              src="/workx-pand.png"
              alt="Home"
              className="h-7 w-auto opacity-50 group-hover:opacity-90 transition-all drop-shadow-[0_0_8px_rgba(249,255,133,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(249,255,133,0.5)]"
            />
          </Link>
        )}
      </div>

      {/* Left: Greeting (desktop only) */}
      <div className="hidden lg:block">
        <p className="text-white/40 text-sm">{greeting},</p>
        <p className="text-white font-medium">{user.name?.split(' ')[0]}</p>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-xl mx-8" ref={searchRef}>
        <div className="relative group">
          <div className="absolute inset-0 bg-workx-lime/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-workx-lime transition-colors" size={18} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSearchResults(true)
            }}
            onFocus={() => setShowSearchResults(true)}
            onKeyDown={handleKeyDown}
            placeholder="Zoeken..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all relative"
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 px-1.5 py-0.5 rounded bg-white/10 hidden sm:inline">
            /
          </kbd>

          {/* Search Results Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-workx-gray border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  <Icons.search size={20} className="mx-auto mb-2 opacity-50" />
                  <p>Geen resultaten voor "{searchQuery}"</p>
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.map((result, index) => {
                    const Icon = result.icon
                    const isSelected = index === selectedIndex
                    return (
                      <button
                        key={`${result.type}-${result.label}-${index}`}
                        onClick={() => handleResultClick(result.href)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-workx-lime/10' : 'hover:bg-white/5'
                        }`}
                      >
                        {result.photo ? (
                          <img
                            src={result.photo}
                            alt={result.label}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(result.type)}`}>
                            <Icon size={16} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isSelected ? 'text-workx-lime' : 'text-white'}`}>
                            {result.label}
                          </p>
                          {result.description && (
                            <p className="text-xs text-gray-400 truncate">{result.description}</p>
                          )}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getTypeColor(result.type)}`}>
                          {getTypeLabel(result.type)}
                        </span>
                      </button>
                    )
                  })}
                  <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-xs text-gray-500">
                    <span>↑↓ navigeren</span>
                    <span>↵ openen</span>
                    <span>esc sluiten</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Home button (desktop) - Workx Grachtenpand */}
        {pathname !== '/dashboard' && (
          <Link
            href="/dashboard"
            className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl border border-workx-lime/20 hover:border-workx-lime/40 hover:bg-workx-lime/5 transition-all group"
            title="Naar Dashboard"
          >
            <img
              src="/workx-pand.png"
              alt="Home"
              className="h-5 w-auto opacity-40 group-hover:opacity-80 group-hover:scale-105 transition-all drop-shadow-[0_0_6px_rgba(249,255,133,0.25)] group-hover:drop-shadow-[0_0_10px_rgba(249,255,133,0.4)]"
            />
            <span className="text-sm text-white/50 group-hover:text-workx-lime hidden lg:inline transition-colors">Home</span>
          </Link>
        )}

        {/* Command Palette trigger */}
        <button
          onClick={() => {
            const event = new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              ctrlKey: true,
              bubbles: true,
            })
            document.dispatchEvent(event)
          }}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-workx-lime/30 hover:bg-white/10 transition-all group"
          title="Command Palette"
        >
          <Icons.command size={14} className="text-white/40 group-hover:text-workx-lime transition-colors" />
          <kbd className="text-[10px] text-white/30 group-hover:text-white/50 transition-colors">
            <span className="mr-0.5">⌘</span>K
          </kbd>
        </button>

        {/* Date pill */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-workx-lime/30 hover:bg-white/10 transition-all cursor-default group icon-calendar-hover">
          <span className="icon-animated">
            <Icons.calendar size={14} className="text-workx-lime" />
          </span>
          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
            {dateString}
          </span>
        </div>
      </div>

      {/* Mobile Menu Dropdown - using very high z-index to ensure it's above everything */}
      {showMobileMenu && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="fixed left-0 right-0 top-16 z-[9999] md:hidden fade-in">
            <div className="bg-workx-dark border-b border-white/10 shadow-2xl">
              {/* User info */}
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-workx-lime to-workx-lime/80 flex items-center justify-center">
                  <span className="text-workx-dark font-semibold">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-white/40">{user.email}</p>
                </div>
              </div>

              {/* Navigation items */}
              <nav className="p-2 max-h-[60vh] overflow-y-auto">
                {mobileMenuItems
                .filter((item) => !item.roles || item.roles.includes(user.role))
                .map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  const badge = 'badge' in item ? item.badge : null
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMobileMenu(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-workx-lime text-workx-dark font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="flex-1">{item.label}</span>
                      {badge && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
                          {badge}
                        </span>
                      )}
                      {!badge && isActive && <div className="ml-auto w-2 h-2 rounded-full bg-current opacity-60" />}
                    </Link>
                  )
                })}
              </nav>

              {/* Logout button */}
              <div className="p-4 border-t border-white/10">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  <Icons.logout size={18} />
                  <span>Uitloggen</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  )
}
