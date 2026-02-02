'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Icons } from '@/components/ui/Icons'

interface TopBarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

const mobileMenuItems = [
  { href: '/dashboard', icon: Icons.home, label: 'Dashboard' },
  { href: '/dashboard/lustrum', icon: Icons.palmTree, label: 'Lustrum Mallorca', badge: '15 jaar!' },
  { href: '/dashboard/appjeplekje', icon: Icons.mapPin, label: 'Appjeplekje' },
  { href: '/dashboard/agenda', icon: Icons.calendar, label: 'Agenda' },
  { href: '/dashboard/vakanties', icon: Icons.sun, label: 'Vakanties & Verlof' },
  { href: '/dashboard/werk', icon: Icons.briefcase, label: 'Werk' },
  { href: '/dashboard/financien', icon: Icons.pieChart, label: 'Financiën' },
  { href: '/dashboard/bonus', icon: Icons.euro, label: 'Bonus' },
  { href: '/dashboard/transitie', icon: Icons.calculator, label: 'Transitie' },
  { href: '/dashboard/afspiegeling', icon: Icons.layers, label: 'Afspiegeling' },
  { href: '/dashboard/team', icon: Icons.users, label: 'Team' },
  { href: '/dashboard/feedback', icon: Icons.chat, label: 'Feedback' },
  { href: '/dashboard/settings', icon: Icons.settings, label: 'Instellingen' },
]

// Silicon Valley easter egg keywords
const siliconValleyEasterEggs: Record<string, { emoji: string; message: string }> = {
  'jian yang': { emoji: '🏠', message: 'ERLICH BACHMAN, THIS IS YOUR MOM!' },
  'pied piper': { emoji: '🎵', message: 'Making the world a better place!' },
  'hotdog': { emoji: '🌭', message: 'Hotdog! Not hotdog!' },
  'hot dog': { emoji: '🌭', message: 'Hotdog! Not hotdog!' },
  'bachman': { emoji: '🚬', message: 'Aviato.' },
  'aviato': { emoji: '✈️', message: 'My Aviato?' },
  'tres comas': { emoji: '🍾', message: 'This guy fucks!' },
  'gavin': { emoji: '🦅', message: 'Consider the elephant...' },
  'hooli': { emoji: '😈', message: 'Making the world a better place' },
  'dinesh': { emoji: '🇵🇰', message: 'GILFOYLE!' },
  'gilfoyle': { emoji: '😈', message: 'Code is my religion.' },
  'delete': { emoji: '🗑️', message: 'Delete Facebook.' },
  'russ': { emoji: '💰', message: 'This guy fucks!' },
  'middle out': { emoji: '📦', message: 'Optimal tip-to-tip efficiency!' },
}

export default function TopBar({ user }: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [greeting, setGreeting] = useState('')
  const [easterEggMessage, setEasterEggMessage] = useState<{ emoji: string; message: string } | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Goedemorgen')
    else if (hour < 18) setGreeting('Goedemiddag')
    else setGreeting('Goedenavond')
  }, [])

  // Check for easter egg keywords
  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase().trim()
    for (const [keyword, data] of Object.entries(siliconValleyEasterEggs)) {
      if (lowerQuery === keyword) {
        setEasterEggMessage(data)
        const timer = setTimeout(() => setEasterEggMessage(null), 3000)
        return () => clearTimeout(timer)
      }
    }
  }, [searchQuery])

  const notifications = [
    { id: 1, text: 'Lisa is morgen jarig!', time: '5 min', icon: Icons.star, color: 'text-yellow-400' },
    { id: 2, text: 'Vakantie goedgekeurd', time: '1 uur', icon: Icons.check, color: 'text-green-400' },
    { id: 3, text: 'Deadline over 2 dagen', time: '2 uur', icon: Icons.clock, color: 'text-orange-400' },
  ]

  return (
    <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-8 relative z-[100] backdrop-blur-sm bg-workx-dark/30">
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
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative group">
          <div className="absolute inset-0 bg-workx-lime/10 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <Icons.search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-workx-lime transition-colors" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek in alles..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-workx-lime/30 focus:bg-white/10 transition-all relative"
          />
          <kbd className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 px-1.5 py-0.5 rounded bg-white/10 hidden sm:inline">
            /
          </kbd>

          {/* Easter egg message popup */}
          {easterEggMessage && (
            <div className="absolute left-0 right-0 top-full mt-2 z-50 pointer-events-none">
              <div className="bg-gradient-to-r from-workx-lime/90 to-green-400/90 backdrop-blur-sm text-workx-dark px-4 py-2 rounded-xl shadow-lg text-center animate-bounce">
                <span className="text-xl mr-2">{easterEggMessage.emoji}</span>
                <span className="font-medium text-sm">{easterEggMessage.message}</span>
              </div>
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

        {/* Date pill */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-workx-lime/30 hover:bg-white/10 transition-all cursor-default group icon-calendar-hover">
          <span className="icon-animated">
            <Icons.calendar size={14} className="text-workx-lime" />
          </span>
          <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
            {new Date().toLocaleDateString('nl-NL', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
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
                {mobileMenuItems.map((item) => {
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
